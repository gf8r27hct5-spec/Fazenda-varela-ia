import { NextRequest, NextResponse } from 'next/server';
import { aiContext, prepare } from '@/lib/ai-register';
import { revalidatePath } from 'next/cache';
export const runtime='nodejs';
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)return json({error:'Origem inválida.'},403);
  if(Number(request.headers.get('content-length')||0)>7000)return json({error:'Prévia muito longa.'},413);
  const ctx=await aiContext();const body=await request.json();const id=String(body.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Rascunho inválido.'},400);
  const {data:draft,error:readError}=await ctx.db.from('registros_ia').select('id,resultado,estado,criado_em').eq('id',id).eq('fazenda_id',ctx.farm.id).eq('usuario_id',ctx.user.id).maybeSingle();
  if(readError||!draft||draft.estado!=='pendente'||Date.now()-Date.parse(draft.criado_em)>86400000)return json({error:'Rascunho indisponível ou expirado.'},409);
  if(body.action==='cancelar'){
   const {error}=await ctx.db.rpc('finalizar_registro_ia',{p_id:id,p_acao:'cancelar',p_dados:{}});
   return error?json({error:'Não foi possível cancelar.'},409):json({status:'cancelado'});
  }
  if(body.action!=='confirmar')return json({error:'Ação inválida.'},400);
  const fields=body.fields||draft.resultado;
  if(fields.tipo!==draft.resultado.tipo)return json({error:'Para mudar o tipo de operação, escreva uma nova frase.'},400);
  const checked=prepare(fields,ctx);
  if(!checked.canConfirm)return json({error:'Revise os campos indicados antes de confirmar.',...checked},422);
  if(['venda','abate','morte'].includes(checked.fields.tipo)&&body.critical!==true)return json({error:'Confirme expressamente a saída do animal.'},422);
  const {data,error}=await ctx.db.rpc('finalizar_registro_ia',{p_id:id,p_acao:'confirmar',p_dados:checked.record});
  if(error)return json({error:error.message.includes('já finalizado')?'Este registro já foi confirmado ou cancelado.':'Não foi possível salvar. Revise dados, vínculos e data.'},409);
  for(const path of ['/painel','/painel/financeiro','/painel/rebanho','/painel/pesagens','/painel/sanidade','/painel/leite','/painel/estoque','/painel/registrar'])revalidatePath(path);
  if(checked.record.animal_id)revalidatePath(`/animais/${checked.record.animal_id}`);
  if(checked.record.lote_id)revalidatePath(`/lotes/${checked.record.lote_id}`);
  return json({status:'confirmado',operationId:data});
 }catch(error){return json({error:error instanceof Error?error.message:'Não foi possível concluir.'},400)}
}
