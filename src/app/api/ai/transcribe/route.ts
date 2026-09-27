import { NextRequest, NextResponse } from 'next/server';
import { aiContext } from '@/lib/ai-register';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origem inválida.'},{status:403});
  await aiContext();
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'A IA de voz ainda não está configurada no servidor.'},{status:503});
  const input=await request.formData(),file=input.get('audio');
  if(!(file instanceof File)||file.size<100||file.size>12_000_000||!file.type.startsWith('audio/'))return NextResponse.json({error:'Áudio inválido ou muito longo (máximo 12 MB).'},{status:400});
  const payload=new FormData();payload.set('file',file,'gravacao.'+(file.type.includes('mp4')?'mp4':file.type.includes('ogg')?'ogg':'webm'));payload.set('model','gpt-4o-mini-transcribe');payload.set('language','pt');
  const upstream=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:payload,signal:AbortSignal.timeout(30000)});
  if(!upstream.ok){const body=await upstream.json().catch(()=>({})) as {error?:{code?:string;type?:string}};const code=body.error?.code||body.error?.type||'desconhecido';console.error('OpenAI transcrição rejeitou a chamada',{status:upstream.status,code});return NextResponse.json({error:upstream.status===401?'A OpenAI recusou a chave configurada no servidor.':upstream.status===429?(code==='insufficient_quota'?'A conta da API OpenAI está sem créditos ou com limite de gastos atingido.':'A OpenAI atingiu um limite temporário. Tente novamente mais tarde.'):'Não foi possível transcrever este áudio.',diagnostico:code},{status:502})}
  const data=await upstream.json();return NextResponse.json({text:String(data.text||'').slice(0,1500)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível transcrever. Digite o registro.'},{status:400})}
}
