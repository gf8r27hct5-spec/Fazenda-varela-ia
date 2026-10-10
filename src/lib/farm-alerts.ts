import { brazilToday, daysBetween, weightStats, type Animal, type Weight } from '@/lib/corte';
import { milkDailyTotals } from '@/lib/farm';
import { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;
export type AlertSeverity = 'critico' | 'atencao' | 'informacao';
export type FarmAlert = {
  id: string; severity: AlertSeverity; module: string; title: string; reason: string;
  evidence: string; date: string; action: string; href: string;
};
export type AlertSettings = {
  dias_sem_pesagem: number; antecedencia_vacina: number; antecedencia_parto: number;
  idade_desmame: number; estoque_minimo_padrao: number; dias_estoque: number;
  queda_producao_pct: number; aumento_despesa_pct: number; gmd_minimo: number;
};
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  dias_sem_pesagem: 30, antecedencia_vacina: 14, antecedencia_parto: 21,
  idade_desmame: 90, estoque_minimo_padrao: 0, dias_estoque: 7,
  queda_producao_pct: 20, aumento_despesa_pct: 30, gmd_minimo: 0.5,
};
export const ALERT_SETTING_LIMITS: Record<keyof AlertSettings, [number,number]> = {
  dias_sem_pesagem:[1,365], antecedencia_vacina:[1,90], antecedencia_parto:[1,90],
  idade_desmame:[15,365], estoque_minimo_padrao:[0,100000], dias_estoque:[1,90],
  queda_producao_pct:[1,90], aumento_despesa_pct:[1,500], gmd_minimo:[0,5],
};
export type AlertRows = {animais:Row[];lotes:Row[];pesagens:Row[];manejos:Row[];producao_leite:Row[];estoque:Row[];movimentacoes_estoque:Row[];transacoes:Row[]};
const day=(value:unknown)=>typeof value==='string'?value.slice(0,10):'';
const value=(v:unknown)=>v==null?null:Number(v);
const n=(v:unknown)=>Number(v||0);
const label=(row:Row)=>String(row.nome||row.identificacao||row.descricao||'Registro');
const fmt=(v:number,places=1)=>v.toLocaleString('pt-BR',{maximumFractionDigits:places});
const br=(d:string)=>d ? `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}` : 'sem data';
const plus=(d:string,days:number)=>new Date(Date.parse(`${d}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const elapsed=(from:string,to:string)=>daysBetween(from,to);
const positiveDays=(from:string,to:string)=>{const d=elapsed(from,to);return d!=null&&d>=0?d:null};

export function calculateFarmAlerts(rows:AlertRows,settings:AlertSettings=DEFAULT_ALERT_SETTINGS,today=brazilToday()):FarmAlert[] {
  const alerts:FarmAlert[]=[];
  const add=(severity:AlertSeverity,module:string,id:string,title:string,reason:string,evidence:string,date:string,action:string,href:string)=>alerts.push({id:`${module}:${id}`,severity,module,title,reason,evidence,date,action,href});
  const cattle=rows.animais.filter(a=>a.sistema==='corte'&&a.status==='ativo');
  const dairy=rows.animais.filter(a=>a.sistema==='leite'&&a.status==='ativo');
  const lots=rows.lotes.filter(l=>l.sistema==='corte'&&l.ativo!==false);
  const lotById=new Map(lots.map(l=>[String(l.id),l]));
  const weightsByAnimal=new Map<string,Row[]>();
  for(const w of rows.pesagens){if(!w.animal_id||day(w.data_pesagem)>today)continue;const id=String(w.animal_id);weightsByAnimal.set(id,[...(weightsByAnimal.get(id)||[]),w]);}
  for(const weights of weightsByAnimal.values())weights.sort((a,b)=>day(a.data_pesagem).localeCompare(day(b.data_pesagem)));
  const animalHref=(a:Row)=>`/animais/${a.id}`;
  const byLot=new Map<string,Row[]>();
  for(const a of cattle){if(a.lote_id){const id=String(a.lote_id);byLot.set(id,[...(byLot.get(id)||[]),a]);}}
  for(const a of cattle){
    const weights=weightsByAnimal.get(String(a.id))||[];
    const last=weights.at(-1),baseline=day(last?.data_pesagem)||day(a.data_entrada);
    const age=positiveDays(baseline,today),href=animalHref(a),name=label(a);
    if(age!=null&&age>settings.dias_sem_pesagem) add('atencao','Corte',`pesagem:${a.id}`,`${name} sem pesagem recente`,`Última pesagem ou entrada há ${age} dias.`,`Última referência: ${br(baseline)}`,today,'Registrar pesagem',href);
    const lot=lotById.get(String(a.lote_id)),goal=value(lot?.peso_meta);
    const stat=weightStats(a as Animal,weights as Weight[],goal);
    if(stat.recentGmd!=null&&stat.recentGmd<settings.gmd_minimo&&day(last?.data_pesagem)>=plus(today,-settings.dias_sem_pesagem))
      add('atencao','Corte',`gmd:${a.id}`,`GMD baixo: ${name}`,`Abaixo do limite configurado de ${fmt(settings.gmd_minimo,2)} kg/dia.`,`GMD recente: ${fmt(stat.recentGmd,2)} kg/dia`,day(last?.data_pesagem),'Ver evolução',href);
    if(goal!=null&&stat.current!=null){
      const diff=goal-stat.current;
      if(diff<=0)add('informacao','Corte',`meta:${a.id}`,`${name} atingiu a meta`,`O peso conhecido alcançou ou passou a meta do lote.`,`${fmt(stat.current)} kg · meta ${fmt(goal)} kg`,day(last?.data_pesagem)||baseline,'Ver animal',href);
      else if(diff<=Math.max(10,goal*0.05))add('informacao','Corte',`perto:${a.id}`,`${name} perto da meta`,`Falta até 5% da meta de peso.`,`Faltam ${fmt(diff)} kg · meta ${fmt(goal)} kg`,day(last?.data_pesagem)||baseline,'Ver animal',href);
    }
  }
  for(const lot of lots){
    const members=byLot.get(String(lot.id))||[];if(!members.length)continue;
    const href=`/lotes/${lot.id}`,recent=members.map(a=>weightsByAnimal.get(String(a.id))?.at(-1)).filter(Boolean) as Row[];
    const last=recent.map(w=>day(w.data_pesagem)).sort().at(-1)||day(lot.data_entrada);
    const age=positiveDays(last,today);
    if(age!=null&&age>settings.dias_sem_pesagem)add('atencao','Corte',`lote:${lot.id}`,`${label(lot)} sem pesagem recente`,`Nenhum animal do lote foi pesado no período configurado.`,`Última referência: ${br(last)}`,today,'Abrir lote',href);
    const known=members.map(a=>({a,stat:weightStats(a as Animal,(weightsByAnimal.get(String(a.id))||[]) as Weight[])})).filter(x=>x.stat.current!=null);
    if(known.length>=3){const avg=known.reduce((s,x)=>s+x.stat.current!,0)/known.length;
      for(const {a,stat} of known)if(stat.current!<avg*0.85)add('atencao','Corte',`media:${a.id}`,`${label(a)} abaixo da média de ${label(lot)}`,`Peso conhecido mais de 15% abaixo da média dos ${known.length} animais com peso.`,`${fmt(stat.current!)} kg · média ${fmt(avg)} kg`,today,'Ver animal',animalHref(a));}
    const intervals=known.map(({a})=>{const ws=weightsByAnimal.get(String(a.id))||[];const distinct=ws.filter((w,i)=>i===0||day(w.data_pesagem)>day(ws[i-1].data_pesagem));if(distinct.length<3)return null;const last3=distinct.slice(-3);const priorDays=elapsed(day(last3[0].data_pesagem),day(last3[1].data_pesagem)),currentDays=elapsed(day(last3[1].data_pesagem),day(last3[2].data_pesagem));return priorDays&&currentDays&&priorDays>0&&currentDays>0?{prior:(n(last3[1].peso_kg)-n(last3[0].peso_kg))/priorDays,current:(n(last3[2].peso_kg)-n(last3[1].peso_kg))/currentDays}:null;}).filter((x):x is {prior:number;current:number}=>x!=null);
    if(intervals.length>=3){const prev=intervals.reduce((s,x)=>s+x.prior,0)/intervals.length,now=intervals.reduce((s,x)=>s+x.current,0)/intervals.length;if(prev>0&&now<prev*0.8)add('atencao','Corte',`queda-gmd:${lot.id}`,`GMD médio caiu em ${label(lot)}`,`Comparação das duas últimas variações de ${intervals.length} animais com três pesagens.`,`${fmt(prev,2)} → ${fmt(now,2)} kg/dia`,today,'Ver lote',href);}
  }
  const animalById=new Map(rows.animais.map(a=>[String(a.id),a]));
  for(const m of rows.manejos){const applied=day(m.data_manejo);if(!applied||applied>today)continue;const a=m.animal_id?animalById.get(String(m.animal_id)):null,lot=m.lote_id?lotById.get(String(m.lote_id)):null;
    if(a&&a.status!=='ativo'||a?.sistema==='leite'&&a.categoria==='Cria leiteira'&&a.situacao_cria==='morta')continue;
    const target=a?label(a):lot?label(lot):'Fazenda',href=a?animalHref(a):lot?`/lotes/${lot.id}`:'/painel/sanidade';
    const next=day(m.proxima_data),withdraw=day(m.data_fim_carencia),finish=day(m.data_fim),product=String(m.produto||m.tipo||'manejo');
    if(next){const remaining=elapsed(today,next);if(remaining!=null&&remaining<0)add('critico','Sanidade',`atrasado:${m.id}`,`Manejo atrasado: ${target}`,`Reforço ou manejo de ${product} passou da data prevista.`,`Previsto para ${br(next)}`,next,'Ver sanidade',href);
      else if(remaining!=null&&remaining<=settings.antecedencia_vacina)add('atencao','Sanidade',`reforco:${m.id}`,`Reforço próximo: ${target}`,`Aplicação de ${product} prevista em ${remaining} dias.`,`Previsto para ${br(next)}`,next,'Ver sanidade',href);}
    if(String(m.tipo).toLowerCase().includes('medicamento')&&finish&&applied<=today&&finish>=today)add('atencao','Sanidade',`tratamento:${m.id}`,`Tratamento em andamento: ${target}`,`Tratamento com ${product} ainda em curso.`,`Fim previsto: ${br(finish)}`,today,'Ver tratamento',href);
    if(withdraw&&withdraw>=today){add('critico','Sanidade',`carencia:${m.id}`,`${target} em carência`,`Período de carência registrado para ${product}.`,`Carência até ${br(withdraw)}`,today,'Ver registro',href);
      const left=elapsed(today,withdraw);if(left!=null&&left<=3)add('informacao','Sanidade',`carencia-fim:${m.id}`,`Carência perto do fim: ${target}`,`Restam ${left} dias para a data final registrada.`,`Fim: ${br(withdraw)}`,today,'Ver registro',href);}
  }
  const lactating=dairy.filter(a=>a.categoria!=='Cria leiteira'&&String(a.situacao_leite||'').toLowerCase().includes('lact'));
  const milk=rows.producao_leite.filter(x=>day(x.data_producao)<=today);
  const daily=milkDailyTotals(milk as {data_producao:string;animal_id:string|null;litros:number}[]);
  const complete=daily.filter(x=>x.day<today),latest=complete.at(-1),history=complete.slice(-8,-1);
  if(latest&&elapsed(latest.day,today)!<=2&&history.length>=3){const avg=history.reduce((s,x)=>s+x.liters,0)/history.length;if(avg>0&&latest.liters<avg*(1-settings.queda_producao_pct/100))add('atencao','Leite','queda-total','Produção de leite caiu',`Comparação com a média de ${history.length} dias registrados anteriores.`,`${fmt(latest.liters)} L em ${br(latest.day)} · média ${fmt(avg)} L`,latest.day,'Ver produção','/painel/leite');}
  for(const a of dairy){const href=animalHref(a),name=label(a),id=String(a.id);
    if(a.categoria==='Cria leiteira'){
      if(a.situacao_cria==='mamando'&&day(a.data_nascimento)){const age=positiveDays(day(a.data_nascimento),today);if(age!=null&&age>=settings.idade_desmame-7)add(age>settings.idade_desmame?'atencao':'informacao','Leite',`desmame:${id}`,`${name} perto do desmame`,`Idade calculada a partir do nascimento; confirme a avaliação antes de desmamar.`,`${age} dias · referência ${settings.idade_desmame} dias`,today,'Ver cria',href);}
      const last=weightsByAnimal.get(id)?.at(-1),baseline=day(last?.data_pesagem)||day(a.data_nascimento);const age=positiveDays(baseline,today);
      if(age!=null&&age>settings.dias_sem_pesagem)add('atencao','Leite',`cria-peso:${id}`,`${name} sem peso recente`,`Cria sem pesagem dentro do prazo configurado.`,`Última referência: ${br(baseline)}`,today,'Ver cria',href);
      continue;
    }
    const own=milk.filter(x=>x.animal_id===a.id).sort((x,y)=>day(x.data_producao).localeCompare(day(y.data_producao)));
    const last=own.at(-1),age=last?positiveDays(day(last.data_producao),today):null;
    if(lactating.includes(a)&&age!=null&&age>3)add('atencao','Leite',`vaca-sem-leite:${id}`,`${name} sem produção recente`,`Não há registro individual desta vaca há mais de 3 dias.`,`Último: ${br(day(last?.data_producao))}`,today,'Ver vaca',href);
    const prior=own.filter(x=>day(x.data_producao)<day(last?.data_producao)).slice(-3);
    if(last&&age!=null&&age<=3&&prior.length>=3){const avg=prior.reduce((s,x)=>s+n(x.litros),0)/prior.length;if(avg>0&&n(last.litros)<avg*(1-settings.queda_producao_pct/100))add('atencao','Leite',`queda-vaca:${id}`,`Produção de ${name} caiu`,`Comparação com os três registros individuais anteriores.`,`${fmt(n(last.litros))} L · média anterior ${fmt(avg)} L`,day(last.data_producao),'Ver vaca',href);}
    if(a.prenhe&&day(a.proxima_previsao_parto)){const due=day(a.proxima_previsao_parto),remaining=elapsed(today,due);if(remaining!=null&&remaining<0)add('critico','Leite',`parto-atrasado:${id}`,`Parto previsto de ${name} passou`,`Data estimada do parto já passou; confira a situação da vaca.`,`Previsto para ${br(due)}`,due,'Ver reprodução',href);
      else if(remaining!=null&&remaining<=settings.antecedencia_parto)add('atencao','Leite',`parto:${id}`,`Parto de ${name} próximo`,`Previsão registrada para daqui a ${remaining} dias.`,`Previsto para ${br(due)}`,due,'Ver reprodução',href);}
  }
  const stockMoves=rows.movimentacoes_estoque.filter(x=>day(x.data_movimentacao)<=today);
  for(const item of rows.estoque.filter(x=>x.ativo!==false)){const qty=value(item.quantidade_atual);if(qty==null)continue;const min=value(item.estoque_minimo)??settings.estoque_minimo_padrao,unit=String(item.unidade||'unidades'),href='/painel/estoque',name=label(item),id=String(item.id);
    if(qty<=min)add('critico','Estoque',`minimo:${id}`,`${name} abaixo do mínimo`,`Quantidade atual atingiu o limite do item ou o padrão da fazenda.`,`${fmt(qty)} ${unit} · mínimo ${fmt(min)} ${unit}`,today,'Ver estoque',href);
    const rate=value(item.consumo_medio_dia);if(rate!=null&&rate>0){const days=qty/rate;if(days<=settings.dias_estoque)add('atencao','Estoque',`dias:${id}`,`${name} perto de acabar`,`Previsão baseada no consumo médio cadastrado.`,`${fmt(days)} dias restantes · ${fmt(rate)} ${unit}/dia`,today,'Ver item',href);}
    const used=stockMoves.filter(x=>x.estoque_id===item.id&&x.tipo==='saida'),recent=used.filter(x=>day(x.data_movimentacao)>=plus(today,-7)),earlier=used.filter(x=>day(x.data_movimentacao)<plus(today,-7)&&day(x.data_movimentacao)>=plus(today,-35));
    if(recent.length&&earlier.length>=3){const weekly=recent.reduce((s,x)=>s+n(x.quantidade),0),baseline=earlier.reduce((s,x)=>s+n(x.quantidade),0)/4;if(baseline>0&&weekly>baseline*1.5)add('atencao','Estoque',`consumo:${id}`,`Consumo de ${name} acima do padrão`,`Saídas dos últimos 7 dias superaram em mais de 50% a média semanal das quatro semanas anteriores.`,`${fmt(weekly)} ${unit}/semana · padrão ${fmt(baseline)} ${unit}`,today,'Ver movimentações',href);}
  }
  const expenses=rows.transacoes.filter(x=>x.tipo==='despesa'&&x.status!=='cancelado'&&day(x.data_competencia)<=today);
  for(const tx of expenses){if(tx.status==='pago'||!day(tx.data_vencimento))continue;const due=day(tx.data_vencimento),left=elapsed(today,due),href='/painel/financeiro';if(left!=null&&left<0)add('critico','Financeiro',`vencida:${tx.id}`,`Conta vencida: ${label(tx)}`,`Despesa não marcada como paga e prazo ultrapassado.`,`${fmt(n(tx.valor),2)} reais · venceu em ${br(due)}`,due,'Ver lançamento',href);
    else if(left!=null&&left<=7)add('atencao','Financeiro',`vencimento:${tx.id}`,`Conta próxima: ${label(tx)}`,`Vencimento em ${left} dias.`,`${fmt(n(tx.valor),2)} reais · vence em ${br(due)}`,due,'Ver lançamento',href);}
  const recentExpenses=expenses.filter(x=>day(x.data_competencia)>=plus(today,-30));
  for(const tx of recentExpenses){const older=expenses.filter(x=>x.id!==tx.id&&x.categoria===tx.categoria&&day(x.data_competencia)<day(tx.data_competencia)&&day(x.data_competencia)>=plus(day(tx.data_competencia),-90));if(older.length<3)continue;const avg=older.reduce((s,x)=>s+n(x.valor),0)/older.length;if(avg>0&&n(tx.valor)>avg*(1+settings.aumento_despesa_pct/100))add('atencao','Financeiro',`despesa:${tx.id}`,`Despesa acima da média: ${label(tx)}`,`Comparação com ${older.length} lançamentos anteriores da mesma categoria.`,`${fmt(n(tx.valor),2)} reais · média ${fmt(avg,2)} reais`,day(tx.data_competencia),'Ver lançamento','/painel/financeiro');}
  const categories=new Set(recentExpenses.map(x=>String(x.categoria||'')));
  for(const category of categories){if(!category)continue;const current=recentExpenses.filter(x=>x.categoria===category),previous=expenses.filter(x=>x.categoria===category&&day(x.data_competencia)<plus(today,-30)&&day(x.data_competencia)>=plus(today,-60));if(current.length<2||previous.length<2)continue;const now=current.reduce((s,x)=>s+n(x.valor),0),prior=previous.reduce((s,x)=>s+n(x.valor),0);if(prior>0&&now>prior*(1+settings.aumento_despesa_pct/100))add('atencao','Financeiro',`categoria:${category}`,`${category} aumentou`,`Gasto dos últimos 30 dias comparado aos 30 dias anteriores.`,`${fmt(now,2)} reais · antes ${fmt(prior,2)} reais`,today,'Ver financeiro','/painel/financeiro');}
  const month=today.slice(0,7),currentTx=rows.transacoes.filter(x=>x.status!=='cancelado'&&day(x.data_competencia).startsWith(month)&&day(x.data_competencia)<=today);
  if(currentTx.length){const result=currentTx.reduce((s,x)=>s+(x.tipo==='receita'?n(x.valor):x.tipo==='despesa'?-n(x.valor):0),0);if(result<0)add('atencao','Financeiro','resultado',`Resultado do mês negativo`,`Receitas menos despesas registradas neste mês.`,`${fmt(result,2)} reais em ${month}`,today,'Ver financeiro','/painel/financeiro');}
  const severityOrder={critico:0,atencao:1,informacao:2};
  return alerts.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'pt-BR'));
}

const columns:Record<keyof AlertRows,string>={
 animais:'id,identificacao,nome,sistema,status,lote_id,data_entrada,peso_entrada,peso_atual,categoria,situacao_leite,prenhe,proxima_previsao_parto,data_nascimento,situacao_cria',
 lotes:'id,nome,sistema,ativo,data_entrada,peso_meta',pesagens:'id,animal_id,lote_id,data_pesagem,peso_kg',
 manejos:'id,animal_id,lote_id,tipo,produto,data_manejo,proxima_data,data_fim,data_fim_carencia',
 producao_leite:'id,animal_id,data_producao,litros',estoque:'id,nome,unidade,quantidade_atual,estoque_minimo,consumo_medio_dia,ativo',
 movimentacoes_estoque:'id,estoque_id,tipo,quantidade,data_movimentacao',
 transacoes:'id,tipo,categoria,descricao,valor,data_competencia,data_vencimento,status',
};
export async function getFarmAlertSettings(db:Db,farmId:string):Promise<AlertSettings>{
 const {data,error}=await db.from('configuracoes_alertas').select('*').eq('fazenda_id',farmId).maybeSingle();
 if(error)throw new Error('Não foi possível carregar as configurações dos alertas.');
 return {...DEFAULT_ALERT_SETTINGS,...Object.fromEntries(Object.keys(DEFAULT_ALERT_SETTINGS).map(key=>[key,data?.[key]??DEFAULT_ALERT_SETTINGS[key as keyof AlertSettings]]))} as AlertSettings;
}
export async function getFarmAlerts(db:Db,farmId:string){
 const [settings,...results]=await Promise.all([getFarmAlertSettings(db,farmId),...Object.entries(columns).map(([table,select])=>db.from(table).select(select).eq('fazenda_id',farmId).limit(1001))]);
 const entries=Object.keys(columns).map((key,index)=>{const result=results[index];if(result.error)throw new Error(`Falha ao consultar alertas de ${key}.`);if((result.data||[]).length>1000)throw new Error(`Há muitos registros em ${key} para analisar. Refine o período.`);return [key,result.data||[]];});
 return {settings,alerts:calculateFarmAlerts(Object.fromEntries(entries) as AlertRows,settings)};
}
