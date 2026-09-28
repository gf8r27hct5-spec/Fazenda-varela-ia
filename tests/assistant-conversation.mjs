import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(path,deps={},globals={}){const exports={};vm.runInNewContext('(function(require,module,exports){'+compile(path)+'})',{Date,Intl,Number,String,RegExp,Math,Set,Map,JSON,Object,console,AbortSignal,...globals})(name=>{if(!(name in deps))throw Error(name);return deps[name]},{exports},exports);return exports}
const corte=load('../src/lib/corte.ts');
const farm='farm-test',calls=[],historySeen=[];
const data={animais:[{fazenda_id:farm,id:'b205',sistema:'corte',identificacao:'B205',status:'ativo',lote_id:'l1',peso_entrada:293,peso_atual:293,data_entrada:'2026-08-26'}],lotes:[{fazenda_id:farm,id:'l1',sistema:'corte',nome:'Lote 1',peso_meta:390}],pesagens:[{fazenda_id:farm,animal_id:'b205',data_pesagem:'2026-08-26',peso_kg:293}]};
const db={from(table){calls.push(table);return {select(){return this},eq(field,id){assert.equal(field,'fazenda_id');assert.equal(id,farm);return this},limit(){return Promise.resolve({data:data[table]||[],error:null})}}}};
let response='B205 tem 293 kg.';
async function fetch(_url,options){const body=JSON.parse(options.body),input=JSON.parse(body.input);if(body.text.format.name==='plano_consulta'){historySeen.push(input.historico);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({standalone:input.pergunta.includes('quanto falta')?'Quanto falta para B205 chegar na meta?':input.pergunta,topics:['corte'],from:null,to:null,focus:'B205'})}]}]})}}return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({answer:response})}]}]})}}
const {conversationalAnswer}=load('../src/lib/farm-conversation.ts',{'@/lib/corte':corte},{fetch,process:{env:{OPENAI_API_KEY:'test'}}});
assert.equal((await conversationalAnswer(db,farm,'Qual animal é mais pesado?',[])).answer,'B205 tem 293 kg.');
response='Faltam 97 kg para B205 chegar aos 390 kg.';
assert.equal((await conversationalAnswer(db,farm,'E quanto falta para a meta?',[{role:'user',text:'Qual animal é mais pesado?'},{role:'assistant',text:'B205, com 293 kg.'}])).answer,response);
assert.equal(historySeen[1][1].text,'B205, com 293 kg.');
response='B205 pesa 999 kg.';
assert.match((await conversationalAnswer(db,farm,'Quanto pesa B205?',[])).answer,/Não consegui conferir/);
assert.deepEqual([...new Set(calls)].sort(),['animais','lotes','pesagens']);
console.log('Planejamento livre, contexto de conversa, consultas por fazenda e bloqueio de número inventado: OK');
