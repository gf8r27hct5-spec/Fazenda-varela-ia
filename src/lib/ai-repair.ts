import type { AiFields } from '@/lib/ai-fields';

// Repara apenas fatos escritos explicitamente pelo usuário. Nunca cria IDs ou pesos.
export function repairExtraction(fields:AiFields,input:string,knownBeefTags:string[],knownDairyNames:string[]=[]):AiFields{
 const f={...fields};
 const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const dairy=knownDairyNames.filter(name=>name&&normalized(input).includes(normalized(name)));
 if(dairy.length===1&&['leite_vaca','parto','prenhez','sanidade'].includes(f.tipo)&&!f.vaca)f.vaca=dairy[0];
 const individualWeight=input.match(/\b(?:pesei\s+(?:a\s+)?([a-z]\d{2,5})|(?:a\s+)?([a-z]\d{2,5})\s+(?:pesou|t[aá]\s+com)|registra\s+\d+(?:[.,]\d+)?\s*kg\s+pra\s+([a-z]\d{2,5}))\b/iu);
 if(individualWeight&&/\b\d+(?:[.,]\d+)?\s*kg\b/iu.test(input)&&!/\bpeso final\b/iu.test(input))f.tipo='pesagem_animal';
 const fuel=input.match(/\bcoloquei\s+(\d+(?:[.,]\d+)?)\s+reais?\s+de\s+(diesel|gasolina)\s+(?:no|na|para)\s+(.+)/iu);
 if(fuel){f.tipo='despesa';f.valor=fuel[1];if(!f.descricao)f.descricao=`${fuel[2]} ${fuel[3]}`.trim();}
 if(['despesa','receita','conta_pagar'].includes(f.tipo)&&/\b(?:diesel|gasolina|combust[ií]vel)\b/iu.test(input))f.categoria='Combustível';
 const tag=input.match(/\b([a-z]\d{2,5})\b/i)?.[1];
 if(tag&&['pesagem_animal','sanidade','venda','abate','morte','observacao','mover_lote'].includes(f.tipo)){
  const owned=knownBeefTags.find(x=>x.toUpperCase()===tag.toUpperCase());
  if(owned&&!f.identificacao)f.identificacao=owned;
 }
 if(['despesa','receita','conta_pagar'].includes(f.tipo)){
  if(!f.descricao&&f.tipo==='despesa'){
   const expense=input.match(/\b(?:gastei|paguei)\s+(?:R\$\s*)?(?:\d+(?:[.,]\d+)?|um|uma)\s*(?:reais?|real)?\s+(?:com|em|para|pelo|pela|pra|pro|de|no|na)\s+(.+)/iu);
   if(expense)f.descricao=expense[1].replace(/\s+(?:hoje|ontem)\s*[.!?]*$/iu,'').replace(/[.!?]+$/u,'').trim();
   else{
    const activity=input.match(/\b(?:gastei|paguei)\s+(?:R\$\s*)?\d+(?:[.,]\d+)?\s+reais?\s+((?:consertando|arrumando|fazendo)\s+.+)/iu);
    if(activity)f.descricao=activity[1].replace(/[.!?]+$/u,'').trim();
   }
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
 if(/\b(?:comprei|chegaram|entraram|tirei|usei|coloquei)\b/iu.test(input)){
  const purchase=input.match(/\b(\d+(?:[.,]\d+)?)\s+(sacos?|quilos?|kg|litros?|frascos?|unidades?)\s+de\s+(.+?)(?=\s+(?:a|por|do|no|na|para)\s+(?:R\$\s*)?\d|\s+(?:do|no|na|para)\s+(?:lote|estoque|cocho|vacas?|animais?)\b|[.!?]|$)/iu);
  if(purchase){
   const product=purchase[3].trim(),unit=purchase[2].toLowerCase().replace(/s$/,'');
   const specificProduct=normalized(product)==='racao'&&/\b(?:vacas?\s+de\s+leite|animais?\s+de\s+corte)\b/iu.test(input)?`${product} para ${/\bvacas?\s+de\s+leite\b/iu.test(input)?'vacas de leite':'animais de corte'}`:product;
   if(/\b(?:tirei|usei|coloquei)\b/iu.test(input)&&!/\breais?\b/iu.test(input))f.tipo='estoque_saida';
   else if(/\b(?:comprei|chegaram|entraram)\b/iu.test(input))f.tipo='estoque_entrada';
   if(!f.item||normalized(f.item)===normalized(product)||[unit,purchase[2].toLowerCase()].some(prefix=>f.item.toLowerCase().startsWith(prefix+' de ')))f.item=specificProduct;
   if(!f.unidade||f.unidade.toLowerCase()==='unidade')f.unidade=unit;
   if(!f.quantidade)f.quantidade=purchase[1];
   if(/\bsal\s+proteinad[oa]\b/i.test(product)&&!f.categoria)f.categoria='Suplementação';
   const price=input.match(/\b(?:a|por)\s+(?:R\$\s*)?(\d+(?:[.,]\d+)?)\s+reais?\s+cada\b/iu);
   if(price&&f.tipo==='estoque_entrada')f.valor=String(Math.round(Number(purchase[1].replace(',','.'))*Number(price[1].replace(',','.'))*100)/100);
  }
 }
 return f;
}
