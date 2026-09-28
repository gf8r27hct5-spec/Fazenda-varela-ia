import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { conversationalAnswer, type Turn } from '@/lib/farm-conversation';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origem inválida.'},{status:403});
  const db=await createClient(),{data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({error:'Entre na sua conta para consultar a fazenda.'},{status:401});
  const body=await request.json(),question=body?.question;
  if(typeof question!=='string'||question.trim().length<4||question.length>350)return NextResponse.json({error:'Escreva uma pergunta de 4 a 350 caracteres.'},{status:400});
  const history:Turn[]=Array.isArray(body.history)?body.history.slice(-8).filter((t:unknown):t is Turn=>!!t&&typeof t==='object'&&['user','assistant'].includes((t as Turn).role)&&typeof (t as Turn).text==='string'&&(t as Turn).text.length<=700):[];
  const {data:farm,error}=await db.from('fazendas').select('id').eq('proprietario_id',user.id).order('criado_em').limit(1).maybeSingle();
  if(error||!farm)return NextResponse.json({error:'Fazenda indisponível para esta conta.'},{status:403});
  const result=await conversationalAnswer(db,farm.id,question.trim(),history);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Assistente: consulta falhou',e instanceof Error?e.message:'erro');return NextResponse.json({error:'Não foi possível consultar os dados agora. Tente novamente.'},{status:500});}
}
