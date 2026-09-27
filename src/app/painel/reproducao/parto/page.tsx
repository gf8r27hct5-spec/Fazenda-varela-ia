import Link from 'next/link';
import {AppShell,Card,Heading} from '@/components/app-shell';
import {DairyBirthForm} from '@/components/dairy-birth-form';
import {farmContext} from '@/lib/farm';
import {hojeNaFazenda} from '@/lib/reproducao';

export const dynamic='force-dynamic';
export default async function RegisterBirth({searchParams}:{searchParams:Promise<{mae?:string;erro?:string}>}){
  const q=await searchParams,{db,farm}=await farmContext();
  const {data:mother,error}=await db.from('animais').select('id,identificacao,nome').eq('id',q.mae||'').eq('fazenda_id',farm.id).eq('sistema','leite').neq('categoria','Cria leiteira').eq('status','ativo').maybeSingle();
  return <AppShell farm={farm} active="Leite"><Link className="back-link" href={mother?`/animais/${mother.id}?aba=reproducao`:'/painel/reproducao'}>← Reprodução</Link><Heading eyebrow="LEITE · NOVA VIDA" title="Registrar parto"/>
    {error||!mother?<Card title="Vaca não encontrada"><p className="section-note">Selecione uma vaca leiteira ativa na área de Reprodução.</p><Link className="module-action" href="/painel/reproducao">Ver vacas</Link></Card>:<><p className="section-note">Mãe: <strong>{mother.nome||mother.identificacao}</strong>. O parto e suas crias são gravados juntos, sem afetar o módulo Corte.</p>{q.erro&&<p role="alert" className="app-notice bad">Não foi possível registrar. Confira a data, os brincos e os pesos; um brinco já usado também impede a gravação.</p>}<Card title="Dados do parto"><DairyBirthForm mother={mother.id} today={hojeNaFazenda()}/></Card></>}
  </AppShell>;
}
