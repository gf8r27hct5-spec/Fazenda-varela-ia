 'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';
import { animalRelations, lotRelations, relatedTotal } from '@/lib/related-records';

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
  if (error) redirect(`/?modo=cadastro&origem=email&erro=${error.status === 429 ? 'limite-email' : 'cadastro'}`);
  redirect('/?modo=entrar&enviado=cadastro');
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) redirect('/?modo=recuperar&erro=email');
  const { error } = await emailClient().auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback` });
  if (error) redirect(`/?modo=recuperar&origem=email&erro=${error.status === 429 ? 'limite-email' : 'recuperacao'}`);
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
  if (!email) redirect('/?modo=entrar&origem=email&erro=email');
  // Email links may open in a different browser from the one that requested
  // them. The implicit flow does not require a PKCE verifier cookie there.
  const { error } = await emailClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback` } });
  if (error) {
    const limited = error.status === 429 || error.code === 'over_email_send_rate_limit';
    redirect(limited ? '/?modo=entrar&origem=email&erro=limite-email' : '/?modo=entrar&origem=email&erro=login');
  }
  redirect('/?modo=entrar&origem=email&enviado=1');
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || !password) redirect('/?modo=entrar&erro=credenciais');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') redirect('/?modo=entrar&erro=email-nao-confirmado');
    if (error.status === 429) redirect('/?modo=entrar&erro=tentativas-login');
    redirect('/?modo=entrar&erro=credenciais');
  }
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
  const status = 'ativo';
  if (loteId) { const { data: lot } = await supabase.from('lotes').select('id').eq('id', loteId).eq('fazenda_id', farm.id).eq('sistema','corte').maybeSingle(); if (!lot) redirect(`/painel/${modulo === 'leite' ? 'leite' : 'rebanho'}?erro=1`); }
  const bezerroId = modulo === 'leite' ? String(formData.get('bezerro_id') || '') : '';
  if (bezerroId) { const { data: calf } = await supabase.from('animais').select('id').eq('id', bezerroId).eq('fazenda_id',farm.id).eq('sistema','leite').eq('categoria','Cria leiteira').maybeSingle(); if (!calf) redirect('/painel/leite?erro=1'); }
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
    prenhe: modulo === 'leite' && (String(formData.get('prenhe')||'')==='sim'||String(formData.get('situacao_leite')||'')==='Prenhe'),
    data_cobertura: modulo === 'leite' ? String(formData.get('data_cobertura')||'')||null : null,
    touro_semen: modulo === 'leite' ? String(formData.get('touro_semen')||'')||null : null,
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
export async function createWeighing(form:FormData){
 const {db,id}=await context();const target=field(form,'target'),weight=amount(form,'peso_kg'),when=field(form,'data_pesagem');
 if(!/^[al]:[0-9a-f-]{36}$/i.test(target)||!(weight>0)||!/^\d{4}-\d{2}-\d{2}$/.test(when))fail('pesagens');
 const targetId=target.slice(2),individual=target.startsWith('a:');
 const result=individual?await db.from('animais').select('id,lote_id,status').eq('id',targetId).eq('fazenda_id',id).eq('sistema','corte').maybeSingle():await db.from('lotes').select('id').eq('id',targetId).eq('fazenda_id',id).eq('sistema','corte').maybeSingle();
 if(result.error||!result.data||individual&&'status' in result.data&&result.data.status!=='ativo')fail('pesagens');
 const lotId=individual&&result.data&&'lote_id' in result.data?result.data.lote_id:targetId;
 const count=field(form,'quantidade_animais');const {error}=await db.from('pesagens').insert({fazenda_id:id,lote_id:lotId||null,animal_id:individual?targetId:null,peso_kg:weight,data_pesagem:when,quantidade_animais:count?amount(form,'quantidade_animais'):null,responsavel:field(form,'responsavel')||null,observacoes:field(form,'observacoes')||null});
 if(error)fail('pesagens');if(lotId)revalidatePath(`/lotes/${lotId}`);if(individual)revalidatePath(`/animais/${targetId}`);done('pesagens');
}

export async function createLotBatchWeighing(form:FormData){
  const {db,id}=await context();const lot=field(form,'lote_id'),day=field(form,'data_pesagem');
  const weights=[...form.entries()].filter(([key,value])=>key.startsWith('peso_')&&String(value).trim()).map(([key,value])=>({animal_id:key.slice(5),peso_kg:Number(String(value).replace(',','.'))}));
  if(!uuid(lot)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!weights.length||weights.some(x=>!uuid(x.animal_id)||!(x.peso_kg>0)))redirect(`/lotes/${lot}?erro=pesagem`);
  const {data:owned}=await db.from('lotes').select('id').eq('id',lot).eq('fazenda_id',id).eq('sistema','corte').maybeSingle();
  if(!owned)fail('pesagens');
  const {error}=await db.rpc('registrar_pesagens_lote_corte',{p_lote_id:lot,p_data:day,p_pesos:weights,p_responsavel:field(form,'responsavel')||null,p_observacoes:field(form,'observacoes')||null});
  if(error)redirect(`/lotes/${lot}?erro=pesagem`);
  revalidatePath(`/lotes/${lot}`);revalidatePath('/painel/pesagens');revalidatePath('/painel/rebanho');
  for(const item of weights)revalidatePath(`/animais/${item.animal_id}`);
  redirect(`/lotes/${lot}?salvo=pesagem`);
}

