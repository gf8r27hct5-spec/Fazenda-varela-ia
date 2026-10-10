import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,deps={}){
 const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext('(function(require,module,exports){'+js+'})',{Date,Intl,Number,String,RegExp,Math,Set,Map,JSON,Object,console})(key=>{if(!(key in deps))throw Error(key);return deps[key]},{exports},exports);return exports;
}
const corte=load('../src/lib/corte.ts');
const farm={milkDailyTotals(items){const days=new Map();for(const x of items){const list=days.get(x.data_producao)||[];list.push(x);days.set(x.data_producao,list)}return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,list])=>{const tank=list.filter(x=>!x.animal_id),chosen=tank.length?tank:list;return {day,liters:chosen.reduce((s,x)=>s+Number(x.litros),0)}})}};
const {calculateFarmAlerts,DEFAULT_ALERT_SETTINGS}=load('../src/lib/farm-alerts.ts',{'@/lib/corte':corte,'@/lib/farm':farm});
const today='2026-10-10',base={animais:[],lotes:[],pesagens:[],manejos:[],producao_leite:[],estoque:[],movimentacoes_estoque:[],transacoes:[]};
const rows=structuredClone(base);
rows.lotes.push({id:'l1',nome:'Lote temporário',sistema:'corte',ativo:true,data_entrada:'2026-08-01',peso_meta:390});
rows.animais.push({id:'b1',identificacao:'TESTE-CORTE',sistema:'corte',status:'ativo',lote_id:'l1',data_entrada:'2026-08-01',peso_entrada:200});
rows.pesagens.push({id:'p1',animal_id:'b1',data_pesagem:'2026-08-01',peso_kg:200},{id:'p2',animal_id:'b1',data_pesagem:'2026-10-09',peso_kg:210});
rows.manejos.push({id:'v1',animal_id:'b1',tipo:'vacina',produto:'Vacina temporária',data_manejo:'2026-10-01',proxima_data:'2026-10-15'},
 {id:'m1',animal_id:'b1',tipo:'medicamento',produto:'Tratamento temporário',data_manejo:'2026-10-01',data_fim:'2026-10-12',data_fim_carencia:'2026-10-11'});
rows.animais.push({id:'d1',identificacao:'TESTE-LEITE',sistema:'leite',status:'ativo',categoria:'Vaca leiteira',situacao_leite:'Em lactação',prenhe:true,proxima_previsao_parto:'2026-10-18'});
for(const [i,liters] of [40,42,39,41,20].entries())rows.producao_leite.push({id:`milk${i}`,animal_id:null,data_producao:`2026-10-0${5+i}`,litros:liters});
rows.estoque.push({id:'s1',nome:'Sal temporário',ativo:true,unidade:'sacos',quantidade_atual:2,estoque_minimo:3,consumo_medio_dia:0.5});
rows.transacoes.push({id:'t1',tipo:'despesa',status:'pendente',descricao:'Conta temporária',valor:120,data_competencia:'2026-10-01',data_vencimento:'2026-10-13'},
 ...[40,45,42].map((v,i)=>({id:`old${i}`,tipo:'despesa',status:'pago',categoria:'Manutenção',descricao:'Histórico temporário',valor:v,data_competencia:`2026-09-0${i+1}`})),
 {id:'t2',tipo:'despesa',status:'pago',categoria:'Manutenção',descricao:'Despesa temporária',valor:200,data_competencia:'2026-10-09'});
const alerts=calculateFarmAlerts(rows,DEFAULT_ALERT_SETTINGS,today),ids=new Set(alerts.map(a=>a.id));
for(const id of ['Corte:gmd:b1','Sanidade:reforco:v1','Sanidade:carencia:m1','Sanidade:tratamento:m1','Leite:parto:d1','Leite:queda-total','Estoque:minimo:s1','Estoque:dias:s1','Financeiro:vencimento:t1','Financeiro:despesa:t2'])assert.ok(ids.has(id),`Alerta ausente: ${id}`);
assert.ok(!ids.has('Corte:pesagem:b1'),'Pesagem recente não deve gerar atraso');
const stale=structuredClone(base);stale.animais.push({id:'temporary',identificacao:'TEMP',sistema:'corte',status:'ativo',data_entrada:'2026-08-01'});
assert.ok(calculateFarmAlerts(stale,DEFAULT_ALERT_SETTINGS,today).some(x=>x.id==='Corte:pesagem:temporary'));
const archived=structuredClone(stale);archived.animais[0].status='vendido';assert.equal(calculateFarmAlerts(archived,DEFAULT_ALERT_SETTINGS,today).length,0);
const noHistory=structuredClone(base);noHistory.animais.push({id:'a',sistema:'corte',status:'ativo',identificacao:'A',data_entrada:'2026-10-09',peso_entrada:200});assert.equal(calculateFarmAlerts(noHistory,DEFAULT_ALERT_SETTINGS,today).length,0);
const custom=calculateFarmAlerts(stale,{...DEFAULT_ALERT_SETTINGS,dias_sem_pesagem:90},today);assert.ok(!custom.some(x=>x.id==='Corte:pesagem:temporary'));
for(const a of alerts)assert.ok(a.title&&a.reason&&a.evidence&&a.date&&a.module&&a.action&&a.href.startsWith('/'),'Alerta incompleto');
console.log('Alertas de pesagem, GMD, sanidade, carência, parto, leite, estoque e financeiro verificados com registros sintéticos isolados. Nenhum dado real foi alterado.');
