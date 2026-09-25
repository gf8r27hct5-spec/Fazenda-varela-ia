'use client';
import {useState} from 'react';
type Facts={financial:string;herd:string;milk:string;stock:string};
export function AssistantQuestions({facts}:{facts:Facts}){
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState('');
 function ask(value=question){const q=value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');let reply='Ainda não consigo responder essa pergunta com os registros disponíveis. Experimente perguntar sobre financeiro, rebanho, leite ou estoque.';if(/receita|despesa|lucro|resultado|financeiro|caixa|margem/.test(q))reply=facts.financial;else if(/animal|rebanho|lote|cabeça|cabeca/.test(q))reply=facts.herd;else if(/leite|litro|lactacao|lactação/.test(q))reply=facts.milk;else if(/estoque|insumo|racao|ração|sal|medicamento/.test(q))reply=facts.stock;setQuestion(value);setAnswer(reply)}
 return <><form className="inline-form assistant-query" onSubmit={e=>{e.preventDefault();ask()}}><input aria-label="Sua pergunta" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ex.: Como está meu resultado no mês?" required/><button type="submit">Perguntar</button></form>{answer&&<div className="assistant-answer" role="status"><span>CONSULTA DOS DADOS</span><p>{answer}</p></div>}<div className="question-examples">{['Qual o resultado do mês?','Quantos animais tenho?','Como está o leite?','O estoque está baixo?'].map(x=><button type="button" key={x} onClick={()=>ask(x)}>{x}</button>)}</div></>;
}
