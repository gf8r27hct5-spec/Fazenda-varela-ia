import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { saveRecoveredPassword } from '@/app/actions';
export const dynamic = 'force-dynamic';
export default async function NewPassword({searchParams}:{searchParams:Promise<{erro?:string;salvo?:string}>}) {
  const params = await searchParams;
  const db = await createClient();
  const {data:{user}} = await db.auth.getUser();
  return <main className="auth-page"><div className="auth-backdrop"/><div className="auth-layout"><div className="auth-story"><div className="auth-logo"><b>FV</b><span>Fazenda Varela IA</span></div><div className="auth-story-bottom"><h1>Seu campo.<br/><em>Seu acesso.</em></h1></div></div><section className="auth-box"><p className="auth-kicker">SEGURANÇA DA CONTA</p><h2>Nova senha</h2>{params.salvo ? <><p role="status" className="auth-message">Senha salva. Seu acesso está pronto.</p><Link className="primary-link" href="/painel">Abrir minha fazenda →</Link></> : user ? <><p>Crie uma senha exclusiva com pelo menos 12 caracteres.</p>{params.erro&&<p role="alert" className="auth-message bad">Confira as senhas e tente novamente.</p>}<form className="auth-form" action={saveRecoveredPassword}><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={12} required/></label><label>Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required/></label><button type="submit">Salvar senha <span>↗</span></button></form></> : <><p>Seu link de recuperação expirou ou ainda não foi confirmado.</p><Link href="/?modo=recuperar" className="primary-link">Pedir outro link →</Link></>}</section></div></main>;
}
