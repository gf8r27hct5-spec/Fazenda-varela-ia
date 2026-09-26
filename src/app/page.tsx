import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAccount, createFarm, requestPasswordReset, signIn, signInWithPassword } from './actions';

export const dynamic = 'force-dynamic';
type Params = { modo?: string; erro?: string; enviado?: string };
const errors: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos. Você pode redefinir sua senha abaixo.',
  'senha-curta': 'Use uma senha com pelo menos 12 caracteres.',
  'senhas-diferentes': 'As duas senhas precisam ser iguais.',
  'limite-email': 'O envio de e-mails está temporariamente limitado. Aguarde alguns minutos antes de tentar novamente.',
  'link-expirado': 'O link expirou. Peça outro e abra o mais recente.',
  cadastro: 'Não foi possível criar a conta. Confira o e-mail ou tente recuperar uma conta existente.',
  recuperacao: 'Não foi possível enviar a recuperação agora. Tente novamente mais tarde.',
  fazenda: 'Não foi possível criar a fazenda. Confira os dados e tente novamente.',
  email: 'Informe um e-mail válido.',
};
export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: farms } = user ? await db.from('fazendas').select('id').eq('proprietario_id', user.id).limit(1) : { data: null };
  if (user && farms?.length) redirect('/painel');
  const mode = ['cadastro','recuperar'].includes(params.modo || '') ? params.modo : 'entrar';
  return <main className="auth-page">
    <div className="auth-backdrop" aria-hidden="true" />
    <div className="auth-layout">
      <div className="auth-story"><div className="auth-logo">FV <span>Fazenda Varela IA</span></div><div className="auth-story-bottom"><span className="eyebrow-light">GESTÃO RURAL INTELIGENTE</span><h1>O campo em<br/><em>boas mãos.</em></h1><p>Rebanho, leite e finanças com a clareza que a sua fazenda merece.</p><div className="auth-caption">BREU BRANCO · PARÁ</div></div></div>
      <section className="auth-box"><div className="auth-mobile-brand">FAZENDA VARELA <b>IA</b></div>
        {user ? <><p className="auth-kicker">BEM-VINDO À SUA FAZENDA</p><h2>Vamos começar.</h2><p>Cadastre sua propriedade para organizar seus primeiros registros.</p><form action={createFarm} className="auth-form"><label>Nome da fazenda<input name="nome" defaultValue="Fazenda Varela" required maxLength={120}/></label><label>Cidade<input name="cidade" defaultValue="Breu Branco"/></label><button type="submit">Criar fazenda <span>↗</span></button></form></> : <>
        <p className="auth-kicker">ACESSO À FAZENDA</p><h2>{mode === 'cadastro' ? 'Comece por aqui.' : mode === 'recuperar' ? 'Recupere seu acesso.' : 'Bom ter você de volta.'}</h2><p>{mode === 'cadastro' ? 'Crie sua conta para cuidar de cada detalhe da fazenda.' : mode === 'recuperar' ? 'Enviaremos um link para você definir uma nova senha.' : 'Entre com seu e-mail e senha para continuar.'}</p>
        <nav className="auth-tabs" aria-label="Acesso"><Link href="/?modo=entrar" className={mode === 'entrar' ? 'active' : ''}>Entrar</Link><Link href="/?modo=cadastro" className={mode === 'cadastro' ? 'active' : ''}>Criar conta</Link></nav>
        {params.erro && <p role="alert" className="auth-message bad">{errors[params.erro] || 'Não foi possível concluir. Tente novamente.'}</p>}
        {params.enviado && <p role="status" className="auth-message">{params.enviado === 'recuperacao' ? 'Se houver uma conta com esse e-mail, você receberá um link de recuperação.' : params.enviado === 'cadastro' ? 'Confira seu e-mail para confirmar a conta. Depois entre com sua senha.' : 'Enviamos um link de acesso. Abra o mais recente no seu e-mail.'}</p>}
        {mode === 'cadastro' ? <form className="auth-form" action={createAccount}><label>E-mail<input name="email" type="email" autoComplete="email" placeholder="seu@email.com" required/></label><label>Senha<input name="password" type="password" autoComplete="new-password" minLength={12} required/></label><label>Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required/></label><button type="submit">Criar minha conta <span>↗</span></button></form>
        : mode === 'recuperar' ? <form className="auth-form" action={requestPasswordReset}><label>Seu e-mail<input name="email" type="email" autoComplete="email" placeholder="seu@email.com" required/></label><button type="submit">Enviar link de recuperação <span>↗</span></button><Link className="auth-inline-link" href="/?modo=entrar">← Voltar ao login</Link></form>
        : <><form className="auth-form" action={signInWithPassword}><label>Seu e-mail<input name="email" type="email" autoComplete="username" placeholder="seu@email.com" required/></label><label>Sua senha<input name="password" type="password" autoComplete="current-password" required/></label><Link className="auth-inline-link" href="/?modo=recuperar">Esqueci minha senha</Link><button type="submit">Entrar na fazenda <span>↗</span></button></form><details className="magic-option"><summary>Prefere entrar com link por e-mail?</summary><form action={signIn} className="auth-form"><label>Seu e-mail<input name="email" type="email" autoComplete="email" placeholder="seu@email.com" required/></label><button type="submit">Enviar link de acesso <span>↗</span></button></form></details></>}
      </>}
      <div className="auth-footnote">Seus registros ficam protegidos e disponíveis na sua conta.</div></section>
    </div>
  </main>;
}
