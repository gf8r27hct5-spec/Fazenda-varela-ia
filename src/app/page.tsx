import { createClient } from '@/lib/supabase/server';
import { createFarm, signIn, signOut } from './actions';

export const dynamic = 'force-dynamic';
type Params = { erro?: string; enviado?: string };
export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: farms } = user ? await supabase.from('fazendas').select('id,nome,cidade,estado').order('criado_em') : { data: null };
  const farm = farms?.[0];
  const [animals, lots, milk, transactions] = farm ? await Promise.all([
    supabase.from('animais').select('id', { count: 'exact', head: true }).eq('fazenda_id', farm.id).eq('status', 'ativo'),
    supabase.from('lotes').select('id', { count: 'exact', head: true }).eq('fazenda_id', farm.id).eq('ativo', true),
    supabase.from('producao_leite').select('*', { count: 'exact', head: true }).eq('fazenda_id', farm.id),
    supabase.from('transacoes').select('id', { count: 'exact', head: true }).eq('fazenda_id', farm.id),
  ]) : [];
  return <main className="shell">
    <header className="top"><div className="brand"><span className="brand-mark">FV</span><span>FAZENDA VARELA <b>IA</b></span></div><span className="top-right">GESTÃO RURAL <span className="status">● SISTEMA ONLINE</span></span></header>
    <div className="content"><div className="eyebrow">PAINEL DE CONTROLE <span> / VISÃO GERAL</span></div>
      <div className="intro"><div><p className="kicker">CONTROLE EM TEMPO REAL</p><h1>Sua fazenda,<br/><em>sob controle.</em></h1><p className="subtitle">Animais, produção e finanças organizados em um só lugar.</p></div><div className="sun">✳</div></div>
      {params.erro && <p className="notice error">Não foi possível concluir a operação ({params.erro}). Confira os dados e tente novamente.</p>}
      {params.enviado && <p className="notice">Enviamos um link de acesso para seu e-mail. Abra-o neste navegador.</p>}
      {!user ? <section className="panel auth"><div><span className="label">ACESSO SEGURO</span><h2>Entre na sua fazenda</h2><p>Receba um link de acesso por e-mail. Você não precisa criar uma senha.</p></div><form action={signIn}><label htmlFor="email">Seu e-mail</label><input id="email" name="email" type="email" placeholder="voce@exemplo.com" required/><button type="submit">Enviar link de acesso <span>↗</span></button></form></section>
      : !farm ? <section className="panel auth"><div><span className="label">PRIMEIRO PASSO</span><h2>Cadastre sua fazenda</h2><p>Crie o espaço onde os registros serão organizados.</p></div><form action={createFarm}><label htmlFor="nome">Nome da fazenda</label><input id="nome" name="nome" defaultValue="Fazenda Varela" required/><label htmlFor="cidade">Cidade</label><input id="cidade" name="cidade" defaultValue="Breu Branco"/><button type="submit">Criar fazenda <span>↗</span></button></form></section>
      : <><div className="farm-line"><div><span className="label">PROPRIEDADE ATIVA</span><h2>{farm.nome}</h2><p>{farm.cidade || 'Pará'} · {farm.estado || 'PA'}</p></div><form action={signOut}><button className="ghost" type="submit">Sair da conta ↗</button></form></div><div className="grid"><Metric index="01" title="Animais ativos" value={animals?.count ?? 0} unit="cabeças"/><Metric index="02" title="Lotes ativos" value={lots?.count ?? 0} unit="lotes"/><Metric index="03" title="Registros de leite" value={milk?.count ?? 0} unit="registros"/><Metric index="04" title="Lançamentos" value={transactions?.count ?? 0} unit="transações"/></div><section className="panel next"><div><span className="label">PRÓXIMOS MÓDULOS</span><h2>O começo de uma gestão mais clara.</h2><p>O painel já consulta os dados da fazenda no Supabase. Cadastro de animais, pesagens, leite e financeiro serão adicionados aqui.</p></div><span className="next-icon">↗</span></section></>}
      <footer>FAZENDA VARELA IA <span>BREU BRANCO · PARÁ</span></footer>
    </div></main>;
}
function Metric({ index, title, value, unit }: { index: string; title: string; value: number; unit: string }) { return <article className="metric"><span className="label">{index} / {title}</span><strong>{value.toLocaleString('pt-BR')}</strong><span>{unit}</span></article>; }
