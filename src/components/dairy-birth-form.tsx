'use client';

import {useState} from 'react';
import {registerDairyBirth} from '@/app/actions';

export function DairyBirthForm({mother,today}:{mother:string;today:string}){
  const [count,setCount]=useState(1);
  return <form action={registerDairyBirth} className="entry-form birth-form">
    <input type="hidden" name="vaca_id" value={mother}/><input type="hidden" name="quantidade_crias" value={count}/>
    <div className="form-grid"><label>Data do parto *<input name="data_parto" type="date" max={today} required/></label><label>Tipo de parto (opcional)<select name="tipo_parto"><option value="">Não informado</option><option value="normal">Normal</option><option value="assistido">Assistido</option><option value="cesarea">Cesárea</option></select></label></div>
    <label>Quantidade de crias <span className="birth-counter"><button type="button" onClick={()=>setCount(n=>Math.max(1,n-1))} aria-label="Diminuir quantidade de crias">−</button><strong>{count}</strong><button type="button" onClick={()=>setCount(n=>Math.min(8,n+1))} aria-label="Aumentar quantidade de crias">+</button></span></label>
    {Array.from({length:count},(_,i)=><fieldset className="calf-fieldset" key={i}><legend>Cria {i+1}</legend>
      <div className="form-grid"><label>Situação ao nascer<select name={`situacao_${i}`} required><option value="viva">Viva</option><option value="natimorta">Natimorta</option><option value="morreu_depois">Morreu depois</option></select></label><label>Sexo<select name={`sexo_${i}`}><option value="">Não informado</option><option value="femea">Fêmea</option><option value="macho">Macho</option></select></label></div>
      <div className="form-grid"><label>Brinco / identificação (obrigatório se viva)<input name={`identificacao_${i}`} maxLength={80} placeholder="Ex.: LEITE-CRIA-01"/></label><label>Nome (opcional)<input name={`nome_${i}`} maxLength={120}/></label></div>
      <div className="form-grid"><label>Peso ao nascer (kg)<input name={`peso_nascer_${i}`} type="number" min="0.01" step="0.01"/></label><label>Raça (se conhecida)<input name={`raca_${i}`} maxLength={120}/></label></div>
      <label>Pai / touro (se conhecido)<input name={`pai_touro_${i}`} maxLength={120}/></label><label>Observações da cria<textarea name={`observacoes_${i}`} rows={2}/></label>
    </fieldset>)}
    <label><input type="checkbox" name="lactacao" value="sim"/> A vaca está em lactação após este parto</label>
    <label>Observações do parto<textarea name="observacoes" rows={3}/></label>
    <button type="submit">Registrar parto e criar crias identificadas</button>
    <p className="section-note">Crias vivas precisam de brinco. Natimortas sem identificação ficam preservadas no histórico do parto, sem cadastro fictício de animal.</p>
  </form>;
}
