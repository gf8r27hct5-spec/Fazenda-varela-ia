import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const runtime='nodejs';
const usage=new Map<string,{at:number,count:number}>();
export async function POST(request:NextRequest){
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origem inválida.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>4000)return NextResponse.json({error:'Resposta muito longa.'},{status:413});
  const db=await createClient(),{data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({error:'Entre na sua conta para ouvir a resposta.'},{status:401});
  const {data:farm}=await db.from('fazendas').select('id').eq('proprietario_id',user.id).limit(1).maybeSingle();
  if(!farm)return NextResponse.json({error:'Fazenda indisponível para esta conta.'},{status:403});
  const {text}=await request.json();
  if(typeof text!=='string'||text.length<2||text.length>1200)return NextResponse.json({error:'Resposta inválida para áudio.'},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Voz indisponível no servidor.'},{status:503});
  const now=Date.now(),previous=usage.get(user.id),current=previous&&now-previous.at<3600000?previous:{at:now,count:0};
  if(current.count>=30)return NextResponse.json({error:'Limite de áudio por hora atingido. Continue lendo as respostas em texto.'},{status:429});
  current.count++;usage.set(user.id,current);
  const upstream=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'coral',input:text,response_format:'mp3',instructions:'Fale em português brasileiro de forma clara e natural. Leia valores e unidades com cuidado.'}),signal:AbortSignal.timeout(30000)});
  if(!upstream.ok){console.error('Assistente áudio',upstream.status);return NextResponse.json({error:'Não foi possível gerar o áudio agora. A resposta continua disponível em texto.'},{status:502})}
  return new Response(upstream.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store, private','Content-Disposition':'inline'}});
 }catch{return NextResponse.json({error:'Não foi possível gerar o áudio agora.'},{status:500})}
}
