 'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/?erro=email');
  // Email links may open in a different browser from the one that requested
  // them. The implicit flow does not require a PKCE verifier cookie there.
  const supabase = createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback` } });
  if (error) {
    const limited = error.status === 429 || error.code === 'over_email_send_rate_limit';
    redirect(limited ? '/?erro=limite-email' : '/?erro=login');
  }
  redirect('/?enviado=1');
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) redirect('/?erro=senha');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/?erro=credenciais');
  redirect('/painel');
}

export async function setAccountPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const password = String(formData.get('password') || '');
  const confirmation = String(formData.get('confirmation') || '');
  if (password.length < 12 || password !== confirmation) redirect('/painel/mais?erro=senha');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/painel/mais?erro=senha');
  redirect('/painel/mais?salvo=senha');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function createFarm(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/');
  const nome = String(formData.get('nome') || '').trim();
  if (!nome || nome.length > 120) redirect('/?erro=nome');
  const { data: existing, error: lookupError } = await supabase.from('fazendas').select('id').limit(1);
  if (lookupError) redirect('/?erro=consulta');
  if (existing?.length) redirect('/');
  const { error } = await supabase.from('fazendas').insert({ nome, cidade: String(formData.get('cidade') || '').trim() || null, estado: 'PA', proprietario_id: user.id });
  if (error) redirect('/?erro=fazenda');
  revalidatePath('/');
  redirect('/');
}

export async function createAnimal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/');

  const identificacao = String(formData.get('identificacao') || '').trim();
  const nome = String(formData.get('nome') || '').trim();
  if (!identificacao || identificacao.length > 80 || nome.length > 120) redirect('/?erro=animal');

  const { data: farm, error: farmError } = await supabase.from('fazendas')
    .select('id').eq('proprietario_id', user.id).order('criado_em').limit(1).maybeSingle();
  if (farmError || !farm) redirect('/?erro=consulta');

  const loteId = String(formData.get('lote_id') || '');
  if (loteId) { const { data: lot } = await supabase.from('lotes').select('id').eq('id', loteId).eq('fazenda_id', farm.id).maybeSingle(); if (!lot) redirect('/painel/rebanho?erro=1'); }
  const { error } = await supabase.from('animais').insert({
    fazenda_id: farm.id, identificacao, nome: nome || null, lote_id: loteId || null,
  });
  if (error) redirect('/painel/rebanho?erro=1');
  revalidatePath('/painel');
  redirect('/painel/rebanho?salvo=1');
}

async function context() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/');
  const {data:farms,error}=await db.from('fazendas').select('id').eq('proprietario_id',user.id).order('criado_em').limit(1);
  if(error||!farms?.length)redirect('/');return {db,id:farms[0].id};
}
const field=(form:FormData,name:string)=>String(form.get(name)||'').trim();
const amount=(form:FormData,name:string)=>Number(field(form,name).replace(',','.'));
function fail(area:string){redirect(`/painel/${area}?erro=1`)}
function done(area:string){revalidatePath('/painel');revalidatePath(`/painel/${area}`);redirect(`/painel/${area}?salvo=1`)}
export async function createLot(form:FormData){const {db,id}=await context();const nome=field(form,'nome');const meta=field(form,'peso_meta');if(!nome||nome.length>120||meta&&!(amount(form,'peso_meta')>0))fail('rebanho');const {error}=await db.from('lotes').insert({fazenda_id:id,nome,categoria:field(form,'categoria')||null,peso_meta:meta?amount(form,'peso_meta'):null});if(error)fail('rebanho');done('rebanho')}
export async function createCostCenter(form:FormData){const {db,id}=await context();const nome=field(form,'nome');if(!nome||nome.length>120)fail('financeiro');const {error}=await db.from('centros_custo').insert({fazenda_id:id,nome});if(error)fail('financeiro');done('financeiro')}
export async function createWeighing(form:FormData){const {db,id}=await context();const target=field(form,'target'),weight=amount(form,'peso_kg'),when=field(form,'data_pesagem');if(!/^[al]:[0-9a-f-]{36}$/i.test(target)||!(weight>0)||!/^\d{4}-\d{2}-\d{2}$/.test(when))fail('pesagens');const table=target.startsWith('l:')?'lotes':'animais';const {data,error:lookup}=await db.from(table).select('id').eq('id',target.slice(2)).eq('fazenda_id',id).maybeSingle();if(lookup||!data)fail('pesagens');const targetId=target.slice(2);const count=field(form,'quantidade_animais');const {error}=await db.from('pesagens').insert({fazenda_id:id,lote_id:table==='lotes'?targetId:null,animal_id:table==='animais'?targetId:null,peso_kg:weight,data_pesagem:when,quantidade_animais:count?amount(form,'quantidade_animais'):null});if(error)fail('pesagens');revalidatePath(`/lotes/${targetId}`);done('pesagens')}
export async function createMilk(form:FormData){const {db,id}=await context();const liters=amount(form,'litros'),day=field(form,'data_producao'),price=field(form,'preco_litro');if(!(liters>0)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||price&&amount(form,'preco_litro')<0)fail('leite');const turno=field(form,'turno');if(turno&&!['manha','tarde','noite','total_dia'].includes(turno))fail('leite');const {error}=await db.from('producao_leite').insert({fazenda_id:id,litros:liters,data_producao:day,turno:turno||null,preco_litro:price?amount(form,'preco_litro'):null});if(error)fail('leite');done('leite')}
export async function createStock(form:FormData){const {db,id}=await context();const nome=field(form,'nome'),unit=field(form,'unidade');if(!nome||!unit||amount(form,'quantidade_atual')<0)fail('estoque');const {error}=await db.from('estoque').insert({fazenda_id:id,nome,categoria:field(form,'categoria'),unidade:unit,quantidade_atual:amount(form,'quantidade_atual'),estoque_minimo:amount(form,'estoque_minimo'),consumo_medio_dia:amount(form,'consumo_medio_dia')});if(error)fail('estoque');done('estoque')}
export async function createTransaction(form:FormData){const {db,id}=await context();const tipo=field(form,'tipo'),valor=amount(form,'valor'),descricao=field(form,'descricao'),categoria=field(form,'categoria'),day=field(form,'data_competencia'),lot=field(form,'lote_id'),center=field(form,'centro_custo_id');if(!['receita','despesa'].includes(tipo)||!(valor>0)||!descricao||!categoria||!/^\d{4}-\d{2}-\d{2}$/.test(day))fail('registrar');if(lot){const {data}=await db.from('lotes').select('id').eq('id',lot).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}if(center){const {data}=await db.from('centros_custo').select('id').eq('id',center).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}const {error}=await db.from('transacoes').insert({fazenda_id:id,tipo,valor,descricao,categoria,data_competencia:day,status:field(form,'status')==='pendente'?'pendente':'pago',lote_id:lot||null,centro_custo_id:center||null,origem:'manual'});if(error)fail('registrar');revalidatePath('/painel/financeiro');done('registrar')}
