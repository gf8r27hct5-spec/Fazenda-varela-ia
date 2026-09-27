import { createClient } from '@/lib/supabase/server';
import { aiFields, type AiFields } from '@/lib/ai-fields';

export const types=['despesa','receita','conta_pagar','pesagem_animal','pesagem_lote','sanidade','leite_total','leite_vaca','estoque_entrada','estoque_saida','venda','abate','morte','parto','prenhez','observacao','mover_lote'] as const;
type Entry={id:string;nome?:string;identificacao?:string;sistema?:string;categoria?:string;status?:string;lote_id?:string;ativo?:boolean;unidade?:string};
export async function aiContext(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Entre novamente para usar o registro com IA.');
 const {data:farms,error}=await db.from('fazendas').select('id,nome').eq('proprietario_id',user.id).limit(1);
 if(error||!farms?.length)throw new Error('Fazenda não encontrada para este usuário.');
 const farm=farms[0];
 const tables=await Promise.all([
  db.from('animais').select('id,identificacao,nome,sistema,categoria,status,lote_id').eq('fazenda_id',farm.id).eq('status','ativo').limit(500),
  db.from('lotes').select('id,nome,sistema,ativo').eq('fazenda_id',farm.id).eq('sistema','corte').eq('ativo',true).limit(100),
  db.from('estoque').select('id,nome,categoria,ativo,unidade').eq('fazenda_id',farm.id).eq('ativo',true).limit(200),
  db.from('centros_custo').select('id,nome,ativo').eq('fazenda_id',farm.id).eq('ativo',true).limit(100),
 ]);
 if(tables.some(x=>x.error))throw new Error('Falha ao consultar os registros desta fazenda.');
 const [animals,lots,stock,centers]=tables.map(x=>(x.data||[]) as Entry[]);
 return {db,user,farm,animals,lots,stock,centers};
}
export type Context=Awaited<ReturnType<typeof aiContext>>;
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function findUnique(rows:Entry[],needle:string,keys:('nome'|'identificacao')[]){if(!needle)return null;const exact=rows.filter(row=>keys.some(k=>normalized(row[k]||'')===normalized(needle)));return exact.length===1?exact[0]:null;}
export function safeFields(value:unknown):AiFields{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Resposta da IA inválida.');
 const obj=value as Record<string,unknown>;
 return Object.fromEntries(aiFields.map(key=>{
  const v=obj[key];if(v!==null&&v!==undefined&&typeof v!=='string'&&typeof v!=='number')throw new Error('Campo inválido: '+key);
  return [key,String(v??'').trim().slice(0,key==='observacoes'?500:180)];
 })) as AiFields;
}
const numeric=(s:string)=>s ? Number(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)?s.replaceAll('.','').replace(',','.'):s.replace(',','.')) : null;
export function prepare(value:unknown,ctx:Context){
 const f=safeFields(value), warnings:string[]=[], output:Record<string,string|number|null>={...f};
 const ask=(condition:boolean,message:string)=>{if(condition)warnings.push(message)};
 ask(!types.includes(f.tipo as typeof types[number]),'Escolha uma operação reconhecida.');
 ask(!/^\d{4}-\d{2}-\d{2}$/.test(f.data)||Number.isNaN(Date.parse(f.data+'T12:00:00Z')),'Informe uma data válida.');
 const money=numeric(f.valor),qty=numeric(f.quantidade);
 output.valor=money;output.quantidade=qty;
 ask(f.valor!==''&&(money===null||!Number.isFinite(money)||money<0),'Revise o valor informado.');
 ask(f.quantidade!==''&&(qty===null||!Number.isFinite(qty)||qty<=0),'Revise a quantidade, o peso ou os litros.');
 const beef=ctx.animals.filter(x=>x.sistema==='corte'),dairy=ctx.animals.filter(x=>x.sistema==='leite'&&x.categoria!=='Cria leiteira');
 const animal=findUnique(beef,f.identificacao,['identificacao']);
 const cow=findUnique(dairy,f.vaca,['identificacao','nome']);
 const lot=findUnique(ctx.lots,f.lote,['nome']);
 const stock=findUnique(ctx.stock,f.item,['nome']);
 const center=findUnique(ctx.centers,f.centro,['nome']);
 const requiresAnimal=['pesagem_animal','venda','abate','morte','mover_lote'];
 if(requiresAnimal.includes(f.tipo))ask(!animal,'Informe o brinco de um animal de corte ativo desta fazenda.');
 if(['pesagem_lote','mover_lote'].includes(f.tipo))ask(!lot,'Selecione um lote de corte ativo desta fazenda.');
 if(f.tipo==='observacao')ask(!animal&&!cow,'Informe o brinco de um animal ativo desta fazenda.');
 if(f.tipo==='sanidade'&&animal&&lot)ask(animal.lote_id!==lot.id,'Este animal não pertence ao lote escolhido.');
 if(['leite_vaca','parto','prenhez'].includes(f.tipo)||f.tipo==='sanidade'&&f.vaca)ask(!cow,'Informe uma vaca leiteira ativa desta fazenda.');
 if(f.tipo==='sanidade')ask(!lot&&!cow&&!animal?.lote_id,'Informe o lote de corte ou a vaca leiteira.');
 if(f.tipo==='parto'){ask(!f.cria,'Informe o brinco da cria antes de confirmar o parto.');ask(!['macho','femea'].includes(f.sexo),'Informe se a cria é macho ou fêmea.');ask(ctx.animals.some(x=>normalized(x.identificacao||'')===normalized(f.cria)),'Já existe um animal com esse brinco.');}
 if(f.tipo==='prenhez'&&f.previsao)ask(!/^\d{4}-\d{2}-\d{2}$/.test(f.previsao),'Informe a previsão de parto no formato de data.');
 if(f.tipo==='estoque_saida')ask(!stock,'Selecione um item de estoque existente.');
 if(stock&&f.unidade)ask(normalized(stock.unidade||'').replace(/s$/,'')!==normalized(f.unidade).replace(/s$/,''),'A unidade não coincide com o item cadastrado. Informe a quantidade na unidade do estoque.');
 if(f.tipo==='estoque_entrada'&&!stock){ask(!f.item||!f.unidade,'Para cadastrar um novo item, informe nome e unidade (por exemplo, saco).');if(f.item&&f.unidade)warnings.push('Item novo: será cadastrado no estoque ao confirmar.');}
 if(f.centro&&!center)warnings.push('Centro de custo novo: será criado ao confirmar.');
 if(f.lote&&!lot)ask(true,'O lote informado não foi localizado nesta fazenda.');
 if(['despesa','receita','conta_pagar','venda','abate'].includes(f.tipo))ask(money===null||money<=0,'Informe um valor positivo.');
 if(['pesagem_animal','pesagem_lote','leite_total','leite_vaca','estoque_entrada','estoque_saida'].includes(f.tipo))ask(qty===null||qty<=0,'Informe peso, litros ou quantidade.');
 if(['despesa','receita','conta_pagar'].includes(f.tipo))ask(f.descricao.length<2,'Informe uma descrição.');
 if(f.tipo==='sanidade')ask(!f.produto,'Informe o produto aplicado.');
 if(['observacao','mover_lote'].includes(f.tipo))ask(!f.descricao,'Informe a observação ou motivo da movimentação.');
 if(f.tipo==='pesagem_lote')warnings.push('Peso médio do lote: este registro não substitui pesagens individuais.');
 if(['venda','abate','morte'].includes(f.tipo))warnings.push('Esta confirmação encerra o animal e gera o histórico de saída. Confira cuidadosamente.');
 output.animal_id=animal?.id||cow?.id||null;output.lote_id=lot?.id||(f.tipo==='sanidade'?animal?.lote_id:null)||null;output.estoque_id=stock?.id||null;output.centro_id=center?.id||null;
 return {fields:f,record:output,warnings,canConfirm:warnings.every(w=>w.startsWith('Peso médio')||w.startsWith('Esta confirmação')||w.startsWith('Item novo')||w.startsWith('Centro de custo novo'))};
}
export const schema={type:'object',additionalProperties:false,properties:Object.fromEntries(aiFields.map(k=>[k,{type:['string','null']}])) ,required:[...aiFields]};
