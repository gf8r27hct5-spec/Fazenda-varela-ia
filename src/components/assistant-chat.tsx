'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
type Message={role:'user'|'assistant';text:string;metric?:string;label?:string};
const suggestions=['Quem está mais longe da meta?','Qual novilha está mais atrasada?','Compare B189 e B205','Quanto produziu o tanque este mês?','Qual despesa foi maior?','Quais itens do estoque estão baixos?'];
export function AssistantChat({storageKey}:{storageKey:string}){
 const key=`fazenda-assistant:${storageKey}`;
 const [messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[note,setNote]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),end=useRef<HTMLDivElement>(null);
 const [autoVoice,setAutoVoice]=useState(false),[playing,setPlaying]=useState<number|null>(null),[audioReady,setAudioReady]=useState<number|null>(null),[preparing,setPreparing]=useState<number|null>(null);
 const history=useRef<Message[]>([]),busyRef=useRef(false),autoRef=useRef(false);
 const voiceContext=useRef<AudioContext|null>(null),voiceSource=useRef<AudioBufferSourceNode|null>(null),voiceBuffers=useRef<Map<number,AudioBuffer>>(new Map());
 const voiceRequest=useRef<AbortController|null>(null),playbackGeneration=useRef(0),playingIndex=useRef<number|null>(null);
 const voiceChannel=useRef<BroadcastChannel|null>(null);
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(saved)){const valid=saved.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.text==='string').slice(-30);setMessages(valid);history.current=valid}const enabled=localStorage.getItem(key+':audio')==='true';setAutoVoice(enabled);autoRef.current=enabled}catch{}},[key]);
 useEffect(()=>{history.current=messages;if(messages.length)try{sessionStorage.setItem(key,JSON.stringify(messages.slice(-30)))}catch{};end.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[messages,key]);
 useEffect(()=>()=>{playbackGeneration.current++;voiceRequest.current?.abort();recorder.current?.stream?.getTracks().forEach(t=>t.stop());try{voiceSource.current?.stop()}catch{};if('speechSynthesis' in window)window.speechSynthesis.cancel();void voiceContext.current?.close()},[]);
 useEffect(()=>{
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('fazenda-assistant-voice');
  voiceChannel.current=channel;
  if(channel)channel.onmessage=()=>stopAudio();
  const onVisibility=()=>{if(document.hidden)stopAudio()};
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('pagehide',stopAudio);
  return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',stopAudio);channel?.close();voiceChannel.current=null};
 },[]);
 // O iPhone só libera áudio após um toque. Desbloqueamos o contexto no toque do microfone,
 // antes das chamadas assíncronas de transcrição, consulta e síntese de voz.
 function unlockVoice(){try{const context=voiceContext.current?.state==='closed'?new AudioContext():voiceContext.current??new AudioContext();voiceContext.current=context;void context.resume().catch(()=>{});const silent=context.createBufferSource();silent.buffer=context.createBuffer(1,1,context.sampleRate);silent.connect(context.destination);silent.start()}catch{}}
 function stopAudio(){playbackGeneration.current++;voiceRequest.current?.abort();voiceRequest.current=null;const source=voiceSource.current;voiceSource.current=null;try{source?.stop()}catch{};if('speechSynthesis' in window)window.speechSynthesis.cancel();playingIndex.current=null;setPlaying(null);setPreparing(null)}
 function toggleAuto(enabled:boolean){if(enabled)unlockVoice();autoRef.current=enabled;setAutoVoice(enabled);try{localStorage.setItem(key+':audio',String(enabled))}catch{};if(!enabled)stopAudio()}
 async function speak(value:string,index:number){
  if(playingIndex.current===index){stopAudio();return}
  unlockVoice();stopAudio();
  voiceChannel.current?.postMessage('stop');
  const generation=playbackGeneration.current;
  setPreparing(index);setNote('Preparando a resposta em áudio…');
  try{
   const context=voiceContext.current;if(!context)throw new Error('Áudio indisponível neste navegador.');
   let buffer=voiceBuffers.current.get(index);
   if(!buffer){
    const controller=new AbortController();voiceRequest.current=controller;
    const response=await fetch('/api/assistant/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value}),signal:controller.signal});
    if(!response.ok){const result=await response.json();throw new Error(result.error||'Não foi possível gerar a voz.')}
    const bytes=await response.arrayBuffer();if(generation!==playbackGeneration.current)return;
    buffer=await context.decodeAudioData(bytes);if(generation!==playbackGeneration.current)return;
    voiceBuffers.current.set(index,buffer);
   }
   voiceRequest.current=null;if(generation!==playbackGeneration.current)return;
   setAudioReady(index);
   if(context.state!=='running'){setNote('Toque em “Ouvir resposta” para liberar o áudio no iPhone.');return}
   const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
   source.onended=()=>{if(voiceSource.current===source&&generation===playbackGeneration.current){voiceSource.current=null;playingIndex.current=null;setPlaying(null)}};
   voiceSource.current=source;playingIndex.current=index;source.start();setPlaying(index);setNote('');
  }catch(e){if(generation!==playbackGeneration.current)return;setNote(e instanceof Error&&e.name!=='AbortError'?e.message:'Não foi possível reproduzir o áudio.')}
  finally{if(generation===playbackGeneration.current)setPreparing(null)}
 }
 async function ask(value:string){const question=value.trim();if(!question||busyRef.current)return;unlockVoice();stopAudio();const previous=history.current.slice(-8),index=history.current.length+1;busyRef.current=true;setText('');setNote('');setBusy(true);setMessages(prev=>[...prev,{role:'user',text:question}]);try{
  const response=await fetch('/api/assistant/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:previous})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível consultar.');
  setMessages(prev=>[...prev,{role:'assistant',text:result.answer,metric:result.metric,label:result.label}]);
  if(autoRef.current)void speak(result.answer,index);
 }catch(e){setMessages(prev=>[...prev,{role:'assistant',text:e instanceof Error?e.message:'Não foi possível consultar.'}])}finally{busyRef.current=false;setBusy(false)}}
 async function transcribe(file:File){if(file.size<100||file.size>12_000_000){setNote('Áudio inválido ou longo demais.');return}busyRef.current=true;setBusy(true);setNote('Transcrevendo sua pergunta…');try{const body=new FormData();body.set('audio',file);const response=await fetch('/api/ai/transcribe',{method:'POST',body});const result=await response.json();if(!response.ok)throw new Error(result.error||'Falha na transcrição.');const transcript=String(result.text||'').trim();setText(transcript);setNote(autoRef.current?'Pergunta transcrita. Consultando a fazenda…':'Confira a transcrição e toque em Perguntar.');busyRef.current=false;setBusy(false);if(autoRef.current&&transcript)void ask(transcript)}catch(e){setNote(e instanceof Error?e.message:'Falha na transcrição.');busyRef.current=false;setBusy(false)}}
 function clear(){stopAudio();voiceBuffers.current.clear();setAudioReady(null);history.current=[];setMessages([]);sessionStorage.removeItem(key)}
 async function toggleMic(){unlockVoice();if(recording){recorder.current?.stop();setRecording(false);return}if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setNote('Use o ditado do teclado ou digite sua pergunta.');return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const format=['audio/mp4','audio/webm','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));const rec=new MediaRecorder(stream,format?{mimeType:format}:undefined);recorder.current=rec;chunks.current=[];rec.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);void transcribe(new File(chunks.current,'pergunta',{type:rec.mimeType}))};rec.start();setRecording(true);setNote('Gravando. Toque novamente para terminar.')}catch{setNote('Permita o microfone no navegador ou digite sua pergunta.')}}
 return <div className="assistant-layout">
  <section className="assistant-hero"><span><Icon name="spark" size={21}/> INTELIGÊNCIA DA FAZENDA</span><h2>Converse com os dados da fazenda.</h2><p>Faça perguntas livres e continue a conversa. Consulto apenas os registros da sua conta, sem alterar nada.</p></section>
  <div className="assistant-pane">
   <div className="assistant-head"><div><strong>Conversa da Fazenda</strong><small>Somente leitura · dados da sua conta</small></div>{messages.length>0&&<button className="assistant-clear" type="button" onClick={clear}>Limpar conversa</button>}</div>
   <div className="assistant-stream" role="log" aria-live="polite">
    {messages.length===0?<div className="assistant-welcome"><span className="assistant-orb"><Icon name="spark" size={28}/></span><h3>O que você quer saber hoje?</h3><p>Você pode perguntar de outro jeito e fazer perguntas de acompanhamento. Se faltar informação, eu aviso.</p></div>:messages.map((m,i)=><div key={i} className={`assistant-message ${m.role}`}><span>{m.role==='user'?'VOCÊ':'ASSISTENTE'}</span>{m.metric&&<div className="assistant-number"><small>{m.label}</small><strong>{m.metric}</strong></div>}<p>{m.text}</p>{m.role==='assistant'&&<div className="assistant-voice-controls"><button type="button" onClick={()=>void speak(m.text,i)} aria-label={playing===i?'Parar áudio':audioReady===i?'Repetir áudio':'Ouvir resposta'}>{playing===i?'■ Parar áudio':preparing===i?'◌ Preparando áudio…':audioReady===i?'↻ Repetir áudio':'▶ Ouvir resposta'}</button></div>}</div>)}
    {busy&&<p className="assistant-thinking" role="status">Consultando os registros…</p>}<div ref={end}/>
   </div>
   <label className="assistant-auto-voice"><input type="checkbox" checked={autoVoice} onChange={e=>toggleAuto(e.target.checked)}/><span>Responder por voz automaticamente<small>Ao falar pelo microfone, transcrevo e respondo em texto e áudio.</small></span></label>
   <div className="assistant-suggestions"><span>EXEMPLOS PARA COMEÇAR</span><div>{suggestions.map(q=><button key={q} type="button" disabled={busy} onClick={()=>void ask(q)}>{q} <span aria-hidden="true">↗</span></button>)}</div></div>
   <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void ask(text)}}><label htmlFor="farm-question" className="sr-only">Pergunta sobre a fazenda</label><textarea id="farm-question" rows={2} maxLength={350} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask(text)}}} placeholder="Pergunte sobre sua fazenda…"/><div><button className={`assistant-mic ${recording?'recording':''}`} aria-label={recording?'Parar gravação':'Gravar pergunta'} title="Perguntar por voz" disabled={busy} type="button" onClick={()=>void toggleMic()}>{recording?'■':'🎙'}</button><button className="assistant-send" disabled={busy||recording||!text.trim()} type="submit">Perguntar <span aria-hidden="true">→</span></button></div></form>
   {note&&<p role="status" className="assistant-note">{note}</p>}<p className="assistant-privacy">O histórico fica neste navegador durante a sessão. O áudio da pergunta é transcrito e não fica armazenado.</p>
  </div>
 </div>;
}
