import { brazilToday, daysBetween, weightStats, type Animal, type Weight } from '@/lib/corte';
import { money, number } from '@/lib/farm';
import { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;
type Reply = {answer:string;metric?:string;label?:string};
const say = (answer:string,metric?:string,label?:string):Reply => ({answer,metric,label});
const text = (value:unknown) => String(value??'');
const numeric = (value:unknown) => value==null?null:Number(value);
const normalized = (value:string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const formatDate = (date:unknown) => text(date).slice(0,10).split('-').reverse().join('/');
const identity = (animal:Row) => text(animal.nome||animal.identificacao);
const containsName = (question:string,name:unknown) => {
 const value=normalized(text(name).trim());
 return value.length>=2 && new RegExp(`(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`,'i').test(question);
};
function findNamed(question:string,animals:Row[]) {
 const matches=animals.filter(a=>containsName(question,a.identificacao)||containsName(question,a.nome));
 return matches.length===1?{animal:matches[0],ambiguous:false}: {animal:null,ambiguous:matches.length>1};
}
async function fetchRows(db:Db,farmId:string,table:string,columns:string):Promise<Row[]> {
 const result=await db.from(table).select(columns).eq('fazenda_id',farmId).limit(1001);
 if(result.error)throw new Error(`Falha ao consultar ${table}.`);
 if((result.data||[]).length>1000)throw new Error('Há muitos registros para esta consulta. Refine a pergunta.');
 return (result.data||[]) as unknown as Row[];
}
const orderBy=(a:Row,b:Row,key:string,descending=false)=>((numeric(a[key])??0)-(numeric(b[key])??0))*(descending?-1:1)||text(a.identificacao).localeCompare(text(b.identificacao));
function period(q:string,today:string) {
 const dates=[...q.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map(x=>`${x[3]}-${x[2]}-${x[1]}`);
 if(dates.length>=2)return {from:dates[0],to:dates[1],label:`de ${formatDate(dates[0])} a ${formatDate(dates[1])}`};
 if(/hoje|\bno dia\b/.test(q))return {from:today,to:today,label:'hoje'};
 if(/semana/.test(q)){
  const day=new Date(`${today}T12:00:00Z`),offset=(day.getUTCDay()+6)%7;
  day.setUTCDate(day.getUTCDate()-offset);
  return {from:day.toISOString().slice(0,10),to:today,label:'nesta semana'};
 }
 return {from:today.slice(0,7)+'-01',to:today,label:'neste mês'};
}

async function beefAnswer(db:Db,farmId:string,q:string,today:string):Promise<Reply|null> {
 const animals=(await fetchRows(db,farmId,'animais','id,identificacao,nome,sistema,status,lote_id,data_entrada,peso_entrada,peso_atual,valor_compra')).filter(a=>text(a.sistema)==='corte');
 const chosen=findNamed(q,animals);
 if(chosen.ambiguous&&!/compar/.test(q))return say('Encontrei mais de um animal com essa identificação. Informe o brinco completo.');
 const lots=await fetchRows(db,farmId,'lotes','id,nome,peso_meta,sistema');
 const lot=lots.find(x=>x.sistema==='corte'&&containsName(q,x.nome));
 const explicit=/meta (?:de )?(\d+(?:[,.]\d+)?)\s*kg/.exec(q);
 const goalFor=(a:Row)=>explicit?Number(explicit[1].replace(',','.')):numeric(lots.find(x=>x.id===a.lote_id)?.peso_meta);
 const pool=animals.filter(a=>a.status==='ativo'&&(!lot||a.lote_id===lot.id));
 const weights=await fetchRows(db,farmId,'pesagens','animal_id,data_pesagem,peso_kg,criado_em');
 const latest=(a:Row)=>weights.filter(x=>x.animal_id===a.id).sort((x,y)=>text(y.data_pesagem).localeCompare(text(x.data_pesagem))||text(y.criado_em).localeCompare(text(x.criado_em)))[0];
 const weight=(a:Row)=>numeric(latest(a)?.peso_kg)??numeric(a.peso_atual)??numeric(a.peso_entrada);
 const dateOf=(a:Row)=>latest(a)?.data_pesagem||(!a.peso_atual?a.data_entrada:null);
 const source=(a:Row)=>latest(a)?`registrados em ${formatDate(latest(a)?.data_pesagem)}`:a.peso_atual!=null?'informados no cadastro, sem data de pesagem':a.data_entrada?`de entrada em ${formatDate(a.data_entrada)}`:'de entrada, sem data informada';
 const name=(a:Row)=>`${identity(a)}${lots.find(x=>x.id===a.lote_id)?` do ${text(lots.find(x=>x.id===a.lote_id)?.nome)}`:''}`;
 const ready=pool.filter(a=>weight(a)!=null);
 const gmd=(a:Row)=>weightStats(a as unknown as Animal,weights as unknown as Weight[],goalFor(a)).recentGmd;
 const rankCount=Math.max(1,Math.min(10,Number(/\b(\d{1,2})\s+(?:animais|novilhas|mais|menos)/.exec(q)?.[1]||(/\bcinco\b/.test(q)?5:5))));
 if(/vendid|abatid|morto|transferid|descarte|peso final|saida/.test(q)){
  const exits=await fetchRows(db,farmId,'saidas_corte','animal_id,tipo,data_saida,peso_final');
  if(chosen.animal){const exit=exits.filter(x=>x.animal_id===chosen.animal?.id).sort((a,b)=>text(b.data_saida).localeCompare(text(a.data_saida)))[0];return exit?say(`${identity(chosen.animal)}: ${text(exit.tipo)} em ${formatDate(exit.data_saida)}${exit.peso_final!=null?`, peso final ${number(Number(exit.peso_final),1)} kg`:''}.`):say(`Não há saída registrada para ${identity(chosen.animal)}.`);}
  const selected=exits.filter(x=>/vendid/.test(q)?x.tipo==='venda':/abatid/.test(q)?x.tipo==='abate':true);
  return say(selected.length?selected.map(x=>`${identity(animals.find(a=>a.id===x.animal_id)||{identificacao:'Animal'})}: ${x.tipo} em ${formatDate(x.data_saida)}`).join('; ')+'.':'Não há saídas desse tipo registradas.');
 }
 if(/vacina|medicament|ivermectina|carencia|sanidade|vermifug/.test(q)){
  const health=await fetchRows(db,farmId,'manejos','animal_id,lote_id,tipo,produto,data_manejo,data_fim_carencia');
  const applies=(h:Row,a:Row)=>h.animal_id===a.id||h.animal_id==null&&h.lote_id===a.lote_id;
  const product=/ivermectina|bovitam|vermifugo|antiparasitario/.exec(q)?.[0];
  const matching=(a:Row)=>health.filter(h=>applies(h,a)&&(!product||normalized(text(h.produto)).includes(product))&&(!/carencia/.test(q)||text(h.data_manejo)<=today&&text(h.data_fim_carencia)>=today));
  if(chosen.animal){const h=matching(chosen.animal).sort((a,b)=>text(b.data_manejo).localeCompare(text(a.data_manejo)))[0];return h?say(`${identity(chosen.animal)}: ${text(h.produto||h.tipo)} em ${formatDate(h.data_manejo)}${/carencia/.test(q)?`, carência até ${formatDate(h.data_fim_carencia)}`:''}.`):say(`Não há registro sanitário correspondente para ${identity(chosen.animal)}.`);}
  const selected=pool.filter(a=>matching(a).length);
  return say(selected.length?`${selected.length} animais: ${selected.map(identity).join(', ')}.`:'Não há animais com esse registro sanitário.');
 }
 if(chosen.animal){
  const a=chosen.animal,w=weight(a),last=latest(a),gain=w!=null&&a.peso_entrada!=null?w-Number(a.peso_entrada):null;
  if(/compar/.test(q))return say('Informe dois brincos distintos para comparar os animais.');
  if(/gmd|ganho medio diario/.test(q))return gmd(a)!=null?say(`O GMD recente de ${identity(a)} é ${number(gmd(a)!,2)} kg/dia.`):say(`Não há pesagens em datas diferentes suficientes para calcular o GMD de ${identity(a)}.`);
  if(/meta|quanto falta/.test(q)){const goal=goalFor(a);return goal!=null&&w!=null?say(`${identity(a)} pesa ${number(w,1)} kg; faltam ${number(Math.max(0,goal-w),1)} kg para a meta de ${number(goal,1)} kg.`):say(`Falta a meta ou o peso conhecido de ${identity(a)}.`);}
  if(/compra|valor investido|custo/.test(q))return a.valor_compra!=null?say(`O valor de compra de ${identity(a)} foi ${money(Number(a.valor_compra))}.`):say(`Não há valor de compra registrado para ${identity(a)}.`);
  if(/ganh|desde a entrada/.test(q))return gain!=null?say(`${identity(a)} ${gain>=0?'ganhou':'perdeu'} ${number(Math.abs(gain),1)} kg desde a entrada (${number(Number(a.peso_entrada),1)} kg → ${number(w!,1)} kg).`):say(`Falta o peso de entrada ou o peso atual conhecido de ${identity(a)}.`);
  if(/ultima pesagem|quando.*pesad/.test(q))return last?say(`A última pesagem de ${identity(a)} foi ${number(Number(last.peso_kg),1)} kg em ${formatDate(last.data_pesagem)}.`):say(`Não há pesagem registrada para ${identity(a)}.`);
  return w!=null?say(`O último peso conhecido de ${identity(a)} é ${number(w,1)} kg, ${source(a)}.${last&&weights.filter(x=>x.animal_id===a.id).length===1?' Há apenas uma pesagem.':''}`):say(`Não há peso registrado para ${identity(a)}.`);
 }
 const tagged=[...q.matchAll(/\b[bc]\d{2,5}\b/g)].map(x=>x[0].toUpperCase());
 if(tagged.length){const unknown=tagged.filter(tag=>!animals.some(a=>normalized(text(a.identificacao))===normalized(tag)));if(unknown.length)return say(`Não encontrei ${unknown.join(', ')} no gado de corte desta fazenda.`);}
 if(/compar/.test(q)&&tagged.length>=2){
  const selected=tagged.map(tag=>animals.find(a=>normalized(text(a.identificacao))===normalized(tag))!);
  return say(selected.map(a=>`${identity(a)}: ${weight(a)!=null?`${number(weight(a)!,1)} kg (${source(a)})`:'sem peso conhecido'}${gmd(a)!=null?`, GMD ${number(gmd(a)!,2)} kg/dia`:''}`).join('; ')+'.');
 }
 if(!pool.length)return say('Não há animais de corte ativos nesse lote.');
 if(/sem pesagem recente|nao tem pesagem recente|sem peso recente|ha mais tempo sem pesagem|ultima pesagem mais recente/.test(q)){
  const ordered=[...pool].sort((a,b)=>text(dateOf(a)).localeCompare(text(dateOf(b))));
  if(/ha mais tempo|mais recente/.test(q)){const recent=/mais recente/.test(q),a=recent?ordered.at(-1)!:ordered[0],ties=ordered.filter(x=>text(dateOf(x))===text(dateOf(a)));if(ties.length>1)return say(`${ties.length} animais compartilham a ${recent?'pesagem mais recente':'data de pesagem mais antiga'} (${latest(a)?formatDate(latest(a)?.data_pesagem):'sem data registrada'}): ${ties.slice(0,10).map(identity).join(', ')}${ties.length>10?' e outros':''}.`);return latest(a)?say(`${identity(a)}: última pesagem em ${formatDate(latest(a)?.data_pesagem)}, ${number(Number(latest(a)?.peso_kg),1)} kg.`):say(`${identity(a)} não possui pesagem registrada.`);}
  const since=new Date(`${today}T12:00:00Z`);since.setUTCDate(since.getUTCDate()-30);const stale=pool.filter(a=>!latest(a)||text(latest(a)?.data_pesagem)<since.toISOString().slice(0,10));
  return say(stale.length?`${stale.length} animais sem pesagem nos últimos 30 dias: ${stale.slice(0,20).map(identity).join(', ')}${stale.length>20?' e outros':''}.`:'Todos os animais ativos têm pesagem nos últimos 30 dias.');
 }
 if(/gmd|ganho medio diario/.test(q)){const ranked=pool.map(a=>({a,g:gmd(a)})).filter(x=>x.g!=null).sort((x,y)=>(x.g!-y.g!)*(/menor|pior/.test(q)?1:-1));return ranked.length?say(`${identity(ranked[0].a)} teve o ${/menor|pior/.test(q)?'menor':'melhor'} GMD conhecido: ${number(ranked[0].g!,2)} kg/dia.`):say('Não há pesagens em datas diferentes suficientes para comparar o GMD dos animais.');}
 if(/ganhou mais|maior ganho|melhor desempenho/.test(q)){const ranked=pool.map(a=>({a,g:weight(a)!=null&&a.peso_entrada!=null?weight(a)!-Number(a.peso_entrada):null})).filter(x=>x.g!=null&&x.g>0).sort((x,y)=>y.g!-x.g!);return ranked.length?say(`${identity(ranked[0].a)} teve o maior ganho medido desde a entrada: ${number(ranked[0].g!,1)} kg.`):say('Não há ganho medido após a entrada para comparar o desempenho.');}
 if(/maior valor|mais investido|valor investido/.test(q)){const known=pool.filter(a=>a.valor_compra!=null).sort((a,b)=>orderBy(a,b,'valor_compra',true));return known.length?say(`${identity(known[0])} tem o maior valor de compra informado: ${money(Number(known[0].valor_compra))}.`):say('Não há valores de compra registrados.');}
 if(/abaixo|acima|passaram? de|mais de \d+ kg/.test(q)&&!/meta/.test(q)){
  const limit=Number(/(?:abaixo(?: de)?|acima(?: de)?|passaram? de|mais de)\s*(\d+(?:[,.]\d+)?)\s*kg?/.exec(q)?.[1]?.replace(',','.')||0);
  if(!limit)return say('Informe o peso em kg para aplicar o filtro.');
  const above=/acima|passaram?|mais de/.test(q),matches=ready.filter(a=>above?weight(a)!>limit:weight(a)!<limit).sort((a,b)=>orderBy({peso:weight(a)},{peso:weight(b)},'peso',above));
  return /^quantos?/.test(q)?say(`${matches.length} ${matches.length===1?'animal está':'animais estão'} ${above?'acima':'abaixo'} de ${number(limit,1)} kg.`):say(matches.length?`${matches.length} ${matches.length===1?'animal':'animais'} ${above?'acima':'abaixo'} de ${number(limit,1)} kg: ${matches.map(a=>`${identity(a)} (${number(weight(a)!,1)} kg)`).join(', ')}.`:`Nenhum animal está ${above?'acima':'abaixo'} de ${number(limit,1)} kg.`);
 }
 if(/meta/.test(q)&&/faltam? mais de/.test(q)){
  const min=Number(/faltam? mais de\s*(\d+(?:[,.]\d+)?)\s*kg/.exec(q)?.[1]?.replace(',','.')||0);
  const matches=ready.filter(a=>goalFor(a)!=null&&goalFor(a)!-weight(a)!>min);
  return say(matches.length?`${matches.length} animais ainda estão a mais de ${number(min,1)} kg da meta: ${matches.map(identity).join(', ')}.`:'Nenhum animal com meta e peso conhecidos atende a esse filtro.');
 }
 if(/mais perto|proxim[oa]s? da meta/.test(q)){
  const ranked=ready.filter(a=>goalFor(a)!=null).sort((a,b)=>(Math.max(0,goalFor(a)!-weight(a)!)-Math.max(0,goalFor(b)!-weight(b)!))||text(a.identificacao).localeCompare(text(b.identificacao)));
  return ranked.length?say(/liste|quais|\b\d+\b.*mais proxim/.test(q)?`${ranked.slice(0,rankCount).map(a=>`${identity(a)}: ${number(weight(a)!,1)} kg; faltam ${number(Math.max(0,goalFor(a)!-weight(a)!),1)} kg`).join('; ')}.`:`${identity(ranked[0])} está mais perto da meta de ${number(goalFor(ranked[0])!,1)} kg: pesa ${number(weight(ranked[0])!,1)} kg e faltam ${number(Math.max(0,goalFor(ranked[0])!-weight(ranked[0])!),1)} kg.`):say('Não há meta e peso suficientes para comparar os animais.');
 }
 if(/mais pesad|mais lev|menos pesad|\d+ mais pesad|\bcinco mais pesad/.test(q)){
  const light=/mais lev|menos pesad/.test(q),sorted=ready.sort((a,b)=>orderBy({peso:weight(a),identificacao:a.identificacao},{peso:weight(b),identificacao:b.identificacao},'peso',!light));
  if(!sorted.length)return say('Não há pesos conhecidos para comparar.');
  if(/liste|quais|\b\d+\b.*mais pesad|\bcinco\b/.test(q))return say(`${sorted.slice(0,rankCount).map(a=>`${identity(a)}: ${number(weight(a)!,1)} kg`).join('; ')}.`);
  return say(`O animal mais ${light?'leve':'pesado'} é ${name(sorted[0])}, com ${number(weight(sorted[0])!,1)} kg ${source(sorted[0])}.`);
 }
 return null;
}

async function dairyAnswer(db:Db,farmId:string,q:string,today:string,calfQuestion:boolean):Promise<Reply|null> {
 const animals=(await fetchRows(db,farmId,'animais','id,identificacao,nome,sistema,categoria,status,situacao_leite,prenhe,proxima_previsao_parto,data_ultimo_parto,data_nascimento,mae_id,situacao_cria,data_desmame,data_prevista_desmame,peso_atual,peso_entrada,data_ultima_pesagem,bezerro_id')).filter(a=>a.sistema==='leite');
 const calves=animals.filter(a=>a.mae_id||a.situacao_cria||a.categoria==='Cria leiteira');
 const cows=animals.filter(a=>!calves.includes(a));
 const foundCalf=findNamed(q,calves),foundCow=findNamed(q,cows);
 if(foundCalf.ambiguous||foundCow.ambiguous&&!/compar/.test(q))return say('Encontrei nomes repetidos. Informe o brinco ou a identificação completa.');
 const cow=foundCow.animal,calf=foundCalf.animal;
 if(!calfQuestion&&!cow&&/ultimo parto|quantas crias/.test(q))return say(cows.length?'Não identifiquei essa vaca leiteira. Informe o nome ou brinco cadastrado.':'Não há vacas leiteiras cadastradas para consultar partos.');
 if(calfQuestion){
  if(/qual vaca.*bezerro.*mamando/.test(q)){const mothers=cows.filter(x=>calves.some(c=>c.mae_id===x.id&&c.situacao_cria==='mamando'));return say(mothers.length?`${mothers.length} vacas têm cria mamando: ${mothers.map(identity).join(', ')}.`:'Não há vaca vinculada a cria mamando.');}
  if(/qual e a mae|quem e a mae|mae da cria|mae d[ao] bezer/.test(q))return calf?say(`A mãe de ${identity(calf)} é ${identity(cows.find(x=>x.id===calf.mae_id)||{identificacao:'não informada'})}.`):say('Não identifiquei a cria. Informe nome ou brinco.');
  if(/cria (?:da|de)|bezerro (?:da|de)|bezerra (?:da|de)|cria atual/.test(q)&&cow){const children=calves.filter(x=>x.mae_id===cow.id).sort((a,b)=>text(b.data_nascimento).localeCompare(text(a.data_nascimento)));const selected=/atual/.test(q)?children.filter(x=>x.situacao_cria==='mamando').slice(0,1):children;return say(selected.length?`${identity(cow)}: ${selected.map(x=>`${identity(x)} (${x.situacao_cria||'situação não informada'})`).join(', ')}.`:`Não há cria ${/atual/.test(q)?'mamando ':''}vinculada a ${identity(cow)}.`);}
  if(cow&&/quantas crias|crias.*teve/.test(q)){const births=await fetchRows(db,farmId,'partos_leite','mae_id,quantidade_crias');const own=births.filter(x=>x.mae_id===cow.id),count=own.reduce((s,x)=>s+Number(x.quantidade_crias),0);return say(own.length?`${identity(cow)} teve ${count} ${count===1?'cria':'crias'} em ${own.length} ${own.length===1?'parto registrado':'partos registrados'}.`:`Não há partos registrados para ${identity(cow)}.`);}
  if(calf){const days=calf.data_nascimento?daysBetween(text(calf.data_nascimento),today):null;const mother=cows.find(x=>x.id===calf.mae_id);if(/idade|quantos dias/.test(q))return say(days!=null?`${identity(calf)} tem ${days} dias, nascida em ${formatDate(calf.data_nascimento)}.`:`A data de nascimento de ${identity(calf)} não foi informada.`);if(/peso/.test(q)){const weights=await fetchRows(db,farmId,'pesagens','animal_id,data_pesagem,peso_kg');const last=weights.filter(x=>x.animal_id===calf.id).sort((a,b)=>text(b.data_pesagem).localeCompare(text(a.data_pesagem)))[0];const known=numeric(last?.peso_kg)??numeric(calf.peso_atual)??numeric(calf.peso_entrada);return say(known!=null?`${identity(calf)} pesa ${number(known,1)} kg${last?`, pesados em ${formatDate(last.data_pesagem)}`:''}.`:`Não há peso registrado para ${identity(calf)}.`);}return say(`${identity(calf)}: mãe ${mother?identity(mother):'não informada'}, ${calf.data_nascimento?`nascida em ${formatDate(calf.data_nascimento)}`:'nascimento sem data'}, situação ${calf.situacao_cria||'não informada'}.`);}
  const available=calves.filter(a=>/desmamad/.test(q)?a.situacao_cria==='desmamada':/perto.*desmam/.test(q)?a.situacao_cria==='mamando'&&a.data_prevista_desmame&&daysBetween(today,text(a.data_prevista_desmame))!<=30:a.situacao_cria==='mamando');
  if(/podem ser desmam/.test(q))return say('Não posso definir o desmame apenas pela idade. Informe a previsão de desmame de cada cria para consultar as próximas datas.');
  if(/mais velh/.test(q)){const oldest=calves.filter(x=>x.data_nascimento).sort((a,b)=>text(a.data_nascimento).localeCompare(text(b.data_nascimento)))[0];return say(oldest?`${identity(oldest)} é a cria mais velha registrada, nascida em ${formatDate(oldest.data_nascimento)}.`:'Não há crias com data de nascimento registrada.');}
  if(/sem peso recente/.test(q)){const since=new Date(`${today}T12:00:00Z`);since.setUTCDate(since.getUTCDate()-30);const weights=await fetchRows(db,farmId,'pesagens','animal_id,data_pesagem');const stale=calves.filter(a=>!weights.some(w=>w.animal_id===a.id&&text(w.data_pesagem)>=since.toISOString().slice(0,10)));return say(stale.length?`${stale.length} crias sem pesagem nos últimos 30 dias: ${stale.map(identity).join(', ')}.`:'Todas as crias têm pesagem recente.');}
  return say(available.length?`${available.length} crias ${/desmamad/.test(q)?'desmamadas':/perto.*desmam/.test(q)?'com desmame previsto em até 30 dias':'mamando'}: ${available.map(identity).join(', ')}.`:'Não há crias cadastradas nessa situação.');
 }
 if(/compar/.test(q)){const matched=cows.filter(x=>containsName(q,x.nome)||containsName(q,x.identificacao));if(matched.length<2)return say('Informe duas vacas por nome ou identificação para comparar.');const milk=await fetchRows(db,farmId,'producao_leite','animal_id,data_producao,litros');const p=period(q,today);return say(matched.slice(0,2).map(a=>{const entries=milk.filter(x=>x.animal_id===a.id&&text(x.data_producao)>=p.from&&text(x.data_producao)<=p.to);return `${identity(a)}: ${entries.length?`${number(entries.reduce((s,x)=>s+Number(x.litros),0),1)} L individuais ${p.label}`:`sem produção individual ${p.label}`}`}).join('; ')+'.');}
 if(/lactac|seca|pren|parir|parto previsto|proxim.*parto/.test(q)&&!/producao/.test(q)){
  if(cow&&/ultimo parto|quantas crias/.test(q)){
   const births=await fetchRows(db,farmId,'partos_leite','mae_id,data_parto,quantidade_crias');const own=births.filter(x=>x.mae_id===cow.id).sort((a,b)=>text(b.data_parto).localeCompare(text(a.data_parto)));
   return /quantas crias/.test(q)?say(own.length?`${identity(cow)} teve ${own.reduce((s,x)=>s+Number(x.quantidade_crias),0)} crias em ${own.length} partos registrados.`:`Não há partos registrados para ${identity(cow)}.`):say(own.length?`O último parto de ${identity(cow)} foi em ${formatDate(own[0].data_parto)}.`:cow.data_ultimo_parto?`O último parto informado de ${identity(cow)} foi em ${formatDate(cow.data_ultimo_parto)}; não há histórico detalhado de partos.`:`Não há parto registrado para ${identity(cow)}.`);
  }
  const active=cows.filter(x=>x.status==='ativo');const selected=/seca/.test(q)?active.filter(x=>normalized(text(x.situacao_leite)).includes('seca')):/prenh|parir|parto previsto|proxim.*parto/.test(q)?active.filter(x=>x.prenhe===true):active.filter(x=>normalized(text(x.situacao_leite)).includes('lact'));
  if(cow)return say(`${identity(cow)}: ${cow.situacao_leite||'situação leiteira não informada'}${cow.prenhe?', prenha':''}${cow.proxima_previsao_parto?`, parto previsto em ${formatDate(cow.proxima_previsao_parto)}`:''}.`);
  if(/perto|proxim/.test(q)&&/parto|parir/.test(q)){const dated=selected.filter(x=>x.proxima_previsao_parto).sort((a,b)=>text(a.proxima_previsao_parto).localeCompare(text(b.proxima_previsao_parto)));return say(dated.length?`${identity(dated[0])} tem a previsão de parto mais próxima: ${formatDate(dated[0].proxima_previsao_parto)}.`:'Não há previsão de parto registrada para vacas prenhas.');}
  const month=/este mes|neste mes/.test(q)?selected.filter(x=>text(x.proxima_previsao_parto).startsWith(today.slice(0,7))):selected;
  return say(month.length?`${month.length} vacas: ${month.map(x=>`${identity(x)}${x.proxima_previsao_parto?` (${formatDate(x.proxima_previsao_parto)})`:''}`).join(', ')}.`:'Não há vacas registradas nessa situação.');
 }
 if(/ultimo parto|quantas crias/.test(q)&&cow){const births=await fetchRows(db,farmId,'partos_leite','mae_id,data_parto,quantidade_crias');const own=births.filter(x=>x.mae_id===cow.id).sort((a,b)=>text(b.data_parto).localeCompare(text(a.data_parto)));return say(/quantas/.test(q)?own.length?`${identity(cow)} teve ${own.reduce((s,x)=>s+Number(x.quantidade_crias),0)} crias registradas.`:`Não há partos registrados para ${identity(cow)}.`:own.length?`Último parto de ${identity(cow)}: ${formatDate(own[0].data_parto)}.`:cow.data_ultimo_parto?`Último parto informado: ${formatDate(cow.data_ultimo_parto)}; sem histórico detalhado.`:`Não há parto registrado para ${identity(cow)}.`);}
 if(/medicament|vacina|carencia/.test(q)){
  const health=await fetchRows(db,farmId,'manejos','animal_id,produto,tipo,data_manejo,data_fim_carencia');const relevant=health.filter(h=>cows.some(a=>a.id===h.animal_id)&&(!/carencia/.test(q)||text(h.data_manejo)<=today&&text(h.data_fim_carencia)>=today));const chosen=cow?relevant.filter(x=>x.animal_id===cow.id):relevant;
  const recent=chosen.sort((a,b)=>text(b.data_manejo).localeCompare(text(a.data_manejo))).slice(0,10);
  return say(recent.length?recent.map(x=>`${identity(cows.find(a=>a.id===x.animal_id)!)}: ${text(x.produto||x.tipo)}, ${formatDate(x.data_manejo)}${/carencia/.test(q)?`, carência até ${formatDate(x.data_fim_carencia)}`:''}`).join('; ')+'.':'Não há registros sanitários correspondentes para vacas leiteiras.');
 }
 if(/maior custo/.test(q)){const costs=await fetchRows(db,farmId,'transacoes','animal_id,tipo,valor,origem');const ranked=cows.map(a=>({a,amount:costs.filter(x=>x.animal_id===a.id&&x.tipo==='despesa'&&x.origem!=='saida').reduce((s,x)=>s+Number(x.valor),0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);return say(ranked.length?`${identity(ranked[0].a)} tem o maior custo individual vinculado: ${money(ranked[0].amount)}.`:'Não há custos individuais vinculados às vacas.');}
 const milk=await fetchRows(db,farmId,'producao_leite','animal_id,data_producao,litros,preco_litro,turno,criado_em');const individual=milk.filter(x=>x.animal_id&&cows.some(a=>a.id===x.animal_id));const p=period(q,today);
 const inPeriod=individual.filter(x=>text(x.data_producao)>=p.from&&text(x.data_producao)<=p.to);
 const totals=cows.map(a=>({a,rows:inPeriod.filter(x=>x.animal_id===a.id)})).filter(x=>x.rows.length);
 if(cow){const own=individual.filter(x=>x.animal_id===cow.id).sort((a,b)=>text(b.data_producao).localeCompare(text(a.data_producao))||text(b.criado_em).localeCompare(text(a.criado_em)));if(/ultima/.test(q))return say(own.length?`A última produção individual de ${identity(cow)} foi ${number(Number(own[0].litros),1)} L em ${formatDate(own[0].data_producao)}${own[0].turno?` (${own[0].turno})`:''}.`:`Não há produção individual registrada para ${identity(cow)}.`);const selected=own.filter(x=>text(x.data_producao)>=p.from&&text(x.data_producao)<=p.to);return say(selected.length?`${identity(cow)} produziu ${number(selected.reduce((s,x)=>s+Number(x.litros),0),1)} L ${p.label}, em ${selected.length} registro(s) individuais.`:`Não há produção individual registrada para ${identity(cow)} ${p.label}. A produção do tanque não é atribuída a uma vaca.`);}
  if(/sem producao.*recent/.test(q)){if(!cows.length)return say('Não há vacas leiteiras cadastradas.');const since=new Date(`${today}T12:00:00Z`);since.setUTCDate(since.getUTCDate()-7);const stale=cows.filter(a=>a.status==='ativo'&&!individual.some(x=>x.animal_id===a.id&&text(x.data_producao)>=since.toISOString().slice(0,10)));return say(stale.length?`${stale.length} ${stale.length===1?'vaca':'vacas'} sem produção individual nos últimos 7 dias: ${stale.map(identity).join(', ')}.`:'Todas as vacas ativas têm produção individual nos últimos 7 dias.');}
 if(/queda/.test(q)){
  const declined=cows.map(a=>{const days=[...new Set(individual.filter(x=>x.animal_id===a.id).map(x=>text(x.data_producao)))].sort().reverse();if(days.length<2)return null;const newest=individual.filter(x=>x.animal_id===a.id&&x.data_producao===days[0]).reduce((s,x)=>s+Number(x.litros),0),prior=individual.filter(x=>x.animal_id===a.id&&x.data_producao===days[1]).reduce((s,x)=>s+Number(x.litros),0);return newest<prior?{a,drop:prior-newest,from:days[1],to:days[0]}:null}).filter((x):x is {a:Row;drop:number;from:string;to:string}=>x!=null).sort((a,b)=>b.drop-a.drop);
  return say(declined.length?`${identity(declined[0].a)} teve a maior queda entre dias registrados: ${number(declined[0].drop,1)} L (${formatDate(declined[0].from)} → ${formatDate(declined[0].to)}).`:'Não há dois dias individuais comparáveis com queda de produção registrada.');
 }
 if(!totals.length)return say(`Não há produção individual por vaca registrada ${p.label}. Registros do tanque não permitem comparar vacas.`);
 const by=totals.map(x=>({a:x.a,liters:x.rows.reduce((s,r)=>s+Number(r.litros),0),days:new Set(x.rows.map(r=>r.data_producao)).size,revenue:x.rows.filter(r=>r.preco_litro!=null).reduce((s,r)=>s+Number(r.litros)*Number(r.preco_litro),0),priced:x.rows.some(r=>r.preco_litro!=null)}));
 const metric=/media diaria/.test(q)?'average':/receita/.test(q)?'revenue':'liters';const eligible=by.filter(x=>metric!=='revenue'||x.priced).sort((a,b)=>(metric==='average'?b.liters/b.days-a.liters/a.days:metric==='revenue'?b.revenue-a.revenue:b.liters-a.liters)||identity(a.a).localeCompare(identity(b.a)));
 if(!eligible.length)return say('Não há preço por litro informado para estimar receita por vaca.');
 if(/produz menos|menor producao/.test(q))eligible.reverse();
 const label=(x:typeof eligible[number])=>metric==='average'?`${number(x.liters/x.days,1)} L por dia registrado`:metric==='revenue'?money(x.revenue):`${number(x.liters,1)} L`;
 if(/liste|quais|\b\d+\b.*vacas|\bcinco\b/.test(q))return say(`${eligible.slice(0,Math.min(10,Number(/\b(\d{1,2})\s+vacas/.exec(q)?.[1]||5))).map(x=>`${identity(x.a)}: ${label(x)}`).join('; ')} ${p.label}.`);
 return say(`${identity(eligible[0].a)} ${/menos|menor/.test(q)?'teve a menor':'teve a maior'} ${metric==='average'?'média diária':metric==='revenue'?'receita estimada':'produção individual'} ${p.label}: ${label(eligible[0])}.`);
}

export async function individualAnswer(db:Db,farmId:string,question:string):Promise<Reply|null> {
 const q=normalized(question),today=brazilToday();
 const calf=/cria|bezerra|bezerro|desmam/.test(q);
 const dairy=/vaca|leite|lactac|seca|prenh|parir|parto|produz|compar|ultima producao|producao d[aeo]/.test(q);
 const tag=/\b[bc]\d{2,5}\b/.test(q);
 const beef=/animal|animais|gado de corte|novilha|brinco|pesad|mais leve|gmd|pesagem|peso final/.test(q);
 const individualDairy=/qual vaca|quais vacas|vaca [a-z0-9]+|produz mais|produz menos|produziram mais|produziu|maior media diaria|queda de producao|producao individual|producao d[aeo]|ultima producao|sem producao|cria|bezerro|desmam|parto|lactac|seca|prenh|parir|compar/.test(q);
 if(calf)return dairyAnswer(db,farmId,q,today,true);
 if(tag)return beefAnswer(db,farmId,q,today);
 if(dairy&&individualDairy)return dairyAnswer(db,farmId,q,today,false);
 const lotSummary=/peso medio|media.*lote|gmd medio.*lote|quanto falta.*lote|quanto.*investi.*lote|custo por cabeca|valor estimado.*lote/.test(q);
 if((tag||beef)&&!lotSummary&&!/gastei|despesa|lucro|margem/.test(q))return beefAnswer(db,farmId,q,today);
 return null;
}