export async function createSanitaryRecord(form:FormData){
  const {db,id}=await context();const lot=field(form,'lote_id'),animalIds=[...new Set(form.getAll('animal_id').map(String))];
  if(!uuid(lot)||!animalIds.length||animalIds.some(x=>!uuid(x)))fail('sanidade');
  const {data:owned}=await db.from('lotes').select('id').eq('id',lot).eq('fazenda_id',id).eq('sistema','corte').maybeSingle();if(!owned)fail('sanidade');
  const keys=['tipo','produto','dose','dose_unidade','via_aplicacao','lote_produto','motivo','frequencia','duracao_dias','data_manejo','data_fim','carencia_dias','data_fim_carencia','proxima_data','responsavel','observacoes'];
  const data=Object.fromEntries(keys.map(key=>[key,field(form,key)]));
  if(!data.produto||!/^\d{4}-\d{2}-\d{2}$/.test(data.data_manejo)||!['vacina','medicamento','vermifugo','antiparasitario','vitamina','exame','diagnostico','procedimento','outro'].includes(data.tipo))fail('sanidade');
  const {error}=await db.rpc('registrar_manejo_corte',{p_lote_id:lot,p_animais:animalIds,p_dados:data});
  if(error)redirect('/painel/sanidade?erro=1');
  revalidatePath('/painel/sanidade');revalidatePath(`/lotes/${lot}`);for(const animal of animalIds)revalidatePath(`/animais/${animal}`);
  redirect(`/painel/sanidade?lote=${lot}&salvo=1`);
}

export async function createExitRecord(form:FormData){
  const {db,id}=await context();const animal=field(form,'animal_id');
  if(!uuid(animal)||field(form,'confirmacao')!=='ENCERRAR')fail('rebanho');
  const {data:owned}=await db.from('animais').select('id,lote_id').eq('id',animal).eq('fazenda_id',id).eq('sistema','corte').eq('status','ativo').maybeSingle();
  if(!owned)redirect(`/animais/${animal}?aba=saida&erro=saida`);
  const keys=['tipo','data_saida','peso_final','rendimento_carcaca','valor_venda','frete','outras_despesas','comprador_destino','observacoes'];
  const data=Object.fromEntries(keys.map(key=>[key,field(form,key)]));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.data_saida)||['valor_venda','frete','outras_despesas'].some(k=>data[k]&&(!Number.isFinite(Number(data[k]))||Number(data[k])<0)))redirect(`/animais/${animal}?aba=saida&erro=saida`);
  const {error}=await db.rpc('registrar_saida_corte',{p_animal_id:animal,p_dados:data});
  if(error)redirect(`/animais/${animal}?aba=saida&erro=saida`);
  revalidatePath('/painel');revalidatePath('/painel/rebanho');revalidatePath('/painel/financeiro');
  if(owned.lote_id)revalidatePath(`/lotes/${owned.lote_id}`);
  revalidatePath(`/animais/${animal}`);redirect(`/animais/${animal}?aba=saida&salvo=1`);
}
export async function createMilk(form:FormData){const {db,id}=await context();const liters=amount(form,'litros'),day=field(form,'data_producao'),price=field(form,'preco_litro');if(!(liters>0)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||price&&amount(form,'preco_litro')<0)fail('leite');const turno=field(form,'turno');if(turno&&!['manha','tarde','noite','total_dia'].includes(turno))fail('leite');const animalId=field(form,'animal_id');if(animalId){const {data:animal}=await db.from('animais').select('id,sistema,categoria').eq('id',animalId).eq('fazenda_id',id).maybeSingle();if(!animal||animal.sistema!=='leite'||animal.categoria==='Cria leiteira')fail('leite');}const {error}=await db.from('producao_leite').insert({fazenda_id:id,animal_id:animalId||null,litros:liters,data_producao:day,turno:turno||null,preco_litro:price?amount(form,'preco_litro'):null});if(error)fail('leite');done('leite')}

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const dairyError = (code='dados'): never => redirect(`/painel/reproducao?erro=${code}`);

