import fs from 'node:fs';

// A ordem é a mesma das 36 frases da primeira rodada. Todos os dados são lidos
// da prévia pública, depois da resposta OpenAI e das regras locais de segurança.
const checks=[
 ['despesa',1,{'Valor total (R$)':'150','Categoria':'Mão de obra'}],
 ['despesa',1,{'Valor total (R$)':'90','Centro de custo':'Piquete 3'},['O lote informado não foi localizado']],
 ['despesa',1,{'Valor total (R$)':'200','Categoria':'Combustível','Descrição':'~diesel','Descrição 2':'~trator'}],
 ['despesa',1,{'Valor total (R$)':'180','Categoria':'Combustível','Descrição':'~gasolina','Descrição 2':'~Ranger'}],
 ['despesa',1,{'Valor total (R$)':'300','Categoria':'Combustível','Descrição':'~diesel','Descrição 2':'~pasto'}],
 ['estoque_entrada',0,{'Item de estoque':'~proteinado 30%','Quantidade / kg / litros':'Não informado'}],
 ['estoque_entrada',1,{'Quantidade / kg / litros':'6','Unidade':'saco','Valor total (R$)':'960','Item de estoque':'~proteinado 30%'}],
 ['estoque_entrada',1,{'Quantidade / kg / litros':'4','Unidade':'saco','Item de estoque':'~sal mineral'}],
 ['estoque_saida',0,{'Quantidade / kg / litros':'2','Item de estoque':'~proteinado'}],
 ['mover_lote',0,{'Brinco do animal':'B189','Lote de corte':'Lote 2'}],
 ['indefinido',0,{}],
 ['indefinido',0,{}],
 ['pesagem_animal',1,{'Brinco do animal':'B189','Quantidade / kg / litros':'241'}],
 ['pesagem_lote',1,{'Lote de corte':'Lote 1','Quantidade / kg / litros':'228'}],
 ['indefinido',0,{'Quantidade / kg / litros':'Não informado'}],
 ['sanidade',1,{'Lote de corte':'Lote 1','Vacina / medicamento':'ivermectina'}],
 ['sanidade',0,{'Lote de corte':'Não informado','Vacina / medicamento':'Bovitam'}],
 ['sanidade',0,{'Lote de corte':'Lote 1','Vacina / medicamento':'Não informado'}],
 ['leite_total',1,{'Quantidade / kg / litros':'42'}],
 ['leite_vaca',0,{'Vaca leiteira':'Estrela','Quantidade / kg / litros':'8','Turno':'manhã'}],
 ['leite_total',0,{'Quantidade / kg / litros':'20'}],
 ['parto',0,{'Vaca leiteira':'Estrela','Sexo da cria (macho/femea)':'femea','Brinco da cria':'Não informado'}],
 ['prenhez',0,{'Vaca leiteira':'Princesa','Data':'2026-09-27'}],
 ['prenhez',0,{'Vaca leiteira':'Mimosa','Previsão de parto':'Não informado'}],
 ['venda',1,{'Brinco do animal':'B205','Valor total (R$)':'4500'}],
 ['venda',0,{'Brinco do animal':'Não informado','Valor total (R$)':'12000'}],
 ['indefinido',0,{}],
 ['despesa',1,{'Valor total (R$)':'200','Categoria':'Manutenção'}],
 ['indefinido',0,{}],
 ['despesa',1,{'Valor total (R$)':'250','Categoria':'Manutenção'}],
 ['indefinido',0,{'Valor total (R$)':'Não informado'}],
 ['indefinido',0,{'Quantidade / kg / litros':'Não informado'}],
 ['indefinido',0,{'Quantidade / kg / litros':'Não informado'}],
 ['indefinido',0,{'Lote de corte':'Não informado'}],
 ['indefinido',0,{'Quantidade / kg / litros':'Não informado'}],
 ['despesa',1,{'Valor total (R$)':'1700','Categoria':'Mão de obra'}],
];
const [,,input,output]=process.argv;
if(!input||!output)throw new Error('Informe JSON de entrada e Markdown de saída.');
const results=JSON.parse(fs.readFileSync(input,'utf8'));
if(results.length!==checks.length)throw new Error(`Amostra incompleta: ${results.length}/${checks.length}`);
const rows=results.map((row,i)=>{
 const [type,would,required,forbidden=[]]=checks[i];
 const fields=Object.fromEntries(row.fields||[]);
 const bad=[];
 if(row.heading?.replaceAll(' ','_')!==type)bad.push(`tipo: ${row.heading||'sem prévia'}`);
 for(const [label,expected] of Object.entries(required)){
  const value=fields[label.replace(/ 2$/,'')]||'Não informado';
  if(expected.startsWith('~')?!value.toLowerCase().includes(expected.slice(1).toLowerCase()):value!==expected)bad.push(`${label}: ${value}`);
 }
 const wouldReally=(row.message||[]).some(s=>s.startsWith('Os campos passariam'));
 if(wouldReally!==!!would)bad.push(`passaria validação: ${wouldReally?'sim':'não'}`);
 if(!row.confirmDisabled)bad.push('botão de confirmação habilitado');
 for(const fragment of forbidden)if((row.warnings||[]).some(s=>s.includes(fragment)))bad.push(`aviso indevido: ${fragment}`);
 return {...row,expectedType:type,expectedWould:!!would,actualWould:wouldReally,errors:bad,pass:bad.length===0};
});
const total=rows.length,correct=rows.filter(x=>x.pass).length,ambiguous=rows.filter(x=>x.category==='ambiguidade'),safeAmbiguous=ambiguous.filter(x=>x.pass).length;
const categories=[...new Set(rows.map(x=>x.category))].map(category=>({category,total:rows.filter(x=>x.category===category).length,errors:rows.filter(x=>x.category===category&&!x.pass).length}));
const escape=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const report=[
 '# Validação real do parser no aplicativo público',
 '',
 'Data dos testes: 27/09/2026 (America/Sao_Paulo). Amostra pré-definida de 36 frases da matriz de 100. Conferência SQL após as duas rodadas: 0 rascunhos criados durante os testes; o Lote 1 continuou com 33 animais ativos.',
 '',
 'Os resultados são prévias reais no domínio da Vercel: OpenAI + reparos/validações do backend. O conteúdo bruto do modelo não é exposto pelo aplicativo nem armazenado. O modo “Avaliar sem gravar” desabilita Confirmar e não cria rascunho no Supabase. “Passaria” indica o resultado da validação antes do bloqueio do modo de teste; operações críticas exigem ainda confirmação expressa no uso normal.',
 '',
 `**Testadas:** ${total} · **Corretas:** ${correct} · **Com erro:** ${total-correct} · **Taxa de acerto:** ${(100*correct/total).toFixed(1)}% · **Ambiguidades tratadas integralmente:** ${safeAmbiguous}/${ambiguous.length} (${(100*safeAmbiguous/ambiguous.length).toFixed(1)}%).`,
 '',
 '| Categoria | Casos | Erros |', '|---|---:|---:|',
 ...categories.map(x=>`| ${x.category} | ${x.total} | ${x.errors} |`),
 '',
 '| # | Categoria | Frase | Esperado | Resultado real da prévia | Campos corretos | Campos incorretos / ausentes | Esclarecimento esperado/real | Confirmar |',
 '|---:|---|---|---|---|---|---|---|---|',
 ...rows.map((r,i)=>{
  const check=checks[i],fields=Object.fromEntries(r.fields||[]);
  const correctFields=Object.entries(check[2]).filter(([k,v])=>{const value=fields[k.replace(/ 2$/,'')]||'Não informado';return v.startsWith('~')?value.toLowerCase().includes(v.slice(1).toLowerCase()):value===v}).map(([k])=>k.replace(/ 2$/,''));
  return `| ${i+1} | ${escape(r.category)} | ${escape(r.phrase)} | ${escape(check[0])} | ${escape(r.heading||'sem prévia')} | ${escape([...new Set(correctFields)].join(', ')||'—')} | ${escape(r.errors.join('; ')||'—')} | ${check[1]?'não':'sim'} / ${r.actualWould?'não':'sim'} | ${r.confirmDisabled?'bloqueado':'HABILITADO'} |`;
 }),
 '',
 'Uma frase só conta como correta se operação, valores e entidades essenciais coincidirem, a prévia souber quando pedir esclarecimento e o botão ficar bloqueado neste modo. Aviso de lote inventado também reprova. O escore não certifica persistência de dados, pois nenhum caso foi confirmado.',
 ''
].join('\n');
fs.writeFileSync(output,report);
console.log(JSON.stringify({total,correct,errors:total-correct,accuracy:correct/total,ambiguitySafe:safeAmbiguous,ambiguityTotal:ambiguous.length,categories,failures:rows.filter(x=>!x.pass).map(x=>({phrase:x.phrase,errors:x.errors}))},null,2));
