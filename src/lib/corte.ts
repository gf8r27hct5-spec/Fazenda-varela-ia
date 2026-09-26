export type Animal = { id: string; identificacao: string; data_entrada?: string | null; peso_entrada?: number | null; peso_atual?: number | null; valor_compra?: number | null; status?: string; lote_id?: string | null };
export type Weight = { animal_id?: string | null; data_pesagem: string; peso_kg: number; observacoes?: string | null; responsavel?: string | null };
export type Health = { id: string; animal_id: string | null; tipo: string; produto: string | null; data_manejo: string; proxima_data?: string | null; data_fim?: string | null; data_fim_carencia?: string | null };
export type Exit = { animal_id: string; lote_id?: string | null; data_saida: string; tipo: string; peso_final?: number | null; rendimento_carcaca?: number | null; valor_venda: number; frete: number; outras_despesas: number };
const n = (value: number | string | null | undefined) => value == null ? null : Number(value);
export function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end.slice(0,10)}T12:00:00Z`)-Date.parse(`${start.slice(0,10)}T12:00:00Z`))/86400000);
}
export const brazilToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function weightStats(animal: Animal, rows: Weight[], goal?: number | null) {
  const sorted = [...rows].filter(row => row.animal_id === animal.id).sort((a,b) => a.data_pesagem.localeCompare(b.data_pesagem));
  const entries = sorted.map((row,index) => {
    const prior = [...sorted.slice(0,index)].reverse().find(item => item.data_pesagem < row.data_pesagem);
    const baseline = prior || (animal.data_entrada && animal.peso_entrada != null && animal.data_entrada < row.data_pesagem ? {data_pesagem: animal.data_entrada,peso_kg:animal.peso_entrada} : null);
    const elapsed = baseline ? daysBetween(baseline.data_pesagem,row.data_pesagem) : null;
    return {...row,gain: baseline ? Number(row.peso_kg)-Number(baseline.peso_kg) : null,gmd: elapsed && elapsed>0 ? (Number(row.peso_kg)-Number(baseline!.peso_kg))/elapsed : null};
  });
  const last = entries.at(-1), current = last ? Number(last.peso_kg) : n(animal.peso_atual) ?? n(animal.peso_entrada);
  const gain = current != null && animal.peso_entrada != null ? current-Number(animal.peso_entrada) : null;
  const days = daysBetween(animal.data_entrada, last?.data_pesagem || brazilToday());
  const recentGmd = last?.gmd ?? null;
  return { entries, current, gain, days, recentGmd, maximum: sorted.length ? Math.max(...sorted.map(row=>Number(row.peso_kg))) : n(animal.peso_entrada),
    remaining: goal != null && current != null ? Number(goal)-current : null,
    progress: goal && current != null ? Math.min(100,Math.max(0,current/Number(goal)*100)) : null,
    projectedDays: goal != null && current != null && recentGmd != null && recentGmd>0 ? Math.max(0,Math.ceil((Number(goal)-current)/recentGmd)) : null };
}
export function lotWeights(animals: Animal[], rows: Weight[]) {
  const active=animals.filter(a=>a.status==='ativo');
  const current=active.map(a=>({animal:a,stat:weightStats(a,rows)}));
  const known=current.filter(({stat})=>stat.current!=null);
  const total=known.length ? known.reduce((x,{stat})=>x+stat.current!,0) : null;
  const recentSince=Date.parse(`${brazilToday()}T12:00:00Z`)-30*86400000;
  const recent=current.filter(({stat})=>stat.entries.some(row=>Date.parse(`${row.data_pesagem}T12:00:00Z`)>=recentSince)).length;
  const gmDs=current.map(({stat})=>stat.recentGmd).filter((x):x is number=>x!=null);
  const days=[...new Set(rows.filter(row=>active.some(a=>a.id===row.animal_id)).map(row=>row.data_pesagem))].sort();
  const chart=days.map(day=>{
    const measured=active.map(animal=>{
      const last=rows.filter(row=>row.animal_id===animal.id && row.data_pesagem<=day).sort((a,b)=>a.data_pesagem.localeCompare(b.data_pesagem)).at(-1);
      return last ? Number(last.peso_kg) : (animal.data_entrada && animal.data_entrada<=day ? n(animal.peso_entrada) : null);
    }).filter((x):x is number=>x!=null);
    return {day,average:measured.length ? measured.reduce((a,b)=>a+b,0)/measured.length : null,count:measured.length};
  });
  return {total,average:total!=null ? total/known.length : null,known:known.length,recent,stale:active.length-recent,gmd:gmDs.length?gmDs.reduce((a,b)=>a+b,0)/gmDs.length:null,chart};
}
export function healthAlerts(rows: Health[]) {
  const today=brazilToday(), soon=new Date(Date.parse(`${today}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);
  return {next:rows.filter(x=>x.proxima_data && x.proxima_data>=today && x.proxima_data<=soon), overdue:rows.filter(x=>x.proxima_data && x.proxima_data<today),
    ongoing:rows.filter(x=>x.tipo==='medicamento' && x.data_manejo<=today && x.data_fim && x.data_fim>=today),
    withdrawal:rows.filter(x=>x.data_fim_carencia && x.data_manejo<=today && x.data_fim_carencia>=today)};
}
export function exitEconomics(animal: Animal, exit: Exit, costs: {tipo: string;valor: number;origem?: string | null}[]) {
  const initial=n(animal.peso_entrada), final=n(exit.peso_final), gain=initial!=null&&final!=null?final-initial:null;
  const days=daysBetween(animal.data_entrada,exit.data_saida);
  const linked=costs.filter(x=>x.tipo==='despesa' && x.origem!=='saida').reduce((s,x)=>s+Number(x.valor),0);
  const purchase=n(animal.valor_compra), total=purchase!=null ? purchase+linked+Number(exit.frete)+Number(exit.outras_despesas) : null;
  const revenue=Number(exit.valor_venda), profit=total!=null ? revenue-total : null;
  return {initial,final,gain,days,gmd:gain!=null&&days&&days>0?gain/days:null,purchase,linked,total,
    costPerKg:total!=null&&gain!=null&&gain>0?total/gain:null,costPerArroba:total!=null&&gain!=null&&gain>0&&exit.rendimento_carcaca?total/(gain*Number(exit.rendimento_carcaca)/100/15):null,
    revenue,profit,margin:profit!=null&&revenue>0?profit/revenue*100:null,roi:profit!=null&&total!=null&&total>0?profit/total*100:null,
    priceKg:final!=null&&final>0?revenue/final:null,priceArroba:final!=null&&final>0&&exit.rendimento_carcaca?revenue/(final*Number(exit.rendimento_carcaca)/100/15):null};
}
