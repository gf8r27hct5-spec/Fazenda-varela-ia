import type { AiFields } from '@/lib/ai-fields';

// Repara apenas fatos escritos explicitamente pelo usuário. Nunca cria IDs ou pesos.
export function repairExtraction(fields:AiFields,input:string,knownBeefTags:string[]):AiFields{
 const f={...fields};
 const tag=input.match(/\b([a-z]\d{2,5})\b/i)?.[1];
 if(tag&&['pesagem_animal','sanidade','venda','abate','morte','observacao','mover_lote'].includes(f.tipo)){
  const owned=knownBeefTags.find(x=>x.toUpperCase()===tag.toUpperCase());
  if(owned&&!f.identificacao)f.identificacao=owned;
 }
 if(['despesa','receita','conta_pagar'].includes(f.tipo)){
  if(!f.descricao&&f.tipo==='despesa'){
   const expense=input.match(/\b(?:gastei|paguei)\s+(?:R\$\s*)?(?:\d+(?:[.,]\d+)?|um|uma)\s*(?:reais?|real)?\s+(?:com|em|para|pelo|pela)\s+(.+)/iu);
   if(expense)f.descricao=expense[1].replace(/\s+(?:hoje|ontem)\s*[.!?]*$/iu,'').replace(/[.!?]+$/u,'').trim();
  }
  const piquete=input.match(/\bpiquete\s+([\p{L}\d-]+)\b/iu);
  if(piquete){
   const center=`Piquete ${piquete[1]}`;
   if(!f.centro)f.centro=center;
   if(f.lote.toLowerCase().includes('piquete'))f.lote='';
  }
  if(/\bvaqueiro\b/i.test(input)&&/\b(consert|paguei|di[aá]ria|servi[cç]o)/i.test(input))f.categoria='Mão de obra';
 }
 if(f.tipo==='sanidade'&&!f.produto){
  const product=input.match(/\b(?:apliquei|dei|usei)\s+([\p{L}\d][\p{L}\d -]{0,60}?)\s+(?:no|na|em)\s+(?:lote|vaca|animal|boi|novilha)\b/iu);
  if(product)f.produto=product[1].trim();
 }
 if(f.tipo==='estoque_entrada'){
  const purchase=input.match(/\b(\d+(?:[.,]\d+)?)\s+(sacos?|quilos?|kg|litros?|frascos?|unidades?)\s+de\s+(.+?)(?=\s+(?:a|por)\s+(?:R\$\s*)?\d|[.!?]|$)/iu);
  if(purchase){
   const product=purchase[3].trim(),unit=purchase[2].toLowerCase().replace(/s$/,'');
   if(!f.item||[unit,purchase[2].toLowerCase()].some(prefix=>f.item.toLowerCase().startsWith(prefix+' de ')))f.item=product;
   if(!f.unidade||f.unidade.toLowerCase()==='unidade')f.unidade=unit;
   if(!f.quantidade)f.quantidade=purchase[1];
   if(/\bsal\s+proteinad[oa]\b/i.test(product)&&!f.categoria)f.categoria='Suplementação';
  }
 }
 return f;
}
