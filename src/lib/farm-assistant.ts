import { brazilToday, daysBetween, exitEconomics, healthAlerts, lotWeights, weightStats, type Animal, type Weight } from '@/lib/corte';
import { milkDailyTotals, money, monthBounds, number } from '@/lib/farm';
import { createClient } from '@/lib/supabase/server';
import { individualAnswer } from '@/lib/farm-individual';

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;
export type FarmAnswer = {answer:string; metric?:string; label?:string};
const norm=(s:string)=>s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const n=(v:unknown)=>v == null ? null : Number(v);
const val=(v:unknown)=>String(v??'');
const sum=(rows:Row[],key:string)=>rows.reduce((t,row)=>t+Number(row[key]||0),0);
const answer=(message:string,metric?:string,label?:string):FarmAnswer=>({answer:message,metric,label});
async function rows(db:Db,farmId:string,table:string,columns:string):Promise<Row[]> {
 const result=await db.from(table).select(columns).eq('fazenda_id',farmId).limit(1001);
 if(result.error)throw new Error(`Não foi possível consultar ${table}.`);
 if((result.data||[]).length>1000)throw new Error('Há mais registros do que consigo conferir nesta consulta. Refine a pergunta.');
 return (result.data||[]) as unknown as Row[];
}
export async function farmAnswer(db:Db,farmId:string,question:string):Promise<FarmAnswer> {
 const q=norm(question),{start,end}=monthBounds(),today=brazilToday();
 const individual=await individualAnswer(db,farmId,question);
 if(individual)return individual;
 const before30=new Date(Date.parse(`${today}T12:00:00Z`)-30*86400000).toISOString().slice(0,10);
 const is=(pattern:RegExp)=>pattern.test(q);
 // Resolve human-readable lot names only against this authenticated farm; never accept model-supplied IDs.
 if(is(/lote|novilha|animal|rebanho|peso|gmd|pesagem|arroba|cabeca|investi/) && !is(/leite|vaca|cria|parto|estoque|vacina|ivermectina|tratamento|carencia|manejo|gastei|despesa|combustivel|sal mineral|vendid|venda|saida|melhor resultado|lucro|margem/)) {
  const lots=await rows(db,farmId,'lotes','id,nome,peso_meta,sistema');
  const beefLots=lots.filter(x=>val(x.sistema||'corte')==='corte');
  const matched=beefLots.filter(x=>q.includes(norm(val(x.nome))));
  const lot=matched.sort((a,b)=>val(b.nome).length-val(a.nome).length)[0] || (beefLots.length===1?beefLots[0]:null);
  if(!lot)return answer('Não identifiquei o lote. Informe o nome do lote de corte na pergunta.');
  const all=await rows(db,farmId,'animais','id,lote_id,identificacao,sistema,status,data_entrada,peso_entrada,peso_atual,valor_compra');
  const animals=all.filter(x=>x.lote_id===lot.id && val(x.sistema||'corte')==='corte') as unknown as Animal[];
  const active=animals.filter(x=>x.status==='ativo');
  if(!active.length)return answer(`Não há animais ativos registrados em ${val(lot.nome)}.`);
  const weights=(await rows(db,farmId,'pesagens','animal_id,data_pesagem,peso_kg')).filter(x=>active.some(a=>a.id===x.animal_id)) as unknown as Weight[];
  const stats=lotWeights(active,weights),name=val(lot.nome),goal=n(lot.peso_meta);
  if(is(/mais perto|proxim[oa].*meta/)) {
   if(goal==null)return answer(`A meta de peso de ${name} não foi informada.`);
   const ranked=active.map(a=>({a,s:weightStats(a,weights,goal)})).filter(x=>x.s.current!=null).sort((a,b)=>Math.abs(a.s.remaining!)-Math.abs(b.s.remaining!));
   return ranked.length?answer(`${ranked[0].a.identificacao} está mais perto da meta de ${number(goal,1)} kg: pesa ${number(ranked[0].s.current,1)} kg e faltam ${number(Math.max(0,ranked[0].s.remaining!),1)} kg.`):answer(`Nenhum animal de ${name} tem peso registrado.`);
  }
  if(is(/sem pesagem|pesagem recente|nao pesad/)) {
   const stale=active.filter(a=>!weights.some(w=>w.animal_id===a.id&&w.data_pesagem>=before30));
   return answer(stale.length?`${stale.length} animais de ${name} estão sem pesagem nos últimos 30 dias: ${stale.slice(0,15).map(a=>a.identificacao).join(', ')}${stale.length>15?' e outros':''}.`:`Todos os ${active.length} animais de ${name} têm pesagem nos últimos 30 dias.`,String(stale.length),'Sem pesagem recente');
  }
  if(is(/maior ganho/)) {
   const gained=active.map(a=>({a,s:weightStats(a,weights,goal)})).filter(x=>x.s.gain!=null&&x.s.gain>0).sort((a,b)=>b.s.gain!-a.s.gain!);
   return gained.length?answer(`${gained[0].a.identificacao} teve o maior ganho registrado em ${name}: ${number(gained[0].s.gain,1)} kg desde a entrada.`):answer(`Não há ganho de peso medido após a pesagem inicial em ${name}.`);
  }
  if(is(/gmd|ganho medio diario/))return stats.gmd!=null?answer(`O GMD médio calculado de ${name} é ${number(stats.gmd,2)} kg/dia, com pesagens comparáveis.`,`${number(stats.gmd,2)} kg/dia`,'GMD médio'):answer(`Não tenho pesagens em datas diferentes suficientes para calcular o GMD de ${name}.`);
  if(is(/valor estimado|vale|preco de venda/))return answer(`Não tenho preço de venda ou cotação atual registrada para estimar o valor de ${name}. O custo de compra registrado não é valor de mercado.`);
  if(is(/arroba/))return answer(`Não tenho ganho de peso e rendimento de carcaça suficientes para calcular o custo por arroba produzida em ${name}.`);
  if(is(/investi|custo total|custo por cabeca|compra/)){
   const known=active.filter(a=>a.valor_compra!=null);
   if(!known.length)return answer(`Não há custo de compra registrado para os animais ativos de ${name}.`);
   const costs=await rows(db,farmId,'transacoes','lote_id,animal_id,tipo,valor,origem');
   const linked=costs.filter(x=>x.tipo==='despesa'&&(x.lote_id===lot.id||active.some(a=>a.id===x.animal_id))&&x.origem!=='saida');
   const total=active.reduce((t,a)=>t+Number(a.valor_compra||0),0)+sum(linked,'valor');
   const qualifier=known.length===active.length?'':` (${known.length} de ${active.length} compras conhecidas)`;
   return is(/por cabeca/)?answer(`O custo registrado por cabeça ativa de ${name} é ${money(total/active.length)}${qualifier}, incluindo compras e despesas vinculadas.`,money(total/active.length),'Custo por cabeça'):answer(`O investimento registrado em ${name} é ${money(total)}${qualifier}, incluindo compras e despesas vinculadas.`,money(total),'Investimento registrado');
  }
  if(is(/falta|resta.*meta/))return goal!=null&&stats.average!=null?answer(`Faltam ${number(Math.max(0,goal-stats.average),1)} kg por animal, em média, para ${name} chegar à meta de ${number(goal,1)} kg.`,`${number(Math.max(0,goal-stats.average),1)} kg`,'Faltam por animal'):answer(`Falta informar a meta ou pesos atuais de ${name}.`);
  if(is(/peso medio|media.*peso|peso.*lote/))return stats.average!=null?answer(`O peso médio conhecido de ${name} é ${number(stats.average,1)} kg, entre ${stats.known} animais ativos com peso registrado.`,`${number(stats.average,1)} kg`,'Peso médio'):answer(`Não há pesos registrados para ${name}.`);
  return answer(`Em ${name} há ${active.length} animais ativos. Pergunte pelo peso médio, GMD, meta, custos ou pesagens recentes.`);
 }
 if(is(/carencia|reforco|vacina|ivermectina|tratamento|manejo sanitario|sanidade/)){
  const [all,animals,lots]=await Promise.all([rows(db,farmId,'manejos','id,animal_id,lote_id,tipo,produto,data_manejo,proxima_data,data_fim,data_fim_carencia'),rows(db,farmId,'animais','id,identificacao,sistema'),rows(db,farmId,'lotes','id,nome')]);
  const beef=animals.filter(x=>val(x.sistema||'corte')==='corte'),ids=new Set(beef.map(x=>x.id));
  const health=all.filter(x=>ids.has(x.animal_id)||!x.animal_id&&lots.some(l=>l.id===x.lote_id&&val(l.nome).toLowerCase().includes('lote')));
  if(!health.length)return answer('Não há manejos sanitários de gado de corte registrados.');
  const alerts=healthAlerts(health as unknown as Parameters<typeof healthAlerts>[0]);
  const tag=(x:Row)=>val(beef.find(a=>a.id===x.animal_id)?.identificacao||lots.find(l=>l.id===x.lote_id)?.nome||'Animal não identificado');
  if(is(/carencia/))return answer(alerts.withdrawal.length?`Em carência: ${alerts.withdrawal.map(x=>`${tag(x as unknown as Row)} até ${x.data_fim_carencia}`).join('; ')}.`:'Não há animais em carência nos registros sanitários atuais.');
  if(is(/reforco|vacina/)){const next=alerts.next.filter(x=>x.tipo==='vacina'),overdue=alerts.overdue.filter(x=>x.tipo==='vacina');return answer(next.length||overdue.length?`Reforços próximos: ${next.map(x=>`${tag(x as unknown as Row)} em ${x.proxima_data}`).join('; ')||'nenhum'}. Atrasados: ${overdue.map(x=>`${tag(x as unknown as Row)} em ${x.proxima_data}`).join('; ')||'nenhum'}.`:'Não há reforços de vacina programados nos registros atuais.');}
  if(is(/ivermectina/)){const matches=health.filter(x=>norm(val(x.produto)).includes('ivermectina'));return answer(matches.length?`Receberam ivermectina: ${matches.map(tag).join(', ')}.`:'Não há aplicações de ivermectina registradas.');}
  if(is(/tratamento/))return answer(alerts.ongoing.length?`Tratamentos em andamento: ${alerts.ongoing.map(x=>`${tag(x as unknown as Row)} (${x.produto||'medicamento'})`).join('; ')}.`:'Não há tratamentos em andamento registrados.');
  const lot=lots.find(x=>q.includes(norm(val(x.nome))));const latest=health.filter(x=>!lot||x.lote_id===lot.id||beef.some(a=>a.id===x.animal_id)).sort((a,b)=>val(b.data_manejo).localeCompare(val(a.data_manejo)))[0];
  return latest?answer(`Último manejo registrado: ${val(latest.produto||latest.tipo)} em ${val(latest.data_manejo)}, para ${tag(latest)}.`):answer('Não há manejo sanitário registrado para esse lote.');
 }
 if(is(/leite|litro|vaca|lactacao|prenhas?|parir|parto|cria|bezerro|desmam|quanto produzi|producao.*mes/)){
  const dairy=(await rows(db,farmId,'animais','id,sistema,identificacao,nome,status,situacao_leite,prenhe,proxima_previsao_parto,situacao_cria,data_nascimento,data_prevista_desmame,mae_id')).filter(x=>x.sistema==='leite');
  if(is(/prenh|parto previsto|previsao.*parto|parir/)){
   const pregnant=dairy.filter(x=>x.prenhe===true&&x.status==='ativo');const dated=pregnant.filter(x=>x.proxima_previsao_parto).sort((a,b)=>val(a.proxima_previsao_parto).localeCompare(val(b.proxima_previsao_parto)));
   if(is(/perto|proxima|previsao|parto previsto|parir/))return dated.length?answer(`${val(dated[0].nome||dated[0].identificacao)} tem parto previsto para ${val(dated[0].proxima_previsao_parto)} (${daysBetween(today,val(dated[0].proxima_previsao_parto))} dias).`):answer('Não há vaca prenha com previsão de parto registrada.');
   return answer(pregnant.length?`${pregnant.length} vacas prenhas registradas: ${pregnant.map(x=>val(x.nome||x.identificacao)).join(', ')}.`:'Não há vacas prenhas registradas.');
  }
  if(is(/cria|bezerro|desmam/)){
   const calves=dairy.filter(x=>x.mae_id||x.situacao_cria);
   if(is(/podem ser desmam|idade de desmam/))return answer('A idade de desmame e os critérios de manejo precisam estar registrados; não posso decidir o desmame apenas pela idade. Consulte as previsões individuais das crias.');
   const selected=calves.filter(x=>is(/desmamad/)?x.situacao_cria==='desmamada':x.situacao_cria==='mamando');
   return answer(`${selected.length} crias ${is(/desmamad/)?'desmamadas':'mamando'} registradas.`,String(selected.length),'Crias');
  }
  if(is(/lactacao|lactante/)){const lact=dairy.filter(x=>x.status==='ativo'&&norm(val(x.situacao_leite)).includes('lact'));return answer(lact.length?`${lact.length} vacas em lactação: ${lact.map(x=>val(x.nome||x.identificacao)).join(', ')}.`:'Não há vacas em lactação registradas.');}
  const milk=await rows(db,farmId,'producao_leite','animal_id,data_producao,litros');
  if(is(/qual vaca|produz mais|maior producao/)){
   const individual=milk.filter(x=>x.animal_id);if(!individual.length)return answer('Não há produção individual por vaca registrada.');
   const by=new Map<string,number>();for(const x of individual)by.set(val(x.animal_id),(by.get(val(x.animal_id))||0)+Number(x.litros));
   const [id,liters]=[...by].sort((a,b)=>b[1]-a[1])[0];const cow=dairy.find(x=>x.id===id);
   return answer(`${val(cow?.nome||cow?.identificacao||'Vaca')} tem a maior produção individual registrada: ${number(liters,1)} L no histórico disponível.`);
  }
  const daily=milkDailyTotals(milk as {animal_id:string|null;data_producao:string;litros:number}[]);
  const window=is(/hoje|dia/)?daily.filter(x=>x.day===today):daily.filter(x=>x.day>=start&&x.day<end);
  return window.length?answer(`A produção de leite ${is(/hoje|dia/)?'hoje':'neste mês'} é ${number(window.reduce((t,x)=>t+x.liters,0),1)} L.`,`${number(window.reduce((t,x)=>t+x.liters,0),1)} L`,'Produção de leite'):answer(`Não há produção de leite registrada ${is(/hoje|dia/)?'hoje':'neste mês'}.`);
 }
 if(is(/estoque|proteinado|item.*acabar|dias.*restant|combustivel.*consumid/)){
  if(is(/combustivel.*consumid/)){
   const [items,moves]=await Promise.all([rows(db,farmId,'estoque','id,nome,categoria,unidade'),rows(db,farmId,'movimentacoes_estoque','estoque_id,tipo,quantidade,data_movimentacao')]);
   const fuel=items.filter(x=>is(/combustivel|diesel|gasolina/)&&/combustivel|diesel|gasolina/.test(norm(val(x.nome)+' '+val(x.categoria))));
   const used=moves.filter(x=>fuel.some(i=>i.id===x.estoque_id)&&x.tipo==='saida'&&val(x.data_movimentacao)>=start&&val(x.data_movimentacao)<end);
   return answer(used.length?`Saíram ${number(sum(used,'quantidade'),1)} unidades de combustível do estoque neste mês. Confira a unidade de cada item se houver mais de um.`:'Não há saída de combustível registrada no estoque neste mês.');
  }
  const stock=(await rows(db,farmId,'estoque','nome,categoria,unidade,quantidade_atual,estoque_minimo,consumo_medio_dia,ativo')).filter(x=>x.ativo===true);
  if(!stock.length)return answer('Não há itens ativos cadastrados no estoque.');
  if(is(/perto de acabar|estoque baixo|item.*acabar/)){
   const low=stock.filter(x=>n(x.estoque_minimo)!=null&&Number(x.quantidade_atual)<=Number(x.estoque_minimo));
   return answer(low.length?`Estoque baixo: ${low.map(x=>`${x.nome} (${number(Number(x.quantidade_atual),1)} ${x.unidade})`).join('; ')}.`:'Nenhum item está abaixo do mínimo cadastrado.');
  }
  const selected=stock.filter(x=>is(/proteinado/)?norm(val(x.nome)).includes('proteinado'):true);
  if(!selected.length)return answer('Não há proteinado ativo cadastrado no estoque.');
  if(is(/dia/))return answer(selected.map(x=>n(x.consumo_medio_dia)&&Number(x.consumo_medio_dia)>0?`${x.nome}: cerca de ${number(Number(x.quantidade_atual)/Number(x.consumo_medio_dia),0)} dias.`:`${x.nome}: sem consumo médio registrado para prever dias restantes.`).join(' '));
  return answer(selected.map(x=>`${x.nome}: ${number(Number(x.quantidade_atual),1)} ${x.unidade}.`).join(' '));
 }
 if(is(/vendid|venda|saida|lucro.*animal|margem.*venda|animal.*melhor resultado/)){
  const sales=(await rows(db,farmId,'saidas_corte','animal_id,data_saida,tipo,peso_final,rendimento_carcaca,valor_venda,frete,outras_despesas')).filter(x=>x.tipo==='venda');
  if(!sales.length)return answer('Não há vendas de animais de corte registradas para calcular esse resultado.');
  const animals=await rows(db,farmId,'animais','id,identificacao,data_entrada,peso_entrada,valor_compra');
  const costs=await rows(db,farmId,'transacoes','animal_id,tipo,valor,origem');
  const enriched=sales.map(x=>({x,a:animals.find(a=>a.id===x.animal_id),calc:exitEconomics((animals.find(a=>a.id===x.animal_id)||{id:val(x.animal_id),identificacao:'Animal'}) as Animal,x as unknown as Parameters<typeof exitEconomics>[1],costs.filter(c=>c.animal_id===x.animal_id) as Parameters<typeof exitEconomics>[2])}));
  if(is(/peso medio/)){const weighted=sales.filter(x=>x.peso_final!=null);return answer(weighted.length?`O peso médio de saída nas ${weighted.length} vendas com peso informado é ${number(sum(weighted,'peso_final')/weighted.length,1)} kg.`:'Não há peso final registrado nas vendas.');}
  if(is(/valor medio/))return answer(`O valor médio vendido por cabeça é ${money(sum(sales,'valor_venda')/sales.length)} em ${sales.length} vendas.`);
  const known=enriched.filter(x=>x.calc.profit!=null);
  if(!known.length)return answer('Há vendas registradas, mas faltam custos de compra para calcular lucro e margem.');
  if(is(/melhor/)){known.sort((a,b)=>b.calc.profit!-a.calc.profit!);return answer(`${val(known[0].a?.identificacao||'Animal')} teve o melhor resultado conhecido: ${money(known[0].calc.profit)}.`);}
  const profit=known.reduce((t,x)=>t+x.calc.profit!,0),revenue=known.reduce((t,x)=>t+x.calc.revenue,0);
  return is(/margem/)?answer(`A margem das ${known.length} vendas com custos conhecidos é ${revenue>0?`${number(profit/revenue*100,1)}%`:'indisponível'}.`):answer(`O resultado das ${known.length} vendas com custos conhecidos é ${money(profit)}.`,money(profit),'Lucro das vendas');
 }
 if(is(/gastei|gasto|despesa|resultado|conta.*pagar|financeiro|racao|combustivel|manutencao|sal mineral/)){
  const tx=await rows(db,farmId,'transacoes','id,lote_id,tipo,categoria,descricao,valor,data_competencia,data_vencimento,status');
  if(is(/conta.*pagar/)){
   const pending=tx.filter(x=>x.tipo==='despesa'&&x.status==='pendente');
   return answer(pending.length?`Há ${pending.length} contas a pagar, no total de ${money(sum(pending,'valor'))}.`:'Não há contas a pagar registradas.',pending.length?money(sum(pending,'valor')):undefined,'Contas a pagar');
  }
  const month=tx.filter(x=>val(x.data_competencia)>=start&&val(x.data_competencia)<end),expenses=month.filter(x=>x.tipo==='despesa');
  if(is(/resultado/))return month.length?answer(`O resultado do mês é ${money(sum(month.filter(x=>x.tipo==='receita'),'valor')-sum(expenses,'valor'))}, com ${month.length} lançamentos.`,money(sum(month.filter(x=>x.tipo==='receita'),'valor')-sum(expenses,'valor')),'Resultado do mês'):answer('Não há lançamentos neste mês para calcular o resultado.');
  let selected=expenses,where='neste mês';
  if(is(/lote/)){
   const lots=await rows(db,farmId,'lotes','id,nome');const lot=lots.find(x=>q.includes(norm(val(x.nome))));if(!lot)return answer('Não identifiquei o lote mencionado.');
   selected=expenses.filter(x=>x.lote_id===lot.id);where=`com ${val(lot.nome)} neste mês`;
  } else {
   const category=is(/racao/)?/racao|alimentacao|nutricao/:is(/combustivel|diesel|gasolina/)?/combustivel|diesel|gasolina/:is(/manutencao/)?/manutencao|reparo|conserto/:is(/sal mineral/)?/sal mineral/:null;
   if(category){selected=expenses.filter(x=>category.test(norm(`${x.categoria} ${x.descricao}`)));where=`com ${is(/racao/)?'ração':is(/sal mineral/)?'sal mineral':is(/manutencao/)?'manutenção':'combustível'} neste mês`;}
  }
  if(is(/maior despesa/)){const high=[...expenses].sort((a,b)=>Number(b.valor)-Number(a.valor))[0];return high?answer(`A maior despesa do mês é ${val(high.descricao)}: ${money(Number(high.valor))}.`):answer('Não há despesas registradas neste mês.');}
  return selected.length?answer(`Você gastou ${money(sum(selected,'valor'))} ${where}, em ${selected.length} lançamentos.`,money(sum(selected,'valor')),'Despesas'):answer(`Não há despesas registradas ${where}.`);
 }
 return answer('Ainda não consigo responder essa pergunta com os dados disponíveis. Experimente perguntar sobre peso do lote, sanidade, leite, despesas, estoque ou vendas.');
}
