import Link from 'next/link';
import { AppShell, Card, Empty, Heading, Stat } from '@/components/app-shell';
import { TrendChart } from '@/components/charts';
import { date, farmContext, number } from '@/lib/farm';
import { lotWeights, weightStats } from '@/lib/corte';
export const dynamic='force-dynamic';
export default async function Weighings({searchParams}:{searchParams:Promise<{lote?:string;animal?:string;salvo?:string;erro?:string}>}){
 const query=await searchParams,{db,farm}=await farmContext();
 const [ar,lr,wr]=await Promise.all([db.from('animais').select('id,identificacao,nome,lote_id,sistema,status,peso_entrada,peso_atual,data_entrada').eq('fazenda_id',farm.id).eq('sistema','corte'),db.from('lotes').select('id,nome,peso_meta').eq('fazenda_id',farm.id).eq('sistema','corte'),db.from('pesagens').select('*').eq('fazenda_id',farm.id).order('data_pesagem',{ascending:false})]);
 if(ar.error||lr.error||wr.error)throw new Error('Falha ao carregar pesagens.');
 const animals=ar.data||[],lots=lr.data||[],all=wr.data||[];
 const chosenAnimal=animals.find(x=>x.id===query.animal), chosenLot=lots.find(x=>x.id===query.lote);
 const rows=all.filter(x=>chosenAnimal?x.animal_id===chosenAnimal.id:chosenLot?x.lote_id===chosenLot.id:animals.some(a=>a.id===x.animal_id)||lots.some(l=>l.id===x.lote_id));
 const stats=chosenAnimal?weightStats(chosenAnimal,rows,lots.find(l=>l.id===chosenAnimal.lote_id)?.peso_meta):null;
 const group=chosenLot?lotWeights(animals.filter(a=>a.lote_id===chosenLot.id),rows):null;
 const chart=stats?stats.entries.map(x=>({label:date(x.data_pesagem).slice(0,5),value:Number(x.peso_kg)})):group?group.chart.filter(x=>x.average!=null&&x.count===animals.filter(a=>a.lote_id===chosenLot!.id&&a.status==='ativo').length).map(x=>({label:date(x.day).slice(0,5),value:x.average!})):[];
 return <AppShell farm={farm} active="Rebanho"><Link className="back-link" href="/painel/rebanho">← Corte</Link><Heading eyebrow="Rebanho · Corte" title="Pesagens"/><p className="section-note">Histórico real por animal e lote, com ganho e GMD calculados entre datas distintas.</p>
  {query.salvo&&<p role="status" className="app-notice good">Pesagem salva.</p>}{query.erro&&<p role="alert" className="app-notice bad">Não foi possível salvar a pesagem. Confira os dados.</p>}
  <nav className="filter-pills" aria-label="Filtrar pesagens"><Link href="/painel/pesagens" aria-current={!chosenLot&&!chosenAnimal?'page':undefined}>Todas</Link>{lots.map(l=><Link key={l.id} href={`?lote=${l.id}`} aria-current={chosenLot?.id===l.id?'page':undefined}>{l.nome}</Link>)}</nav>
  <div className="module-quick-actions"><Link className="module-action" href="/painel/novo/pesagem">+ Pesagem individual</Link>{chosenLot&&<Link className="module-action secondary" href={`/lotes/${chosenLot.id}#pesagem-lote`}>+ Registrar pesagem do lote</Link>}</div>
  {(stats||group)&&<div className="stat-grid"><Stat label="Peso atual/médio" value={stats?.current!=null?`${number(stats.current,1)} kg`:group?.average!=null?`${number(group.average,1)} kg`:'—'}/><Stat label="GMD recente" value={stats?.recentGmd!=null?`${number(stats.recentGmd,2)} kg/dia`:group?.gmd!=null?`${number(group.gmd,2)} kg/dia`:'—'}/><Stat label="Pesados recentemente" value={group?`${group.recent} de ${animals.filter(a=>a.lote_id===chosenLot!.id&&a.status==='ativo').length}`:'—'}/></div>}
  {(stats||group)&&<Card title="Evolução de peso"><TrendChart points={chart} unit="kg"/></Card>}
  <Card title="Histórico completo">{rows.length?rows.map((row,index)=>{const animal=animals.find(a=>a.id===row.animal_id);const prior=animal?weightStats(animal,rows).entries.find(x=>x.data_pesagem===row.data_pesagem&&Number(x.peso_kg)===Number(row.peso_kg)):null;return <div className="data-row" key={row.id}><div><strong>{number(Number(row.peso_kg),1)} kg · {animal?.identificacao||'Média do lote'}</strong><small>{date(row.data_pesagem)}{row.responsavel?` · ${row.responsavel}`:''}{row.observacoes?` · ${row.observacoes}`:''}</small></div><span>{prior?.gmd!=null?`${number(prior.gmd,2)} kg/dia`:index===0?'—':'—'}</span></div>}):<Empty title="Sem pesagens" description="Registre o primeiro peso para começar a acompanhar a evolução."/>}</Card>
 </AppShell>;
}
