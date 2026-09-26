 'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');

const emailClient = () => createSupabaseClient(supabaseUrl, supabasePublishableKey, {
  auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false },
});

export async function createAccount(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const confirmation = String(formData.get('confirmation') || '');
  if (!email.includes('@')) redirect('/?modo=cadastro&erro=email');
  if (password.length < 12) redirect('/?modo=cadastro&erro=senha-curta');
  if (password !== confirmation) redirect('/?modo=cadastro&erro=senhas-diferentes');
  const { error } = await emailClient().auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl()}/auth/callback` } });
  if (error) redirect(`/?modo=cadastro&erro=${error.status === 429 ? 'limite-email' : 'cadastro'}`);
  redirect('/?modo=entrar&enviado=cadastro');
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) redirect('/?modo=recuperar&erro=email');
  const { error } = await emailClient().auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback` });
  if (error) redirect(`/?modo=recuperar&erro=${error.status === 429 ? 'limite-email' : 'recuperacao'}`);
  redirect('/?modo=recuperar&enviado=recuperacao');
}

export async function saveRecoveredPassword(formData: FormData) {
  const password = String(formData.get('password') || '');
  const confirmation = String(formData.get('confirmation') || '');
  if (password.length < 12 || password !== confirmation) redirect('/auth/nova-senha?erro=senha');
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/?modo=recuperar&erro=link-expirado');
  const { error } = await db.auth.updateUser({ password });
  if (error) redirect('/auth/nova-senha?erro=salvar');
  redirect('/auth/nova-senha?salvo=1');
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/?erro=email');
  // Email links may open in a different browser from the one that requested
  // them. The implicit flow does not require a PKCE verifier cookie there.
  const { error } = await emailClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback` } });
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
  const modulo = String(formData.get('modulo') || 'corte');
  if (!['corte','leite'].includes(modulo)) redirect('/painel/rebanho?erro=1');
  const categoria = String(formData.get('categoria') || '').trim() || (modulo === 'leite' ? 'Vaca leiteira' : 'Corte');
  const status = modulo === 'corte' ? String(formData.get('status') || 'ativo') : 'ativo';
  if (!['ativo','vendido','abatido','morto'].includes(status)) redirect('/painel/rebanho?erro=1');
  if (loteId) { const { data: lot } = await supabase.from('lotes').select('id').eq('id', loteId).eq('fazenda_id', farm.id).eq('sistema','corte').maybeSingle(); if (!lot) redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?erro=1`); }
  const bezerroId = modulo === 'leite' ? String(formData.get('bezerro_id') || '') : '';
  if (bezerroId) { const { data: calf } = await supabase.from('animais').select('id').eq('id', bezerroId).eq('fazenda_id',farm.id).eq('sistema','leite').maybeSingle(); if (!calf) redirect('/painel/leite?erro=1'); }
  const photo = formData.get('foto');
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size) {
    const extensions: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'};
    const ext = extensions[photo.type];
    if (!ext || photo.size > 3670016) redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?erro=foto`);
    photoPath = `${farm.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('fotos-animais').upload(photoPath, photo, {contentType: photo.type, upsert:false});
    if (uploadError) redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?erro=foto`);
  }
  const { error } = await supabase.from('animais').insert({
    fazenda_id: farm.id, identificacao, nome: nome || null, sistema: modulo, lote_id: modulo === 'corte' ? (loteId || null) : null, status,
    situacao_leite: modulo === 'leite' ? String(formData.get('situacao_leite') || 'Em lactação') : null,
    categoria, sexo: String(formData.get('sexo') || '').trim() || null, raca: String(formData.get('raca') || '').trim() || null,
    data_nascimento: String(formData.get('data_nascimento') || '').trim() || null, peso_entrada: formData.get('peso_entrada') ? Number(formData.get('peso_entrada')) : null,
    peso_atual: formData.get('peso_atual') ? Number(formData.get('peso_atual')) : null,
    data_entrada: String(formData.get('data_entrada') || '').trim() || null, valor_compra: formData.get('valor_compra') ? Number(formData.get('valor_compra')) : null,
    observacoes: String(formData.get('observacoes') || '').trim() || null,
    origem: String(formData.get('origem') || '').trim() || null, foto_url: photoPath, bezerro_id: bezerroId || null,
    data_ultimo_parto: modulo === 'leite' ? String(formData.get('data_ultimo_parto') || '') || null : null,
    proxima_previsao_parto: modulo === 'leite' ? String(formData.get('proxima_previsao_parto') || '') || null : null,
  });
  if (error) {
    if (photoPath) await supabase.storage.from('fotos-animais').remove([photoPath]);
    redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?erro=1`);
  }
  revalidatePath('/painel');
  redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?salvo=1`);
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
export async function createLot(form:FormData){const {db,id}=await context();const nome=field(form,'nome');const meta=field(form,'peso_meta');if(!nome||nome.length>120||meta&&!(amount(form,'peso_meta')>0))fail('rebanho');const {error}=await db.from('lotes').insert({fazenda_id:id,nome,sistema:'corte',categoria:field(form,'categoria')||null,peso_meta:meta?amount(form,'peso_meta'):null});if(error)fail('rebanho');done('rebanho')}
export async function createCostCenter(form:FormData){const {db,id}=await context();const nome=field(form,'nome');if(!nome||nome.length>120)fail('financeiro');const {error}=await db.from('centros_custo').insert({fazenda_id:id,nome});if(error)fail('financeiro');done('financeiro')}
export async function createWeighing(form:FormData){const {db,id}=await context();const target=field(form,'target'),weight=amount(form,'peso_kg'),when=field(form,'data_pesagem');if(!/^[al]:[0-9a-f-]{36}$/i.test(target)||!(weight>0)||!/^\d{4}-\d{2}-\d{2}$/.test(when))fail('pesagens');const table=target.startsWith('l:')?'lotes':'animais';const {data,error:lookup}=await db.from(table).select('id').eq('id',target.slice(2)).eq('fazenda_id',id).eq('sistema','corte').maybeSingle();if(lookup||!data)fail('pesagens');const targetId=target.slice(2);const count=field(form,'quantidade_animais');const {error}=await db.from('pesagens').insert({fazenda_id:id,lote_id:table==='lotes'?targetId:null,animal_id:table==='animais'?targetId:null,peso_kg:weight,data_pesagem:when,quantidade_animais:count?amount(form,'quantidade_animais'):null});if(error)fail('pesagens');revalidatePath(`/lotes/${targetId}`);done('pesagens')}
export async function createMilk(form:FormData){const {db,id}=await context();const liters=amount(form,'litros'),day=field(form,'data_producao'),price=field(form,'preco_litro');if(!(liters>0)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||price&&amount(form,'preco_litro')<0)fail('leite');const turno=field(form,'turno');if(turno&&!['manha','tarde','noite','total_dia'].includes(turno))fail('leite');const animalId=field(form,'animal_id');if(animalId){const {data:animal}=await db.from('animais').select('id,sistema').eq('id',animalId).eq('fazenda_id',id).maybeSingle();if(!animal||animal.sistema!=='leite')fail('leite');}const {error}=await db.from('producao_leite').insert({fazenda_id:id,animal_id:animalId||null,litros:liters,data_producao:day,turno:turno||null,preco_litro:price?amount(form,'preco_litro'):null});if(error)fail('leite');done('leite')}
export async function createStock(form:FormData){const {db,id}=await context();const nome=field(form,'nome'),unit=field(form,'unidade');if(!nome||!unit||amount(form,'quantidade_atual')<0)fail('estoque');const {error}=await db.from('estoque').insert({fazenda_id:id,nome,categoria:field(form,'categoria'),unidade:unit,quantidade_atual:amount(form,'quantidade_atual'),estoque_minimo:amount(form,'estoque_minimo'),consumo_medio_dia:amount(form,'consumo_medio_dia')});if(error)fail('estoque');done('estoque')}
export async function createTransaction(form:FormData){const {db,id}=await context();const tipo=field(form,'tipo'),valor=amount(form,'valor'),descricao=field(form,'descricao'),categoria=field(form,'categoria'),day=field(form,'data_competencia'),lot=field(form,'lote_id'),center=field(form,'centro_custo_id');if(!['receita','despesa'].includes(tipo)||!(valor>0)||!descricao||!categoria||!/^\d{4}-\d{2}-\d{2}$/.test(day))fail('registrar');if(lot){const {data}=await db.from('lotes').select('id').eq('id',lot).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}if(center){const {data}=await db.from('centros_custo').select('id').eq('id',center).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}const {error}=await db.from('transacoes').insert({fazenda_id:id,tipo,valor,descricao,categoria,data_competencia:day,status:field(form,'status')==='pendente'?'pendente':'pago',lote_id:lot||null,centro_custo_id:center||null,origem:'manual'});if(error)fail('registrar');revalidatePath('/painel/financeiro');done('registrar')}
