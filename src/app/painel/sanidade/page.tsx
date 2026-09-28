import Link from 'next/link';
import { AppShell, Card, Empty, Heading, Stat } from '@/components/app-shell';
import { SanitaryForm } from '@/components/corte-forms';
import { date, farmContext } from '@/lib/farm';
import { healthAlerts } from '@/lib/corte';
import { RecordActions } from '@/components/record-actions';
export const dynamic='force-dynamic';
export default async function HealthPage({searchParams}:{searchParams:Promise<{lote?:string;animal?:string;salvo?:string;erro?:string}>}){
 const query=await searchParams,{db,farm}=await farmContext();
 const [ar,lr,hr]=await Promise.all([db.from('animais').select('id,identificacao,nome,lote_id,status').eq('fazenda_id',farm.id).eq('sistema','corte'),db.from('lotes').select('id,nome').eq('fazenda_id',farm.id).eq('sistema','corte'),db.from('manejos').select('*').eq('fazenda_id',farm.id).order('data_manejo',{ascending:false})]);
 if(ar.error||lr.error||hr.error)throw new Error('Falha ao carregar sanidade.');
 const animals=ar.data||[],lots=lr.data||[],selected=query.lote||animals.find(x=>x.id===query.animal)?.lote_id||lots[0]?.id;
 const rows=(hr.data||[]).filter(h=>animals.some(a=>a.id===h.animal_id)&&(query.animal?h.animal_id===query.animal:!query.lote||h.lote_id===query.lote));
 const alerts=healthAlerts(rows);
 return <AppShell farm={farm} active="Rebanho"><Link className="back-link" href="/painel/rebanho">← Corte</Link><Heading eyebrow="Saúde do rebanho de corte" title="Sanidade"/><p className="section-note">Vacinas, tratamentos e outros manejos vinculados às fichas dos animais.</p>
 {query.salvo&&<p role="status" className="app-notice good">Manejo salvo para os animais selecionados.</p>}{query.erro&&<p role="alert" className="app-notice bad">Não foi possível salvar o manejo. Selecione animais ativos do mesmo lote e confira as datas.</p>}
 <div className="stat-grid"><Stat label="Reforços próximos" value={alerts.next.length}/><Stat label="Tratamentos em andamento" value={alerts.ongoing.length}/><Stat label="Animais em carência" value={new Set(alerts.withdrawal.map(x=>x.animal_id)).size}/><Stat label="Manejos atrasados" value={alerts.overdue.length}/></div>
 <Card title="Alertas sanitários">{[...alerts.overdue.map(x=>({item:x,label:'Atrasado'})),...alerts.next.map(x=>({item:x,label:'Próximo reforço'})),...alerts.withdrawal.map(x=>({item:x,label:'Em carência'})),...alerts.ongoing.map(x=>({item:x,label:'Tratamento em andamento'}))].length?[...alerts.overdue.map(x=>({item:x,label:'Atrasado'})),...alerts.next.map(x=>({item:x,label:'Próximo reforço'})),...alerts.withdrawal.map(x=>({item:x,label:'Em carência'})),...alerts.ongoing.map(x=>({item:x,label:'Tratamento em andamento'}))].slice(0,15).map(({item,label},index)=><Link className="data-row" key={`${item.id}-${label}-${index}`} href={`/animais/${item.animal_id}?aba=sanidade`}><strong>{label}: {item.produto||item.tipo}</strong><span>{animals.find(a=>a.id===item.animal_id)?.identificacao||'Animal'} →</span></Link>):<Empty title="Sem alertas sanitários" description="Reforços, carências e tratamentos aparecerão aqui quando registrados."/>}</Card>
 <Card title="Registrar manejo">{lots.length&&animals.some(a=>a.lote_id===selected&&a.status==='ativo')?<SanitaryForm lots={lots} animals={animals} selectedLot={selected||undefined} selectedAnimal={query.animal}/>:<Empty title="Nenhum animal ativo em lote" description="Vincule animais ativos de corte a um lote para registrar sanidade."/>}</Card>
 <Card title="Histórico sanitário">{rows.length?rows.map(item=><div className="data-row" key={item.id}><Link className="record-row-link" href={`/animais/${item.animal_id}?aba=sanidade`}><div><strong>{item.produto||item.tipo} · {animals.find(a=>a.id===item.animal_id)?.identificacao}</strong><small>{date(item.data_manejo)} · {item.tipo}{item.dose?` · ${item.dose} ${item.dose_unidade||''}`:''}</small></div><span>Ver ficha →</span></Link><RecordActions table="manejos" id={item.id} label={String(item.produto||item.tipo)}/></div>):<Empty title="Sem manejos registrados" description="Adicione uma vacina, medicamento ou procedimento."/>}</Card>
 </AppShell>;
}
