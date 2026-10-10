import Link from 'next/link';
import { AppShell, Empty, Heading } from '@/components/app-shell';
import { Icon } from '@/components/icons';
import { farmContext, date } from '@/lib/farm';
import { getFarmAlerts, type AlertSeverity } from '@/lib/farm-alerts';
export const dynamic='force-dynamic';
const groups:{severity:AlertSeverity;title:string;description:string}[]=[
 {severity:'critico',title:'Crítico',description:'Verifique estes registros primeiro.'},
 {severity:'atencao',title:'Atenção',description:'Acompanhe e planeje as próximas ações.'},
 {severity:'informacao',title:'Informação',description:'Marcos e lembretes da propriedade.'},
];
export default async function AlertsPage(){
 const {db,farm}=await farmContext(),{alerts}=await getFarmAlerts(db,farm.id);
 return <AppShell farm={farm} active="Mais"><Heading eyebrow="Fazenda Varela IA · acompanhamento" title="O que precisa da sua atenção hoje?" aside={<Link className="module-action secondary" href="/painel/alertas/configuracoes"><Icon name="menu" size={16}/> Configurar</Link>}/>
 <div className="attention-intro"><p>Alertas calculados a partir dos registros da sua fazenda. Confira cada dado antes de agir; nenhum alerta altera o cadastro automaticamente.</p><div className="attention-counts"><span className="critical"><b>{alerts.filter(a=>a.severity==='critico').length}</b> críticos</span><span className="warning"><b>{alerts.filter(a=>a.severity==='atencao').length}</b> atenção</span><span><b>{alerts.filter(a=>a.severity==='informacao').length}</b> informações</span></div></div>
 {groups.map(group=><section className={`attention-group ${group.severity}`} key={group.severity}><div className="attention-group-header"><span className="overline">{group.title}</span><h2>{group.description}</h2></div>{alerts.filter(a=>a.severity===group.severity).length?alerts.filter(a=>a.severity===group.severity).map(a=><article className="attention-item" key={a.id}><div className="attention-item-top"><span className="attention-module">{a.module}</span><time dateTime={a.date}>{date(a.date)}</time></div><h3>{a.title}</h3><p>{a.reason}</p><div className="attention-evidence">{a.evidence}</div><Link href={a.href}>{a.action} <Icon name="arrow" size={15}/></Link></article>):<Empty title={`Nenhum alerta de ${group.title.toLowerCase()}`} description="Este grupo está em dia conforme os dados cadastrados."/>}</section>)}
 </AppShell>;
}
