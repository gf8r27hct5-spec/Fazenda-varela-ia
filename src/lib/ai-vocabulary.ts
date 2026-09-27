import type { AiFields } from '@/lib/ai-fields';

// Regras de segurança sobre a fala original: o modelo não pode suprir um fato
// que o usuário não disse. A confirmação reexecuta as mesmas regras.
export function vocabularyIssues(input:string,fields:AiFields,knownDairyNames:string[]=[]):string[]{
 const s=input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const issues:string[]=[];
 const add=(condition:boolean,message:string)=>{if(condition&&!issues.includes(message))issues.push(message)};
 const tag=/\b[a-z]\d{2,5}\b/i.test(s);
 const lot=/\blote\s+(?:\d+|[a-z]+[-_]?\d+)\b/.test(s);
 const mass=/\b\d+(?:[.,]\d+)?\s*(?:kg|quilos?|litros?|l)\b/.test(s);
 const money=/\b(?:r\$\s*)?\d+(?:[.,]\d+)?\s*(?:reais?|real|mil)\b/.test(s);
 const multi=/\b(?:\d+|todas?|todos?)\s+(?:as?\s+|os?\s+)?(?:novilhas?|animais?|vacas?|bezerr[oa]s?)\b/.test(s);

 add(/^gastei\s+\d+(?:[.,]\d+)?\s*(?:reais?)?\s+(?:no|com|em|para)\s+lote\b/.test(s)&&!/(?:racao|sal|medicamento|frete|mao de obra|cerca|diesel)/.test(s),'Diga com o que foi o gasto; o lote sozinho não define a categoria.');
 add(/\bbotei\s+\d+\s+na?\s+[a-z]\d+\b/.test(s),'Diga o que foi colocado e a unidade; o brinco sozinho não define a operação.');
 add(/^deu\s+\d+\s+hoje\b/.test(s),'Diga o que foi medido e a unidade.');
 add(/\bcomprei\s+\d+\s+por\s+\d+\b/.test(s),'Informe qual produto, quantidade, unidade e se o preço é unitário ou total.');
 add(/^apliquei\s+\d+\s*ml\s*$/.test(s),'Informe o produto aplicado e o animal ou lote.');
 add(/^vendi\s+por\s+\d+\b/.test(s),'Informe o animal vendido e se o valor é total ou por unidade.');
 add(/^coloquei\s+\d+\s+sacos?\s*$/.test(s),'Informe qual produto e se houve entrada ou consumo do estoque.');
 add(/\bpesei\s+(?:o|um)\s+lote\s*$/.test(s),'Informe qual lote e os pesos medidos.');
 add(/\bdei\s+remedio\s+nas?\s+novilhas?/.test(s),'Informe o medicamento e os animais ou lote que receberam a dose.');
 add(/\ba\s+vaca\s+produziu\s+\d+\b/.test(s),'Informe o nome ou brinco da vaca, ou diga que é o total do tanque.');

 add(/\b(?:tenho\s+(?:so|apenas)|sobrando|acabou)\b/.test(s)&&!/(?:comprei|entraram|chegaram|tirei|usei)/.test(s),'Isto descreve o saldo do estoque; não há entrada ou saída para registrar. Informe uma movimentação ou ajuste o saldo no módulo Estoque.');
 add(/\bmedia\s+do\s+lote\b/.test(s)&&!lot,'Informe qual lote gerou essa média.');
 add(/^hoje\s+(?:de\s+manha|a\s+tarde|a\s+noite)\s+deu\s+\d+\s+litros?\b/.test(s)&&!/(?:leite|tanque|vaca)/.test(s),'Confirme se os litros são a produção de leite do tanque ou de uma vaca.');
 add(/\bganhou\s+\d+\s*kg\b/.test(s)&&!/(?:pesou|pesei|peso atual)/.test(s),'O ganho informado não é o peso atual. Informe o peso medido para registrar uma pesagem.');
 add(/\bpesei\s+(?:todas?|todos?|\d+)\s+(?:novilhas?|animais?)\b/.test(s)&&!mass,'Informe os pesos individuais; não é seguro criar pesagens a partir da quantidade de animais.');
 add(/\b(?:meta|quase chegando)\b/.test(s)&&/\b(?:peso|kg|lote)\b/.test(s)&&!/(?:pesei|pesou|deu media|peso medio)/.test(s),'A meta não é uma pesagem. Informe uma medição real para registrar o peso.');
 add(/\b(?:troquei|arrumei|coloquei|levei)\b/.test(s)&&/\b(?:piquete|pasto|boia|cerca eletrica)\b/.test(s)&&!money&&!tag,'Este manejo não tem operação estruturada neste fluxo. Registre pelo módulo correspondente; não será criado gasto ou pesagem automaticamente.');
 add(/\b(?:aparta|apart[aei]|desmam[aei]|secou|seca depois|em lactacao|carencia|voltou a produzir)\b/.test(s)&&!money,'Esta mudança de situação exige o cadastro especializado do animal; nenhuma operação será presumida.');
 add(/\b(?:mamando|desmamada|desmamado)\b/.test(s)&&!money,'Identifique a cria e atualize a situação na ficha dela.');
 add(/\b(?:cria\s+um\s+lote|lote\s+novo|sem\s+lote|tirei\s+\d+\s+animais\s+do\s+lote)\b/.test(s),'Informe e revise os animais no módulo Corte; este comando não pode criar ou mover um grupo sem identificar cada um.');
 add(/\bvendi\s+\d+\s+(?:novilhas?|animais?)\b/.test(s)&&!tag,'Identifique cada animal e informe se o valor é por cabeça ou total.');
 add(/\b(?:abati|morreu)\s+(?:uma?|\d+)\s+novilha\b/.test(s)&&!tag,'Informe o brinco de cada animal antes de registrar a saída.');
 add(/\bvendi\s+o\s+lote\b/.test(s),'A venda do lote requer identificação individual, pesos e valor total; use o fechamento dos animais.');
 add(/\b(?:saiu|foi transferida|peso final)\b/.test(s)&&tag&&!/(?:vendi|abati|morreu)/.test(s),'Informe o tipo de saída, ou esclareça se deseja apenas registrar uma pesagem.');
 add(/\b(?:lote\s+das?\s+maiores|lote\s+dos?\s+menores)\b/.test(s),'Use o nome exato de um lote existente.');
 add(/\bregistra\s+manejo\b/.test(s)&&!/(?:vacina|medicamento|vermifugo|produto|dose)/.test(s),'Informe qual manejo foi feito e a quem foi aplicado.');
 add(/\b(?:comprei\s+arame|comprei\s+oleo)\b/.test(s)&&!money&&!/\b\d+\s*(?:sacos?|litros?|kg|metros?|unidades?)\b/.test(s),'Informe a quantidade e unidade do item, ou o valor se quer registrar apenas uma despesa.');
 add(/\bpaguei\s+material\b/.test(s)&&!money,'Informe o valor pago pelo material.');
 add(/\b(?:previsao\s+de\s+parto|reforco\s+da\s+vacina)\b/.test(s)&&/\b(?:mes que vem|semana que vem)\b/.test(s),'Informe a data exata; uma referência como mês ou semana que vem não define o dia.');
 add(/\b(?:deu|apliquei|vacinei)\b/.test(s)&&/\b(?:novilhas|lote)\b/.test(s)&&fields.tipo==='sanidade'&&!fields.produto,'Informe o nome do produto.');
 add(fields.tipo==='sanidade'&&/\b(?:vitamina|medicamento|remedio|antiparasitario|vermifugo|vacina)\b/.test(s)&&!fields.produto,'Informe o nome específico do produto aplicado.');
 add(fields.tipo==='sanidade'&&/\b(?:vitamina|medicamento|remedio|antiparasitario|vermifugo|vacina)\b/.test(s)&&/^(?:vitamina|medicamento|remedio|antiparasitario|vermifugo|vacina)$/i.test(fields.produto),'Informe o nome específico do produto aplicado.');
 add(fields.tipo==='sanidade'&&/\b(?:vitamina|medicamento|remedio|antiparasitario|vermifugo|vacina)\s+(?:na?|nas?|nos?|em|porque|hoje|semana|$)/.test(s),'Informe o nome específico do produto aplicado.');
 add(fields.tipo==='sanidade'&&/\bvacinei\s+(?:(?:o|a)\s+)?(?:lote|novilha|animal)\b/.test(s)&&!/(?:com|contra)\s+[\w-]+/.test(s),'Informe o nome da vacina aplicada.');
 add(fields.tipo==='sanidade'&&!!fields.produto&&!s.includes(fields.produto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()),'O produto da prévia não aparece na frase; diga o nome correto antes de confirmar.');
 add(fields.tipo==='sanidade'&&multi&&!lot&&!tag,'Indique explicitamente o lote ou os brincos dos animais que receberam o manejo.');
 add(fields.tipo==='pesagem_animal'&&!mass,'Informe o peso atual medido em kg.');
 add(fields.tipo==='pesagem_lote'&&!mass,'Informe o peso médio medido do lote em kg.');
 add(fields.tipo==='venda'&&(!tag||(!money&&!/\b(?:por|a)\s*\d+(?:[.,]\d+)?\s*(?:$|[.!?])/i.test(s))),'Informe o brinco e o valor total da venda do animal.');
 add(fields.tipo==='leite_vaca'&&!fields.vaca,'Informe o nome ou brinco da vaca.');
 add(fields.tipo==='parto'&&!fields.cria,'Informe o brinco da cria antes de registrar o parto.');
 add(fields.tipo==='estoque_entrada'&&!fields.quantidade,'Informe a quantidade e a unidade adquiridas.');
 add(fields.tipo==='estoque_saida'&&!fields.item,'Informe qual produto saiu do estoque.');
 add(fields.tipo==='estoque_saida'&&lot,'O consumo para um lote precisa guardar o vínculo com o lote. Use o formulário Estoque para associar corretamente antes de confirmar.');
 add(/\bcomprei\b/.test(s)&&/\b\d+\s+sacos?\b/.test(s)&&/\b(?:vacas?|leite)\b/.test(s)&&fields.tipo==='estoque_entrada'&&!fields.item,'Diga qual ração ou produto foi comprado para as vacas.');
 add(fields.tipo==='leite_total'&&/\b(?:deu|produziu)\b/.test(s)&&knownDairyNames.some(name=>name&&s.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())),'Uma vaca foi mencionada; confira o nome e registre a produção individual, não o total do tanque.');
 return issues;
}