export async function saveDairyPregnancy(form: FormData) {
  const {db,id}=await context();const cow=field(form,'vaca_id'),pregnant=field(form,'prenhe')==='sim';
  const covered=field(form,'data_cobertura'),due=field(form,'proxima_previsao_parto'),bull=field(form,'touro_semen'),note=field(form,'observacoes_reproducao');
  if(!uuid(cow)||covered&&!validDate(covered)||due&&!validDate(due)||covered&&due&&due<covered||bull.length>120||note.length>2000) dairyError();
  const {data,error:lookup}=await db.from('animais').select('id').eq('id',cow).eq('fazenda_id',id).eq('sistema','leite').neq('categoria','Cria leiteira').maybeSingle();
  if(lookup||!data) dairyError();
  const {error}=await db.from('animais').update({prenhe:pregnant,data_cobertura:pregnant?covered||null:null,touro_semen:pregnant?bull||null:null,proxima_previsao_parto:pregnant?due||null:null,observacoes_reproducao:note||null}).eq('id',cow).eq('fazenda_id',id).eq('sistema','leite');
  if(error)redirect(`/animais/${cow}?aba=reproducao&erro=1`);
  revalidatePath(`/animais/${cow}`);revalidatePath('/painel/reproducao');revalidatePath('/painel/leite');
  redirect(`/animais/${cow}?aba=reproducao&salvo=1`);
}

export async function registerDairyBirth(form: FormData) {
  const {db,id}=await context();const cow=field(form,'vaca_id'),day=field(form,'data_parto'),type=field(form,'tipo_parto');
  const count=Number(field(form,'quantidade_crias'));
  if(!uuid(cow)||!validDate(day)||!Number.isInteger(count)||count<1||count>8||type&&!['normal','assistido','cesarea'].includes(type)) dairyError();
  const {data:mother}=await db.from('animais').select('id').eq('id',cow).eq('fazenda_id',id).eq('sistema','leite').neq('categoria','Cria leiteira').eq('status','ativo').maybeSingle();if(!mother)dairyError();
  const calves=Array.from({length:count},(_,i)=>({
    identificacao:field(form,`identificacao_${i}`),nome:field(form,`nome_${i}`),sexo:field(form,`sexo_${i}`),raca:field(form,`raca_${i}`),
    peso_nascer:field(form,`peso_nascer_${i}`),situacao:field(form,`situacao_${i}`),observacoes:field(form,`observacoes_${i}`),pai_touro:field(form,`pai_touro_${i}`),
  }));
  if(calves.some(c=>!['viva','natimorta','morreu_depois'].includes(c.situacao)||c.situacao==='viva'&&!c.identificacao||c.identificacao.length>80||c.nome.length>120||!['','macho','femea'].includes(c.sexo)||c.peso_nascer&&(!(Number(c.peso_nascer)>0)||!Number.isFinite(Number(c.peso_nascer))))) dairyError();
  const {error}=await db.rpc('registrar_parto_leite',{p_mae_id:cow,p_data:day,p_tipo:type||null,p_lactacao:field(form,'lactacao')==='sim',p_observacoes:field(form,'observacoes')||null,p_crias:calves});
  if(error)redirect(`/painel/reproducao/parto?mae=${cow}&erro=1`);
  revalidatePath(`/animais/${cow}`);revalidatePath('/painel/reproducao');revalidatePath('/painel/leite');revalidatePath('/painel');
  redirect(`/animais/${cow}?aba=reproducao&salvo=parto`);
}

