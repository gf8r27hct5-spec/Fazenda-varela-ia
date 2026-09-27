import Link from 'next/link';
import {AppShell,Card,Empty,Heading,Stat} from '@/components/app-shell';
import {date,farmContext,number} from '@/lib/farm';
import {diasEntre,hojeNaFazenda,idadeLegivel} from '@/lib/reproducao';

export const dynamic='force-dynamic';
export default async function Reproduction({searchParams}:{searchParams:Promise<{erro?:string;salvo?:string}>}){
 const q=await searchParams,{db,farm}=await farmContext();
 const [animalsResult,birthsResult,offspringResult]=await Promise.all([
   db.from('animais').select('*').eq('fazenda_id',farm.id).eq('sistema','leite').order('identificacao'),
   db.from('partos_leite').select('*').eq('fazenda_id',farm.id).order('data_parto',{ascending:false}).limit(100),
   db.from('crias_parto_leite').select('*').eq('fazenda_id',farm.id).limit(300),
 ]);
 if(animalsResult.error||birthsResult.error||offspringResult.error)throw new Error('Falha ao carregar reprodução');
 const animals=animalsResult.data||[],cows=animals.filter(a=>a.categoria!=='Cria leiteira'),calves=animals.filter(a=>a.categoria==='Cria leiteira');
 const pregnant=cows.filter(a=>a.status==='ativo'&&a.prenhe),today=hojeNaFazenda();
 const births=birthsResult.data||[],offspring=offspringResult.data||[];
 const alerts=[...pregnant.flatMap(a=>{const days=a.proxima_previsao_parto?diasEntre(today,a.proxima_previsao_parto):null;return days===null?[{text:`${a.nome||a.identificacao}: prenha sem previsão de parto`,href:`/animais/${a.id}?aba=reproducao`}]:days<=30?[{text:`${a.nome||a.identificacao}: ${days<0?'previsão de parto ultrapassada':`parto previsto em ${days} dia${days===1?'':'s'}`}`,href:`/animais/${a.id}?aba=reproducao`}]:[];}),...calves.filter(a=>a.status==='ativo').flatMap(a=>{
   const notes:{text:string;href:string}[]=[],days=a.data_prevista_desmame?diasEntre(today,a.data_prevista_desmame):null;
   if(a.situacao_cria==='mamando'&&days!==null&&days<=30)notes.push({text:`${a.nome||a.identificacao}: ${days<0?'desmame previsto atrasado':`desmame previsto em ${days} dia${days===1?'':'s'}`}`,href:`/animais/${a.id}`});
   const reference=a.data_ultima_pesagem||a.data_nascimento;const stale=reference&&diasEntre(reference,today)!==null&&(diasEntre(reference,today)??0)>60;
   if(a.peso_atual==null||stale)notes.push({text:`${a.nome||a.identificacao}: ${a.peso_atual==null?'sem peso registrado':'peso não atualizado há mais de 60 dias'}`,href:`/animais/${a.id}`});return notes;
 })];
 return <AppShell farm={farm} active="Leite"><Link href="/painel/leite" className="back-link">← Leite</Link><Heading eyebrow="MATERNIDADE DO REBANHO" title="Reprodução & crias"/>
 {q.erro&&<p className="app-notice bad" role="alert">Não foi possível salvar. Confira os campos e tente novamente.</p>}{q.salvo&&<p className="app-notice good" role="status">Dados salvos.</p>}
 <section className="repro-hero"><span>LEITE · ACOMPANHAMENTO</span><h2>Da gestação aos primeiros passos.</h2><p>Partos, mães e crias conectados, com histórico preservado.</p><div><Link href="/painel/reproducao/cria">+ Cadastrar cria</Link><Link href="/painel/novo/leite">+ Vaca leiteira</Link></div></section>
 <div className="stat-grid"><Stat label="Vacas prenhas" value={pregnant.length}/><Stat label="Partos próximos (30 dias)" value={pregnant.filter(a=>a.proxima_previsao_parto&&diasEntre(today,a.proxima_previsao_parto)!==null&&diasEntre(today,a.proxima_previsao_parto)!<=30).length}/><Stat label="Crias mamando" value={calves.filter(a=>a.status==='ativo'&&a.situacao_cria==='mamando').length}/><Stat label="Crias desmamadas" value={calves.filter(a=>a.situacao_cria==='desmamada').length}/></div>
 {alerts.length>0&&<Card title="Atenção na fazenda"><div className="repro-alert-list">{alerts.map((a,i)=><Link href={a.href} key={`${a.href}-${i}`}>● {a.text} <span>→</span></Link>)}</div></Card>}
 <Card title="Vacas prenhas">{pregnant.length?pregnant.map(a=>{const days=a.proxima_previsao_parto?diasEntre(today,a.proxima_previsao_parto):null;return <Link href={`/animais/${a.id}?aba=reproducao`} className="data-row" key={a.id}><div><strong>{a.nome||a.identificacao}</strong><small>{a.identificacao} · {a.proxima_previsao_parto?`parto previsto ${date(a.proxima_previsao_parto)}`:'previsão não informada'}</small></div><span>{days===null?'Definir data':days<0?'Atrasado':`${days} dias`} →</span></Link>}):<Empty title="Nenhuma gestação registrada" description="Abra a ficha de uma vaca leiteira para registrar a prenhez."/>}</Card>
 <Card title="Partos registrados">{births.length?births.map(b=><Link href={`/animais/${b.mae_id}?aba=reproducao`} className="data-row" key={b.id}><div><strong>{cows.find(a=>a.id===b.mae_id)?.nome||cows.find(a=>a.id===b.mae_id)?.identificacao||'Vaca leiteira'} · {date(b.data_parto)}</strong><small>{b.quantidade_crias} {b.quantidade_crias===1?'cria':'crias'} · {offspring.filter(c=>c.parto_id===b.id).map(c=>c.identificacao||c.situacao_ao_nascer).join(', ')}</small></div><span>Ver →</span></Link>):<Empty title="Nenhum parto registrado" description="Na ficha da mãe, registre o parto e os dados de cada cria."/>}</Card>
 <Card title="Bezerros e bezerras">{calves.length?calves.map(a=><Link href={`/animais/${a.id}`} className="data-row" key={a.id}><div><strong>{a.nome||a.identificacao}</strong><small>{a.identificacao} · {a.data_nascimento?idadeLegivel(a.data_nascimento,today):'idade não informada'} · mãe: {cows.find(c=>c.id===a.mae_id)?.nome||cows.find(c=>c.id===a.mae_id)?.identificacao||'não informada'}</small></div><span>{a.peso_atual!=null?`${number(Number(a.peso_atual),1)} kg`:'Sem peso'} · {a.situacao_cria||'—'} →</span></Link>):<Empty title="Nenhuma cria cadastrada" description="Registre um parto ou cadastre uma cria que já nasceu."/>}<Link href="/painel/reproducao/cria" className="module-action">+ Cadastrar bezerro ou bezerra</Link></Card>
 </AppShell>;
}
