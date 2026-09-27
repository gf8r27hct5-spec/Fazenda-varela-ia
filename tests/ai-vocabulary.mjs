// Executa a matriz de 100 frases contra as regras de aterramento e segurança.
// Não chama a OpenAI e nunca escreve no Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repairExtraction } from '../src/lib/ai-repair.ts';
import { vocabularyIssues } from '../src/lib/ai-vocabulary.ts';

const rows=readFileSync(new URL('../docs/vocabulario-ia-fazenda.md',import.meta.url),'utf8')
 .split('\n').filter(line=>/^\| (?:Financeiro|Estoque|Pesagem|Sanidade|Leite|Reprodução|Lote|Saída|Manutenção|Ambígua) \|/.test(line));
assert.equal(rows.length,100,'A matriz precisa conter todos os cem exemplos do usuário.');
const tags=['B189','B209','B205','B233','B244'];
for(const row of rows){
 const [,area,phrase,type,,action]=row.split('|').map(cell=>cell?.trim());
 const f={tipo:type,produto:'',identificacao:'',quantidade:'',item:'',cria:'',vaca:'',descricao:'',categoria:'',centro:'',lote:'',unidade:'',valor:''};
 const namedProduct=phrase.match(/\b(?:ivermectina|Bovitam)\b/i);
 if(namedProduct)f.produto=namedProduct[0];
 const namedCow=phrase.match(/\b(?:Estrela|Mimosa|Princesa)\b/);
 if(namedCow)f.vaca=namedCow[0];
 const unit=phrase.match(/\b(\d+)\s*(sacos?|kg|litros?)\b/i);
 if(unit&&type.startsWith('estoque')){f.quantidade=unit[1];f.item='produto';}
 if(type==='estoque_saida')f.item='produto';
 const repaired=repairExtraction(f,phrase,tags);
 const issues=vocabularyIssues(phrase,repaired);
 if(action.startsWith('prévia'))assert.equal(issues.length,0,`${area}: ${phrase} — ${issues.join('; ')}`);
 else assert.ok(issues.length>0,`${area}: ${phrase} deveria pedir esclarecimento ou formulário`);
}

function check(input,model,expected){
 const f=repairExtraction({tipo:model,valor:'',descricao:'',item:'',quantidade:'',unidade:'',categoria:'',centro:'',lote:'',identificacao:'',produto:''},input,tags);
 for(const [key,value] of Object.entries(expected))assert.equal(f[key],value,`${input}: campo ${key}`);
}
check('Coloquei 250 reais de diesel no carro','estoque_entrada',{tipo:'despesa',valor:'250',categoria:'Combustível',descricao:'diesel carro'});
assert.equal(repairExtraction({tipo:'despesa',centro:'carro',categoria:'',descricao:'',lote:'',identificacao:'',produto:''},'Coloquei 250 reais de diesel no carro',tags).centro,'','Veículo citado não autoriza criar centro de custo.');
check('Coloquei 200 reais de diesel no trator','despesa',{tipo:'despesa',valor:'200',categoria:'Combustível',descricao:'diesel trator'});
check('Gastei 180 reais de gasolina na Ranger','despesa',{categoria:'Combustível',descricao:'gasolina na Ranger'});
check('Comprei 6 sacos de proteinado 30% a 160 reais cada','estoque_entrada',{item:'proteinado 30%',quantidade:'6',unidade:'saco',valor:'960'});
check('Tirei 2 sacos de proteinado do estoque para o Lote 1','estoque_entrada',{tipo:'estoque_saida',item:'proteinado',quantidade:'2',unidade:'saco'});
console.log(`${rows.length} frases: segurança lexical e aliases verificados; nenhum dado foi gravado.`);
