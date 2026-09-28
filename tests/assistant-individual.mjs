import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleFrom(path, dependencies={}) {
 const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext('(function(require,module,exports){'+compiled+'})',{Date,Intl,Number,String,RegExp,Math,Set,Map,console})(key=>{
  if(!(key in dependencies))throw new Error(`Dependência inesperada: ${key}`);
  return dependencies[key];
 },{exports},exports);
 return exports;
}
const corte=moduleFrom('../src/lib/corte.ts');
const individual=moduleFrom('../src/lib/farm-individual.ts',{'@/lib/corte':corte,'@/lib/farm':{
 money:v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v),
 number:(v,decimals=1)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format(v)
}});
const farmId='fazenda-teste',lots=[{id:'l1',fazenda_id:farmId,nome:'Lote 1',peso_meta:390,sistema:'corte'}];
const animals=[
 {id:'b205',fazenda_id:farmId,identificacao:'B205',sistema:'corte',status:'ativo',lote_id:'l1',peso_entrada:293,peso_atual:293,valor_compra:3457.4,data_entrada:'2026-08-26'},
 {id:'b236',fazenda_id:farmId,identificacao:'B236',sistema:'corte',status:'ativo',lote_id:'l1',peso_entrada:169,peso_atual:169,valor_compra:1994.2,data_entrada:'2026-08-26'},
 {id:'b189',fazenda_id:farmId,identificacao:'B189',sistema:'corte',status:'ativo',lote_id:'l1',peso_entrada:227,peso_atual:241,valor_compra:2678.6,data_entrada:'2026-08-26'},
 {id:'estrela',fazenda_id:farmId,identificacao:'L001',nome:'Estrela',sistema:'leite',status:'ativo',situacao_leite:'Em lactação',prenhe:false},
 {id:'mimosa',fazenda_id:farmId,identificacao:'L002',nome:'Mimosa',sistema:'leite',status:'ativo',situacao_leite:'Em lactação',prenhe:true,proxima_previsao_parto:'2026-10-10'},
 {id:'cria',fazenda_id:farmId,identificacao:'CR01',nome:'Lua',sistema:'leite',categoria:'Cria leiteira',status:'ativo',mae_id:'mimosa',situacao_cria:'mamando',data_nascimento:'2026-09-01'}
];
const weights=[
 {animal_id:'b205',fazenda_id:farmId,data_pesagem:'2026-08-26',peso_kg:293},
 {animal_id:'b236',fazenda_id:farmId,data_pesagem:'2026-08-26',peso_kg:169},
 {animal_id:'b189',fazenda_id:farmId,data_pesagem:'2026-08-26',peso_kg:227},
 {animal_id:'b189',fazenda_id:farmId,data_pesagem:'2026-09-26',peso_kg:241}
];
const milk=[{fazenda_id:farmId,animal_id:null,data_producao:'2026-09-26',litros:40},{fazenda_id:farmId,animal_id:'estrela',data_producao:'2026-09-26',litros:8},{fazenda_id:farmId,animal_id:'mimosa',data_producao:'2026-09-26',litros:12}];
const data={animais:animals,lotes:lots,pesagens:weights,producao_leite:milk,partos_leite:[{fazenda_id:farmId,mae_id:'mimosa',data_parto:'2026-09-01',quantidade_crias:1}],manejos:[],saidas_corte:[],transacoes:[]};
const db={from:table=>({select(){return this},eq(key,value){this.filter=[key,value];return this},limit(){return Promise.resolve({data:(data[table]||[]).filter(row=>row[this.filter[0]]===this.filter[1]),error:null})}})};
const cases=[
 ['Qual é o animal mais pesado?','B205'],['Qual é o animal mais leve?','B236'],['Quanto pesa a B189?','241,0 kg'],
 ['Qual foi a última pesagem da B205?','26/08/2026'],['Compare B189 e B205','B205'],
 ['Quais animais estão abaixo de 200 kg?','B236'],['Liste os 5 animais mais pesados','B205'],
 ['Quais animais estão acima de 250 kg?','B205'],['Quantos animais já passaram de 250 kg?','1 animal'],
 ['Quais animais ainda faltam mais de 100 kg para a meta?','B236'],
 ['Liste os 5 animais mais próximos da meta','B205'],['Qual animal tem maior valor investido?','B205'],
 ['Quanto a B189 ganhou desde a entrada?','14,0 kg'],['Qual animal teve a última pesagem mais recente?','B189'],
 ['Qual animal teve melhor GMD?','B189'],['Qual o GMD da B205?','Não há pesagens'],
 ['Qual animal teve menor GMD?','B189'],['Qual animal recebeu ivermectina?','Não há animais'],
 ['Quais animais estão em período de carência?','Não há animais'],
 ['Qual o valor de compra da B205?','R$'],['Qual animal está mais perto da meta?','B205'],
 ['Qual vaca produz mais leite?','Mimosa'],['Quanto a Estrela produziu este mês?','8,0 L'],
 ['Qual foi a última produção registrada da Estrela?','8,0 L'],
 ['Qual vaca tem maior média diária?','Mimosa'],['Qual vaca tem maior custo?','Não há custos individuais'],
 ['Qual vaca teve maior queda de produção?','Não há dois dias'],
 ['Compare Estrela e Mimosa','Estrela'],['Quais vacas estão em lactação?','Mimosa'],
 ['Quais vacas estão prenhas?','Mimosa'],['Qual vaca está mais perto de parir?','Mimosa'],
 ['Quais vacas têm parto previsto para este mês?','Não há vacas'],
 ['Qual foi o último parto da Mimosa?','01/09/2026'],['Qual é a cria da Mimosa?','Lua'],
 ['Qual é a mãe da bezerra Lua?','Mimosa'],['Quando nasceu a bezerra Lua?','01/09/2026'],
 ['Quais bezerros ainda estão mamando?','Lua'],['Qual vaca tem bezerro mamando?','Mimosa'],
 ['Qual cria está mais velha?','Lua'],['Quais crias estão sem peso recente?','Lua'],
 ['Quantas crias a Mimosa já teve?','1 cria']
];
cases.push(['Qual foi o último parto da Vaca Inexistente?','Não identifiquei essa vaca leiteira']);
let failed=0;
for(const [question,expected] of cases){const result=await individual.individualAnswer(db,farmId,question);if(!result?.answer.includes(expected)){failed++;console.error(question,'=>',result?.answer,'(esperado:',expected,')')}}
assert.equal(failed,0,`${failed} de ${cases.length} casos falharam`);
console.log(`${cases.length} consultas individuais verificadas com dados sintéticos; nenhum registro foi gravado.`);