export async function createDairyCalf(form:FormData){
  const {db,id}=await context();const cow=field(form,'mae_id'),tag=field(form,'identificacao'),birth=field(form,'data_nascimento');
  const sex=field(form,'sexo'),situation=field(form,'situacao_cria'),weight=field(form,'peso_entrada'),current=field(form,'peso_atual'),wean=field(form,'data_desmame'),planned=field(form,'data_prevista_desmame');
  if(!uuid(cow)||!tag||tag.length>80||!validDate(birth)||!['','macho','femea'].includes(sex)||!['mamando','desmamada','vendida','transferida','morta'].includes(situation)
    ||weight&&!(Number(weight)>0)||current&&!(Number(current)>0)||wean&&!validDate(wean)||planned&&!validDate(planned)||wean&&wean<birth||planned&&planned<birth) dairyError();
  const {data:mother}=await db.from('animais').select('id').eq('id',cow).eq('fazenda_id',id).eq('sistema','leite').neq('categoria','Cria leiteira').maybeSingle();if(!mother)dairyError();
  const photo=form.get('foto');let photoPath:string|null=null;
  if(photo instanceof File&&photo.size){const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'} as Record<string,string>)[photo.type];if(!ext||photo.size>3670016)dairyError('foto');photoPath=`${id}/${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('fotos-animais').upload(photoPath,photo,{contentType:photo.type,upsert:false});if(error)dairyError('foto')}
  const {data,error}=await db.from('animais').insert({fazenda_id:id,mae_id:cow,identificacao:tag,nome:field(form,'nome')||null,sexo:sex||null,raca:field(form,'raca')||null,
    sistema:'leite',categoria:'Cria leiteira',status:situation==='morta'?'morto':situation==='vendida'?'vendido':situation==='transferida'?'transferido':'ativo',situacao_cria:situation,
    data_nascimento:birth,data_entrada:birth,peso_entrada:weight?Number(weight):null,peso_atual:current?Number(current):weight?Number(weight):null,
    data_desmame:wean||null,data_prevista_desmame:planned||null,pai_touro:field(form,'pai_touro')||null,observacoes:field(form,'observacoes')||null,foto_url:photoPath,
  }).select('id').single();
  if(error||!data){if(photoPath)await db.storage.from('fotos-animais').remove([photoPath]);dairyError('cadastro')}
  revalidatePath(`/animais/${cow}`);revalidatePath('/painel/reproducao');revalidatePath('/painel/leite');
  if(!data)redirect('/painel/reproducao?erro=cadastro');
  redirect(`/animais/${data.id}?salvo=1`);
}

export async function updateDairyCalf(form:FormData){
  const {db,id}=await context();const calf=field(form,'cria_id'),situation=field(form,'situacao_cria'),wean=field(form,'data_desmame'),planned=field(form,'data_prevista_desmame');
  if(!uuid(calf)||!['mamando','desmamada','vendida','transferida','morta','natimorta'].includes(situation)||wean&&!validDate(wean)||planned&&!validDate(planned)) dairyError();
  const {data}=await db.from('animais').select('data_nascimento').eq('id',calf).eq('fazenda_id',id).eq('sistema','leite').eq('categoria','Cria leiteira').maybeSingle();if(!data||wean&&data.data_nascimento&&wean<data.data_nascimento)dairyError();
  const {error}=await db.from('animais').update({situacao_cria:situation,status:situation==='morta'||situation==='natimorta'?'morto':situation==='vendida'?'vendido':situation==='transferida'?'transferido':'ativo',
    data_desmame:wean||null,data_prevista_desmame:planned||null,nome:field(form,'nome')||null,raca:field(form,'raca')||null,pai_touro:field(form,'pai_touro')||null,observacoes:field(form,'observacoes')||null,
  }).eq('id',calf).eq('fazenda_id',id).eq('sistema','leite');
  if(error)redirect(`/animais/${calf}?erro=1`);
  revalidatePath(`/animais/${calf}`);revalidatePath('/painel/leite');revalidatePath('/painel/reproducao');redirect(`/animais/${calf}?salvo=1`);
}

export async function registerDairyCalfWeight(form:FormData){
  const {db,id}=await context();const calf=field(form,'cria_id'),day=field(form,'data_pesagem'),weight=amount(form,'peso_kg');
  if(!uuid(calf)||!validDate(day)||!(weight>0)) dairyError();
  const {data}=await db.from('animais').select('id').eq('id',calf).eq('fazenda_id',id).eq('sistema','leite').eq('categoria','Cria leiteira').maybeSingle();if(!data)dairyError();
  const {error}=await db.rpc('registrar_peso_cria_leite',{p_cria_id:calf,p_data:day,p_peso:weight});if(error)redirect(`/animais/${calf}?erro=peso`);
  revalidatePath(`/animais/${calf}`);revalidatePath('/painel/reproducao');redirect(`/animais/${calf}?salvo=peso`);
}

export async function transferDairyCalfToBeef(form:FormData){
  const {db,id}=await context();const calf=field(form,'cria_id');if(!uuid(calf)||field(form,'confirmacao')!=='TRANSFERIR')dairyError();
  const {data}=await db.from('animais').select('id,sexo').eq('id',calf).eq('fazenda_id',id).eq('sistema','leite').eq('categoria','Cria leiteira').eq('status','ativo').maybeSingle();if(!data)redirect('/painel/reproducao?erro=dados');
  const {error}=await db.from('animais').update({sistema:'corte',categoria:data.sexo==='femea'?'Bezerra':'Bezerro',situacao_cria:'transferida',situacao_leite:null,lote_id:null}).eq('id',calf).eq('fazenda_id',id).eq('sistema','leite');
  if(error)redirect(`/animais/${calf}?erro=1`);
  revalidatePath(`/animais/${calf}`);revalidatePath('/painel/reproducao');revalidatePath('/painel/leite');revalidatePath('/painel/rebanho');revalidatePath('/painel');
  redirect(`/animais/${calf}?salvo=transferencia`);
}
export async function createStock(form:FormData){const {db,id}=await context();const nome=field(form,'nome'),unit=field(form,'unidade');if(!nome||!unit||amount(form,'quantidade_atual')<0)fail('estoque');const {error}=await db.from('estoque').insert({fazenda_id:id,nome,categoria:field(form,'categoria'),unidade:unit,quantidade_atual:amount(form,'quantidade_atual'),estoque_minimo:amount(form,'estoque_minimo'),consumo_medio_dia:amount(form,'consumo_medio_dia')});if(error)fail('estoque');done('estoque')}
export async function createTransaction(form:FormData){const {db,id}=await context();const tipo=field(form,'tipo'),valor=amount(form,'valor'),descricao=field(form,'descricao'),categoria=field(form,'categoria'),day=field(form,'data_competencia'),lot=field(form,'lote_id'),center=field(form,'centro_custo_id');if(!['receita','despesa'].includes(tipo)||!(valor>0)||!descricao||!categoria||!/^\d{4}-\d{2}-\d{2}$/.test(day))fail('registrar');if(lot){const {data}=await db.from('lotes').select('id').eq('id',lot).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}if(center){const {data}=await db.from('centros_custo').select('id').eq('id',center).eq('fazenda_id',id).maybeSingle();if(!data)fail('registrar')}const {error}=await db.from('transacoes').insert({fazenda_id:id,tipo,valor,descricao,categoria,data_competencia:day,status:field(form,'status')==='pendente'?'pendente':'pago',lote_id:lot||null,centro_custo_id:center||null,origem:'manual'});if(error)fail('registrar');revalidatePath('/painel/financeiro');done('registrar')}

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const dayOrNull = (value: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export async function updateCutAnimal(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id'), identification = field(form, 'identificacao'), sex = field(form, 'sexo');
  if (!uuid(id) || !identification || identification.length > 80 || !['', 'macho', 'femea'].includes(sex)) redirect('/painel/rebanho?erro=1');
  const { data: animal } = await db.from('animais').select('id').eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (!animal) redirect('/painel/rebanho?erro=1');
  const lotId = field(form, 'lote_id');
  if (lotId) {
    const { data: lot } = await db.from('lotes').select('id').eq('id', lotId).eq('fazenda_id', farmId).eq('sistema', 'corte').eq('ativo', true).maybeSingle();
    if (!lot) redirect(`/animais/${id}?acao=editar&erro=1`);
  }
  const weight = field(form, 'peso_entrada'), current = field(form, 'peso_atual'), price = field(form, 'valor_compra');
  if ([weight, current, price].some(value => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) redirect(`/animais/${id}?acao=editar&erro=1`);
  const { error } = await db.from('animais').update({
    identificacao: identification, nome: field(form, 'nome') || null,
    sexo: sex || null, categoria: field(form, 'categoria') || null, raca: field(form, 'raca') || null,
    data_nascimento: dayOrNull(field(form, 'data_nascimento')), data_entrada: dayOrNull(field(form, 'data_entrada')),
    peso_entrada: weight ? Number(weight) : null, peso_atual: current ? Number(current) : null,
    valor_compra: price ? Number(price) : null, origem: field(form, 'origem') || null,
    observacoes: field(form, 'observacoes') || null, lote_id: lotId || null,
  }).eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte');
  if (error) redirect(`/animais/${id}?acao=editar&erro=1`);
  revalidatePath('/painel/rebanho'); revalidatePath('/painel'); revalidatePath(`/animais/${id}`);
  redirect(`/animais/${id}?salvo=1`);
}

export async function moveCutAnimal(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id'), lotId = field(form, 'lote_id');
  if (!uuid(id) || lotId && !uuid(lotId)) redirect('/painel/rebanho?erro=1');
  const { data: animal } = await db.from('animais').select('id,lote_id').eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (!animal) redirect('/painel/rebanho?erro=1');
  if (lotId) {
    const { data: lot } = await db.from('lotes').select('id').eq('id', lotId).eq('fazenda_id', farmId).eq('sistema', 'corte').eq('ativo', true).maybeSingle();
    if (!lot) redirect(`/animais/${id}?acao=mover&erro=1`);
  }
  const { error } = await db.from('animais').update({ lote_id: lotId || null }).eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte');
  if (error) redirect(`/animais/${id}?acao=mover&erro=1`);
  if (animal.lote_id) revalidatePath(`/lotes/${animal.lote_id}`);
  if (lotId) revalidatePath(`/lotes/${lotId}`);
  revalidatePath('/painel/rebanho'); redirect(`/animais/${id}?salvo=1`);
}

export async function changeCutAnimalStatus(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id'), status = field(form, 'status');
  if (!uuid(id) || !['ativo', 'inativo'].includes(status)) redirect('/painel/rebanho?erro=1');
  const { data: animal, error: lookup } = await db.from('animais').select('lote_id,status').eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (lookup || !animal) redirect('/painel/rebanho?erro=1');
  if (!((animal.status==='ativo'&&status==='inativo')||(animal.status==='inativo'&&status==='ativo'))) redirect(`/animais/${id}?erro=1`);
  const { data: closed } = await db.from('saidas_corte').select('id').eq('animal_id',id).eq('fazenda_id',farmId).maybeSingle();
  if (closed) redirect(`/animais/${id}?erro=1`);
  const { error } = await db.from('animais').update({ status }).eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').eq('status',animal.status);
  if (error) redirect(`/animais/${id}?acao=status&erro=1`);
  revalidatePath('/painel'); revalidatePath('/painel/rebanho');
  if (animal.lote_id) revalidatePath(`/lotes/${animal.lote_id}`);
  redirect(`/animais/${id}?salvo=1`);
}

export async function deleteCutAnimal(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id');
  if (!uuid(id) || field(form, 'confirmacao') !== 'EXCLUIR') redirect('/painel/rebanho?erro=1');
  const { data: animal } = await db.from('animais').select('id,lote_id,foto_url').eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (!animal) redirect('/painel/rebanho?erro=1');
  const related = relatedTotal(await animalRelations(db, id, farmId));
  const expected = Number(field(form, 'registros_esperados'));
  const confirmed = field(form, 'confirmar_relacionados') === 'sim';
  if (!Number.isSafeInteger(expected) || expected !== related || related > 0 && !confirmed) redirect(`/animais/${id}?acao=excluir&erro=1`);
  const { error } = await db.rpc('excluir_animal_confirmado', { p_animal_id: id, p_registros_esperados: expected, p_confirmar_relacionados: confirmed });
  if (error) redirect(`/animais/${id}?acao=excluir&erro=1`);
  if (animal.foto_url) await db.storage.from('fotos-animais').remove([animal.foto_url]);
  revalidatePath('/painel'); revalidatePath('/painel/rebanho');
  if (animal.lote_id) revalidatePath(`/lotes/${animal.lote_id}`);
  redirect('/painel/rebanho?salvo=1');
}

export async function updateCutLot(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id'), name = field(form, 'nome'), goal = field(form, 'peso_meta');
  if (!uuid(id) || !name || name.length > 120 || goal && !(Number(goal) > 0)) redirect('/painel/rebanho?erro=1');
  const { error } = await db.from('lotes').update({ nome: name, categoria: field(form, 'categoria') || null, raca: field(form, 'raca') || null, peso_meta: goal ? Number(goal) : null }).eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte');
  if (error) redirect(`/lotes/${id}?acao=editar&erro=1`);
  revalidatePath('/painel/rebanho'); redirect(`/lotes/${id}?salvo=1`);
}

export async function moveCutLotAnimals(form: FormData) {
  const { db, id: farmId } = await context();
  const source = field(form, 'id'), target = field(form, 'lote_id');
  const ids = [...new Set(form.getAll('animal_id').map(String))];
  if (!uuid(source) || target && !uuid(target) || !ids.length || ids.some(value => !uuid(value)) || target === source) redirect('/painel/rebanho?erro=1');
  const { data: sourceLot } = await db.from('lotes').select('id').eq('id', source).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (!sourceLot) redirect('/painel/rebanho?erro=1');
  if (target) {
    const { data: targetLot } = await db.from('lotes').select('id').eq('id', target).eq('fazenda_id', farmId).eq('sistema', 'corte').eq('ativo', true).maybeSingle();
    if (!targetLot) redirect(`/lotes/${source}?acao=mover&erro=1`);
  }
  const { data: selected, error: lookup } = await db.from('animais').select('id').eq('fazenda_id', farmId).eq('lote_id', source).eq('sistema', 'corte').in('id', ids);
  if (lookup || selected?.length !== ids.length) redirect(`/lotes/${source}?acao=mover&erro=1`);
  const { error } = await db.from('animais').update({ lote_id: target || null }).eq('fazenda_id', farmId).eq('lote_id', source).in('id', ids);
  if (error) redirect(`/lotes/${source}?acao=mover&erro=1`);
  revalidatePath('/painel/rebanho'); revalidatePath(`/lotes/${source}`);
  if (target) revalidatePath(`/lotes/${target}`);
  redirect(`/lotes/${source}?salvo=1`);
}

export async function archiveCutLot(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id');
  if (!uuid(id)) redirect('/painel/rebanho?erro=1');
  const { error } = await db.from('lotes').update({ ativo: false }).eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte');
  if (error) redirect(`/lotes/${id}?acao=arquivar&erro=1`);
  revalidatePath('/painel/rebanho'); redirect(`/lotes/${id}?salvo=1`);
}

export async function deleteCutLot(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id');
  if (!uuid(id) || field(form, 'confirmacao') !== 'EXCLUIR') redirect('/painel/rebanho?erro=1');
  const { data: lot } = await db.from('lotes').select('id').eq('id', id).eq('fazenda_id', farmId).eq('sistema', 'corte').maybeSingle();
  if (!lot) redirect('/painel/rebanho?erro=1');
  const relations = await lotRelations(db, id, farmId);
  const related = relatedTotal(relations, ['animais']), expected = Number(field(form, 'registros_esperados'));
  const confirmed = field(form, 'confirmar_relacionados') === 'sim';
  if (relations.animais || !Number.isSafeInteger(expected) || expected !== related || related > 0 && !confirmed) redirect(`/lotes/${id}?acao=excluir&erro=1`);
  const { error } = await db.rpc('excluir_lote_confirmado', { p_lote_id: id, p_registros_esperados: expected, p_confirmar_relacionados: confirmed });
  if (error) redirect(`/lotes/${id}?acao=excluir&erro=1`);
  revalidatePath('/painel'); done('rebanho');
}

// Shared, confirmed cleanup for records that do not have a dedicated detail page yet.
// The table name is never trusted: it is checked against this allow-list and every
// mutation is scoped to the authenticated user's farm.
export async function deleteFarmRecord(form: FormData) {
  const { db, id: farmId } = await context();
  const table = field(form, 'table'), recordId = field(form, 'id'), confirmation = field(form, 'confirmacao');
  const allowed = ['transacoes','pesagens','producao_leite','manejos'] as const;
  if (!allowed.includes(table as typeof allowed[number]) || !uuid(recordId) || confirmation !== 'EXCLUIR') redirect('/painel?erro=1');
  const destination: Record<string,string> = {transacoes:'financeiro',pesagens:'pesagens',producao_leite:'leite',manejos:'sanidade'};
  const { data: record } = await db.from(table).select('*').eq('id', recordId).eq('fazenda_id', farmId).maybeSingle();
  if (!record) redirect('/painel?erro=1');
  if (table === 'transacoes' && record.origem === 'saida') redirect('/painel/financeiro?erro=1');
  const { error } = await db.from(table).delete().eq('id', recordId).eq('fazenda_id', farmId);
  if (error) redirect(`/painel/${destination[table]}?erro=1`);
  revalidatePath('/painel'); revalidatePath('/painel/financeiro'); revalidatePath('/painel/rebanho'); revalidatePath('/painel/pesagens'); revalidatePath('/painel/leite'); revalidatePath('/painel/estoque'); revalidatePath('/painel/sanidade');
  if (record.animal_id) revalidatePath(`/animais/${record.animal_id}`);
  if (record.lote_id) revalidatePath(`/lotes/${record.lote_id}`);
  redirect(`/painel/${destination[table]}?salvo=exclusao`);
}

export async function archiveFarmAnimal(form: FormData) {
  const { db, id: farmId } = await context();
  const id = field(form, 'id');
  if (!uuid(id) || field(form, 'confirmacao') !== 'ARQUIVAR') redirect('/painel/leite?erro=1');
  const {error}=await db.from('animais').update({status:'inativo'}).eq('id',id).eq('fazenda_id',farmId).eq('sistema','leite').eq('status','ativo');
  if (error) redirect('/painel/leite?erro=1');
  revalidatePath('/painel'); revalidatePath('/painel/leite'); revalidatePath('/painel/rebanho'); revalidatePath(`/animais/${id}`);
  redirect('/painel/leite?salvo=arquivado');
}

export async function archiveFarmRecord(form:FormData){
  const {db,id:farmId}=await context(),table=field(form,'table'),id=field(form,'id');
  if(!['estoque','centros_custo'].includes(table)||!uuid(id)||field(form,'confirmacao')!=='ARQUIVAR')redirect('/painel?erro=1');
  const destination=table==='estoque'?'estoque':'financeiro';
  const {error}=await db.from(table).update({ativo:false}).eq('id',id).eq('fazenda_id',farmId);
  if(error)redirect(`/painel/${destination}?erro=1`);
  revalidatePath('/painel');revalidatePath(`/painel/${destination}`);
  redirect(`/painel/${destination}?salvo=arquivado`);
}

export async function editFarmRecord(form:FormData){
  const {db,id:farmId}=await context(),table=field(form,'table'),id=field(form,'id');
  const route:Record<string,string>={transacoes:'financeiro',centros_custo:'financeiro',pesagens:'pesagens',producao_leite:'leite',manejos:'sanidade',estoque:'estoque'};
  if(!route[table]||!uuid(id))redirect('/painel?erro=1');
  const {data:record}=await db.from(table).select('*').eq('id',id).eq('fazenda_id',farmId).maybeSingle();
  if(!record||table==='transacoes'&&record.origem==='saida')redirect(`/painel/${route[table]}?erro=1`);
  const numeric=(key:string,required=false)=>{const v=field(form,key);if(!v&&!required)return null;const parsed=Number(v.replace(',','.'));return Number.isFinite(parsed)&&parsed>=(required?0.000001:0)?parsed:null};
  const dated=(key:string)=>{const v=field(form,key);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:null};
  let changes:Record<string,string|number|boolean|null>={};
  if(table==='transacoes'){
    const amount=numeric('valor',true),date=dated('data_competencia'),description=field(form,'descricao');
    if(amount===null||!date||!description||description.length>180)redirect(`/painel/${route[table]}?erro=1`);
    changes={valor:amount,data_competencia:date,descricao:description,categoria:field(form,'categoria')||'Outros',status:field(form,'status')==='pendente'?'pendente':'pago'};
  }else if(table==='producao_leite'){
    const liters=numeric('litros',true),date=dated('data_producao'),turn=field(form,'turno'),price=numeric('preco_litro');
    if(liters===null||!date||price===null&&field(form,'preco_litro')||!['','manha','tarde','noite','total_dia'].includes(turn))redirect('/painel/leite?erro=1');
    changes={litros:liters,data_producao:date,turno:turn||null,preco_litro:price,observacoes:field(form,'observacoes')||null};
  }else if(table==='pesagens'){
    const weight=numeric('peso_kg',true),date=dated('data_pesagem');
    if(weight===null||!date)redirect('/painel/pesagens?erro=1');
    changes={peso_kg:weight,data_pesagem:date,responsavel:field(form,'responsavel')||null,observacoes:field(form,'observacoes')||null};
  }else if(table==='manejos'){
    const product=field(form,'produto'),date=dated('data_manejo');
    if(!product||!date)redirect('/painel/sanidade?erro=1');
    changes={produto:product,data_manejo:date,dose:field(form,'dose')||null,proxima_data:dated('proxima_data'),data_fim_carencia:dated('data_fim_carencia'),responsavel:field(form,'responsavel')||null,observacoes:field(form,'observacoes')||null};
  }else if(table==='estoque'){
    const name=field(form,'nome'),unit=field(form,'unidade'),quantity=numeric('quantidade_atual'),minimum=numeric('estoque_minimo'),consumption=numeric('consumo_medio_dia');
    if(!name||!unit||[quantity,minimum,consumption].some(v=>v===null)&&['quantidade_atual','estoque_minimo','consumo_medio_dia'].some(key=>field(form,key)&&numeric(key)===null))redirect('/painel/estoque?erro=1');
    changes={nome:name,unidade:unit,categoria:field(form,'categoria')||null,quantidade_atual:quantity??0,estoque_minimo:minimum,consumo_medio_dia:consumption,ativo:field(form,'ativo')==='sim'};
  }else if(table==='centros_custo'){
    const name=field(form,'nome');if(!name||name.length>120)redirect('/painel/financeiro?erro=1');
    changes={nome:name,descricao:field(form,'descricao')||null,ativo:field(form,'ativo')==='sim'};
  }
  const {error}=await db.from(table).update(changes).eq('id',id).eq('fazenda_id',farmId);
  if(error)redirect(`/painel/${route[table]}?erro=1`);
  revalidatePath('/painel');revalidatePath(`/painel/${route[table]}`);
  if(record.animal_id)revalidatePath(`/animais/${record.animal_id}`);
  if(record.lote_id)revalidatePath(`/lotes/${record.lote_id}`);
  redirect(`/painel/${route[table]}?salvo=edicao`);
}

export async function editDairyAnimal(form:FormData){
 const {db,id:farmId}=await context(),id=field(form,'id'),tag=field(form,'identificacao'),status=field(form,'status');
 if(!uuid(id)||!tag||tag.length>80||!['ativo','inativo'].includes(status))redirect('/painel/leite?erro=1');
 const {data:animal}=await db.from('animais').select('id,categoria').eq('id',id).eq('fazenda_id',farmId).eq('sistema','leite').maybeSingle();
 if(!animal)redirect('/painel/leite?erro=1');
 const weight=field(form,'peso_atual');if(weight&&(!Number.isFinite(Number(weight))||Number(weight)<0))redirect(`/painel/editar/animais/${id}?erro=1`);
 const {error}=await db.from('animais').update({identificacao:tag,nome:field(form,'nome')||null,raca:field(form,'raca')||null,peso_atual:weight?Number(weight):null,observacoes:field(form,'observacoes')||null,status}).eq('id',id).eq('fazenda_id',farmId).eq('sistema','leite');
 if(error)redirect(`/painel/editar/animais/${id}?erro=1`);
 revalidatePath('/painel');revalidatePath('/painel/leite');revalidatePath('/painel/reproducao');revalidatePath(`/animais/${id}`);
 redirect(`/animais/${id}?salvo=1`);
}
