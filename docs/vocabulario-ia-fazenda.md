# Vocabulário real da Fazenda Varela IA

Matriz de 100 frases. `prévia` significa que a interpretação pode ser revisada, sujeita à existência das entidades no Supabase e à validação dos campos obrigatórios. `esclarecer` bloqueia a confirmação e pede outra frase com os dados faltantes. `formulário` indica uma operação ainda não coberta com segurança pelo registro com IA. `hoje` e `ontem` são resolvidos no fuso America/Sao_Paulo; datas não ditas são a data do registro, mostrada na prévia. Nenhum exemplo deste documento deve gerar gravações em produção.

| Área | Frase | Tipo esperado | Entidades, valores, unidades, data e alvo explícitos | Falta / ação segura |
|---|---|---|---|---|
| Financeiro | Coloquei 250 reais de diesel no carro | despesa | R$250; diesel; carro | prévia; veículo na descrição, categoria Combustível |
| Financeiro | Coloquei 200 reais de diesel no trator | despesa | R$200; diesel; trator | prévia; categoria Combustível |
| Financeiro | Gastei 180 reais de gasolina na Ranger | despesa | R$180; gasolina; Ranger | prévia; categoria Combustível |
| Financeiro | Paguei 300 reais de diesel para trabalhar no pasto | despesa | R$300; diesel; pasto | prévia; categoria Combustível, centro não informado |
| Financeiro | Gastei 120 reais com óleo para o trator | despesa | R$120; óleo; trator | prévia; tipo de óleo não informado |
| Financeiro | Paguei 150 reais pro vaqueiro consertar a cerca | despesa | R$150; vaqueiro; cerca | prévia; categoria Mão de obra |
| Financeiro | Gastei 90 reais com material para o piquete 3 | despesa | R$90; material; Piquete 3 | prévia; material específico não informado |
| Financeiro | Paguei 100 reais de diária para o ajudante | despesa | R$100; diária; ajudante | prévia; categoria Mão de obra |
| Financeiro | Paguei 1700 reais de salário para o funcionário | despesa | R$1700; salário; funcionário | prévia; categoria Mão de obra |
| Financeiro | Gastei 350 reais com manutenção da bomba d’água | despesa | R$350; bomba d’água | prévia; categoria Manutenção |
| Estoque | Comprei proteinado 30% para os animais de corte | estoque_entrada | proteinado 30%; corte | esclarecer: quantidade e unidade; preço opcional |
| Estoque | Comprei 6 sacos de proteinado 30% a 160 reais cada | estoque_entrada | 6 sacos; proteinado 30%; R$160/saco; R$960 total | prévia; fornecedor opcional |
| Estoque | Chegaram 4 sacos de sal mineral | estoque_entrada | 4 sacos; sal mineral | prévia; custo opcional |
| Estoque | Tirei 2 sacos de proteinado do estoque para o Lote 1 | estoque_saida | 2 sacos; proteinado; Lote 1 | formulário: saída vinculada ao lote precisa persistir vínculo |
| Estoque | Coloquei 3 sacos de ração no cocho | estoque_saida | 3 sacos; ração; cocho | prévia se item único identificado; lote não informado |
| Estoque | Comprei 10 sacos de ração para as vacas de leite | estoque_entrada | 10 sacos; ração; leite | prévia; confirmar item/unidade e separação do estoque; preço opcional |
| Estoque | Usei 50 kg de sal mineral hoje | estoque_saida | 50 kg; sal mineral; hoje | prévia se item/unidade compatíveis com estoque |
| Estoque | Entraram 20 sacos de ração no estoque | estoque_entrada | 20 sacos; ração | prévia; preço opcional |
| Estoque | Acabou um saco de medicamento | indefinido | 1 saco; medicamento sem nome | esclarecer: item e se é baixa ou apenas saldo informado |
| Estoque | Tenho só 3 sacos de proteinado sobrando | indefinido | saldo observado: 3 sacos; proteinado | formulário: ajuste de saldo não é entrada nem saída |
| Pesagem | Pesei a B189 e deu 241 kg | pesagem_animal | B189; 241 kg | prévia; data do registro |
| Pesagem | A B209 pesou 250 kg hoje | pesagem_animal | B209; 250 kg; hoje | prévia |
| Pesagem | O Lote 1 deu média de 228 kg | pesagem_lote | Lote 1; média 228 kg | prévia de média, não altera pesos individuais |
| Pesagem | Pesei todas as novilhas do Lote 1 | pesagem_lote | Lote 1; grupo de novilhas | esclarecer: pesos individuais ou média medida |
| Pesagem | A B205 ganhou 12 kg desde a última pesagem | indefinido | B205; ganho 12 kg | esclarecer: peso atual medido não informado |
| Pesagem | A média do lote subiu para 235 kg | pesagem_lote | média 235 kg | esclarecer: qual lote e se é medição atual |
| Pesagem | A B233 tá com 210 kg | pesagem_animal | B233; peso atual 210 kg | prévia; confirmar data |
| Pesagem | O lote tá quase chegando na meta de 390 kg | indefinido | meta 390 kg; lote não identificado | esclarecer: isso não é pesagem |
| Pesagem | Registra 245 kg pra B244 hoje | pesagem_animal | B244; 245 kg; hoje | prévia |
| Pesagem | Pesei 10 novilhas hoje | indefinido | 10 novilhas; hoje | esclarecer: animais e pesos individuais |
| Sanidade | Apliquei ivermectina no Lote 1 | sanidade | ivermectina; Lote 1 | prévia; dose, via e responsável opcionais |
| Sanidade | Dei 5 ml de Bovitam em todas as novilhas | sanidade | Bovitam; 5 ml; novilhas | esclarecer: lote ou brincos destinatários |
| Sanidade | Apliquei vermífugo nas 33 novilhas | sanidade | vermífugo sem marca; 33 novilhas | esclarecer: produto e lote/brincos |
| Sanidade | Vacinei o Lote 1 hoje | sanidade | vacina sem nome; Lote 1; hoje | esclarecer: nome da vacina |
| Sanidade | Dei vitamina na B189 | sanidade | vitamina sem nome; B189 | esclarecer: qual produto |
| Sanidade | Apliquei medicamento na B209 porque ela tava mancando | sanidade | medicamento sem nome; B209; motivo mancando | esclarecer: nome do medicamento |
| Sanidade | Dei antiparasitário nas novilhas | sanidade | antiparasitário sem nome; novilhas | esclarecer: produto e lote/brincos |
| Sanidade | Apliquei 3 ml de remédio na B205 | sanidade | dose 3 ml; B205 | esclarecer: medicamento |
| Sanidade | Preciso dar reforço da vacina semana que vem | indefinido | reforço; próxima semana sem dia | esclarecer: data exata, produto e alvos; não registrar aplicação |
| Sanidade | A B233 ainda tá em período de carência | indefinido | B233; situação de carência | formulário: consultar tratamento e data final; não inventar |
| Leite | Produzi 42 litros de leite hoje | leite_total | tanque/rebanho; 42 L; hoje | prévia |
| Leite | Hoje de manhã deu 20 litros | leite_total | 20 L; manhã; hoje | esclarecer: confirmar que é leite do tanque |
| Leite | Hoje à tarde deu 18 litros | leite_total | 18 L; tarde; hoje | esclarecer: confirmar que é leite do tanque |
| Leite | A vaca Estrela deu 8 litros de manhã | leite_vaca | Estrela; 8 L; manhã | prévia se vaca existe |
| Leite | A Mimosa produziu 15 litros hoje | leite_vaca | Mimosa; 15 L; hoje | prévia se vaca existe |
| Leite | Registra 40 litros no tanque | leite_total | tanque; 40 L | prévia |
| Leite | Hoje o leite caiu para 35 litros | leite_total | leite total; 35 L; hoje | prévia de produção, sem inferir queda anterior |
| Leite | Tenho 7 vacas em lactação | indefinido | contagem observada: 7 vacas | formulário: situação de cada vaca não informada |
| Leite | A vaca Princesa secou | indefinido | Princesa; situação seca | formulário: atualizar ficha da vaca |
| Leite | A Estrela voltou a produzir mais leite | indefinido | Estrela; tendência sem litros | esclarecer: produção medida ou observação; não inventar litros |
| Reprodução | A vaca Estrela pariu uma bezerra hoje | parto | Estrela; 1 cria fêmea; hoje | esclarecer: brinco da cria |
| Reprodução | A Mimosa pariu ontem | parto | Mimosa; ontem | esclarecer: cria, sexo e brinco |
| Reprodução | A vaca Princesa tá prenha | prenhez | Princesa; prenha | prévia; data da cobertura e previsão opcionais |
| Reprodução | A previsão de parto da Mimosa é mês que vem | prenhez | Mimosa; mês que vem sem dia | esclarecer: data estimada exata |
| Reprodução | Nasceu um bezerro macho da Estrela | parto | Estrela; 1 cria macho | esclarecer: brinco da cria |
| Reprodução | A bezerra da Princesa ainda tá mamando | indefinido | cria da Princesa; mamando | formulário: identificar cria antes de alterar situação |
| Reprodução | Aparta o bezerro da Mimosa | indefinido | bezerro da Mimosa sem brinco | formulário: identificar cria e registrar desmame |
| Reprodução | A cria da Estrela foi desmamada hoje | indefinido | cria da Estrela; desmame hoje | formulário: identificar cria |
| Reprodução | A vaca ficou seca depois do parto | indefinido | vaca sem identificação; seca | esclarecer: qual vaca e situação |
| Reprodução | Registra o último parto da Mimosa | parto | Mimosa; parto sem data e cria | esclarecer: data e identificação/sexo da cria |
| Lote | Mudei a B189 para o Lote 2 | mover_lote | B189; Lote 2 | prévia somente se Lote 2 existe; não criar lote |
| Lote | Tirei 3 animais do Lote 1 | indefinido | 3 animais; Lote 1 | formulário: brincos e destino de cada animal |
| Lote | Coloquei as novilhas no piquete 3 | indefinido | novilhas; Piquete 3 | formulário: manejo/piquete não é lote de corte |
| Lote | Troquei o gado de piquete hoje | indefinido | manejo de piquete; hoje | esclarecer: animais, origem e destino |
| Lote | Levei o Lote 1 pro pasto novo | indefinido | Lote 1; pasto novo não identificado | formulário: manejo de pasto, não transferência de lote |
| Lote | Aparta as bezerras | indefinido | bezerras não identificadas | formulário: identificar animais e destino |
| Lote | Cria um lote novo com 10 novilhas | indefinido | lote novo sem nome; 10 novilhas | formulário: nome, brincos e destino |
| Lote | Move a B205 pro lote das maiores | mover_lote | B205; apelido não exclusivo do lote | esclarecer: nome exato de lote existente |
| Lote | Deixa a B209 sem lote | indefinido | B209; sem lote | formulário: movimentação sem destino não coberta pela IA |
| Lote | Registra manejo no Lote 1 | indefinido | Lote 1; manejo indefinido | esclarecer: tipo, produto ou atividade |
| Saída | Vendi a B205 por 4500 reais | venda | B205; R$4500 total | prévia crítica; confirmação explícita de saída |
| Saída | Vendi 3 novilhas por 12 mil | indefinido | 3 novilhas; R$12000, divisão não informada | esclarecer: brincos e valor por animal/total |
| Saída | A B189 saiu hoje | indefinido | B189; hoje | esclarecer: venda, abate, morte ou transferência |
| Saída | A B233 foi vendida por 4300 | venda | B233; R$4300, unidade monetária implícita no contexto | prévia crítica; confirmar total e data |
| Saída | Abati uma novilha do Lote 1 | indefinido | Lote 1; novilha sem brinco | esclarecer: qual animal e valor quando aplicável |
| Saída | Morreu uma novilha do lote | indefinido | novilha e lote não identificados | esclarecer: brinco; receita pode ser zero |
| Saída | A B209 foi transferida | indefinido | B209; transferência sem destino | formulário: tipo de saída e destino |
| Saída | Vendi o lote por 320 a arroba | indefinido | R$320/@; lote não identificado; peso total não dito | esclarecer: lote, animais, pesos e valor total |
| Saída | O peso final da B205 foi 390 kg | indefinido | B205; peso final 390 kg | esclarecer: pesagem ou saída; não encerrar animal |
| Saída | Gastei 500 reais de frete na venda | despesa | R$500; frete da venda | prévia; lote/animal vinculado não informado |
| Manutenção | Gastei 200 reais consertando a cerca | despesa | R$200; conserto de cerca | prévia; piquete não informado |
| Manutenção | Paguei 300 reais pra arrumar a bomba | despesa | R$300; conserto de bomba | prévia |
| Manutenção | Comprei arame pro piquete 2 | indefinido | arame; Piquete 2 | esclarecer: estoque ou despesa, quantidade e valor |
| Manutenção | Gastei 180 reais com mangueira | despesa | R$180; mangueira | prévia |
| Manutenção | Troquei a boia do bebedouro | indefinido | boia; bebedouro | formulário: manejo de infraestrutura sem custo/peça |
| Manutenção | Paguei material pra fazer o cocho | despesa | material; cocho; valor ausente | esclarecer: valor pago |
| Manutenção | Gastei 250 reais na manutenção do trator | despesa | R$250; manutenção trator | prévia |
| Manutenção | Comprei óleo hidráulico | indefinido | óleo hidráulico | esclarecer: quantidade, unidade e valor se despesa |
| Manutenção | Arrumei a cerca elétrica hoje | indefinido | cerca elétrica; hoje | formulário: atividade sem registro financeiro |
| Manutenção | Gastei 400 reais no curral | despesa | R$400; curral | prévia; finalidade específica não dita |
| Ambígua | Gastei 150 no lote 1 | indefinido | 150 sem unidade monetária dita; Lote 1 | esclarecer: finalidade e moeda; não criar despesa |
| Ambígua | Botei 200 na B189 | indefinido | 200 sem unidade; B189 | esclarecer: peso, dose, dinheiro ou outra operação |
| Ambígua | Deu 40 hoje | indefinido | 40 sem unidade; hoje | esclarecer: o que foi medido |
| Ambígua | Comprei 10 por 160 | indefinido | 10 e 160 sem produto/unidade | esclarecer: produto, unidade e total/preço unitário |
| Ambígua | Apliquei 5 ml | indefinido | dose 5 ml | esclarecer: produto e alvo |
| Ambígua | Vendi por 320 | indefinido | 320 sem unidade/animal | esclarecer: animal e preço total ou por arroba |
| Ambígua | Coloquei 3 sacos | indefinido | 3 sacos sem produto | esclarecer: produto e entrada/saída |
| Ambígua | Pesei o lote | indefinido | lote sem nome; sem peso | esclarecer: lote e medida |
| Ambígua | Dei remédio nas novilhas | indefinido | remédio sem nome; novilhas sem lote | esclarecer: produto e alvos |
| Ambígua | A vaca produziu 8 | indefinido | 8 sem unidade; vaca sem nome | esclarecer: vaca, litros e data |
