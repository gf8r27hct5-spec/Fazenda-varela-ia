import { Empty } from './app-shell';
export function MonthlyChart({months}:{months:{label:string;income:number;expense:number}[]}) {
  if(!months.some(x=>x.income||x.expense)) return <Empty title="Um gráfico para acompanhar sua evolução" description="As receitas e despesas aparecerão aqui após o primeiro lançamento."/>;
  const max=Math.max(1,...months.flatMap(x=>[x.income,x.expense]));
  return <div className="chart-wrap"><div className="chart-legend"><span><i className="legend-income"/>Receitas</span><span><i className="legend-expense"/>Despesas</span></div><div className="chart-grid">{months.map(x=><div className="chart-month" key={x.label}><div className="chart-pair"><span className="chart-income" title={`Receitas: R$ ${x.income}`} style={{height:`${x.income/max*100}%`}}/><span className="chart-expense" title={`Despesas: R$ ${x.expense}`} style={{height:`${x.expense/max*100}%`}}/></div><small>{x.label}</small></div>)}</div></div>;
}
export function TrendChart({points,unit=''}:{points:{label:string;value:number}[];unit?:string}) {
  if(!points.length) return <Empty title="Ainda sem histórico" description="O gráfico ganha vida conforme você registra informações reais."/>;
  const values=points.slice(-16),minimum=Math.min(...values.map(p=>p.value)),maximum=Math.max(...values.map(p=>p.value));
  const pos=values.map((p,i)=>({x:values.length===1?50:i/(values.length-1)*100,y:maximum===minimum?50:85-(p.value-minimum)/(maximum-minimum)*70}));
  return <div className="trend-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={values.map(x=>`${x.label}: ${x.value} ${unit}`).join(', ')}><defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#3c9873" stopOpacity=".22"/><stop offset="1" stopColor="#3c9873" stopOpacity="0"/></linearGradient></defs><path d={`M0 100 L${pos.map(p=>`${p.x} ${p.y}`).join(' L')} L100 100 Z`} fill="url(#trend-fill)"/><polyline points={pos.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#0a7655" strokeWidth="2" vectorEffect="non-scaling-stroke"/>{pos.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="1.6" fill="#0a7655" vectorEffect="non-scaling-stroke"/>)}</svg><div className="trend-labels"><span>{values[0].label}</span><strong>{values.at(-1)?.value.toLocaleString('pt-BR')} {unit}</strong><span>{values.at(-1)?.label}</span></div></div>;
}
export function CategoryChart({items}:{items:[string,number][]}) {
 if(!items.length)return <Empty title="Categorias ainda vazias" description="Registre despesas para ver como os custos se distribuem."/>;
 const palette=['#07543e','#92a95f','#e0ae75','#a4bdad','#cb8270','#e1dac6'];const total=items.reduce((n,x)=>n+x[1],0);let offset=0;
 const gradient=items.map(([,v],i)=>{const start=offset;offset+=v/total*100;return `${palette[i%palette.length]} ${start}% ${offset}%`}).join(',');
 return <div className="category-chart"><div className="donut" style={{background:`conic-gradient(${gradient})`}}><div><small>DESPESAS</small><strong>{total.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</strong></div></div><div className="category-list">{items.map(([name,value],i)=><div key={name}><i style={{background:palette[i%palette.length]}}/><span>{name}</span><b>{Math.round(value/total*100)}%</b></div>)}</div></div>;
}
