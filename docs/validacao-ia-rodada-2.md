# Validação real do parser no aplicativo público

Data dos testes: 27/09/2026 (America/Sao_Paulo). Amostra pré-definida de 36 frases da matriz de 100. Conferência SQL após as duas rodadas: 0 rascunhos criados durante os testes; o Lote 1 continuou com 33 animais ativos.

Os resultados são prévias reais no domínio da Vercel: OpenAI + reparos/validações do backend. O conteúdo bruto do modelo não é exposto pelo aplicativo nem armazenado. O modo “Avaliar sem gravar” desabilita Confirmar e não cria rascunho no Supabase. “Passaria” indica o resultado da validação antes do bloqueio do modo de teste; operações críticas exigem ainda confirmação expressa no uso normal.

**Testadas:** 36 · **Corretas:** 35 · **Com erro:** 1 · **Taxa de acerto:** 97.2% · **Ambiguidades tratadas integralmente:** 5/5 (100.0%).

| Categoria | Casos | Erros |
|---|---:|---:|
| financeiro | 3 | 1 |
| combustível | 3 | 0 |
| estoque | 4 | 0 |
| corte | 3 | 0 |
| pesagem | 3 | 0 |
| sanidade | 3 | 0 |
| leite | 3 | 0 |
| reprodução | 3 | 0 |
| venda/saída | 3 | 0 |
| manutenção | 3 | 0 |
| ambiguidade | 5 | 0 |

| # | Categoria | Frase | Esperado | Resultado real da prévia | Campos corretos | Campos incorretos / ausentes | Esclarecimento esperado/real | Confirmar |
|---:|---|---|---|---|---|---|---|---|
| 1 | financeiro | Paguei 150 reais pro vaqueiro consertar a cerca | despesa | despesa | Valor total (R$), Categoria | — | não / não | bloqueado |
| 2 | financeiro | Gastei 90 reais com material para o piquete 3 | despesa | despesa | Valor total (R$) | Centro de custo: piquete 3 | não / não | bloqueado |
| 3 | combustível | Coloquei 200 reais de diesel no trator | despesa | despesa | Valor total (R$), Categoria, Descrição | — | não / não | bloqueado |
| 4 | combustível | Gastei 180 reais de gasolina na Ranger | despesa | despesa | Valor total (R$), Categoria, Descrição | — | não / não | bloqueado |
| 5 | combustível | Paguei 300 reais de diesel para trabalhar no pasto | despesa | despesa | Valor total (R$), Categoria, Descrição | — | não / não | bloqueado |
| 6 | estoque | Comprei proteinado 30% para os animais de corte | estoque_entrada | estoque entrada | Item de estoque, Quantidade / kg / litros | — | sim / sim | bloqueado |
| 7 | estoque | Comprei 6 sacos de proteinado 30% a 160 reais cada | estoque_entrada | estoque entrada | Quantidade / kg / litros, Unidade, Valor total (R$), Item de estoque | — | não / não | bloqueado |
| 8 | estoque | Chegaram 4 sacos de sal mineral | estoque_entrada | estoque entrada | Quantidade / kg / litros, Unidade, Item de estoque | — | não / não | bloqueado |
| 9 | estoque | Tirei 2 sacos de proteinado do estoque para o Lote 1 | estoque_saida | estoque saida | Quantidade / kg / litros, Item de estoque | — | sim / sim | bloqueado |
| 10 | corte | Mudei a B189 para o Lote 2 | mover_lote | mover lote | Brinco do animal, Lote de corte | — | sim / sim | bloqueado |
| 11 | corte | Cria um lote novo com 10 novilhas | indefinido | indefinido | — | — | sim / sim | bloqueado |
| 12 | corte | Levei o Lote 1 pro pasto novo | indefinido | indefinido | — | — | sim / sim | bloqueado |
| 13 | pesagem | Pesei a B189 e deu 241 kg | pesagem_animal | pesagem animal | Brinco do animal, Quantidade / kg / litros | — | não / não | bloqueado |
| 14 | pesagem | O Lote 1 deu média de 228 kg | pesagem_lote | pesagem lote | Lote de corte, Quantidade / kg / litros | — | não / não | bloqueado |
| 15 | pesagem | A B205 ganhou 12 kg desde a última pesagem | indefinido | indefinido | Quantidade / kg / litros | — | sim / sim | bloqueado |
| 16 | sanidade | Apliquei ivermectina no Lote 1 | sanidade | sanidade | Lote de corte, Vacina / medicamento | — | não / não | bloqueado |
| 17 | sanidade | Dei 5 ml de Bovitam em todas as novilhas | sanidade | sanidade | Lote de corte, Vacina / medicamento | — | sim / sim | bloqueado |
| 18 | sanidade | Vacinei o Lote 1 hoje | sanidade | sanidade | Lote de corte, Vacina / medicamento | — | sim / sim | bloqueado |
| 19 | leite | Produzi 42 litros de leite hoje | leite_total | leite total | Quantidade / kg / litros | — | não / não | bloqueado |
| 20 | leite | A vaca Estrela deu 8 litros de manhã | leite_vaca | leite vaca | Vaca leiteira, Quantidade / kg / litros, Turno | — | sim / sim | bloqueado |
| 21 | leite | Hoje de manhã deu 20 litros | leite_total | leite total | Quantidade / kg / litros | — | sim / sim | bloqueado |
| 22 | reprodução | A vaca Estrela pariu uma bezerra hoje | parto | parto | Vaca leiteira, Sexo da cria (macho/femea), Brinco da cria | — | sim / sim | bloqueado |
| 23 | reprodução | A vaca Princesa tá prenha | prenhez | prenhez | Vaca leiteira, Data | — | sim / sim | bloqueado |
| 24 | reprodução | A previsão de parto da Mimosa é mês que vem | prenhez | prenhez | Vaca leiteira, Previsão de parto | — | sim / sim | bloqueado |
| 25 | venda/saída | Vendi a B205 por 4500 reais | venda | venda | Brinco do animal, Valor total (R$) | — | não / não | bloqueado |
| 26 | venda/saída | Vendi 3 novilhas por 12 mil | venda | venda | Brinco do animal, Valor total (R$) | — | sim / sim | bloqueado |
| 27 | venda/saída | A B189 saiu hoje | indefinido | indefinido | — | — | sim / sim | bloqueado |
| 28 | manutenção | Gastei 200 reais consertando a cerca | despesa | despesa | Valor total (R$), Categoria | — | não / não | bloqueado |
| 29 | manutenção | Comprei arame pro piquete 2 | indefinido | indefinido | — | — | sim / sim | bloqueado |
| 30 | manutenção | Gastei 250 reais na manutenção do trator | despesa | despesa | Valor total (R$), Categoria | — | não / não | bloqueado |
| 31 | ambiguidade | Gastei 150 no lote 1 | indefinido | indefinido | Valor total (R$) | — | sim / sim | bloqueado |
| 32 | ambiguidade | Botei 200 na B189 | indefinido | indefinido | Quantidade / kg / litros | — | sim / sim | bloqueado |
| 33 | ambiguidade | Deu 40 hoje | indefinido | indefinido | Quantidade / kg / litros | — | sim / sim | bloqueado |
| 34 | ambiguidade | Apliquei 5 ml | indefinido | indefinido | Lote de corte | — | sim / sim | bloqueado |
| 35 | ambiguidade | A vaca produziu 8 | indefinido | indefinido | Quantidade / kg / litros | — | sim / sim | bloqueado |
| 36 | financeiro | Paguei 1700 reais de salário para o funcionário | despesa | despesa | Valor total (R$), Categoria | — | não / não | bloqueado |

Uma frase só conta como correta se operação, valores e entidades essenciais coincidirem, a prévia souber quando pedir esclarecimento e o botão ficar bloqueado neste modo. Aviso de lote inventado também reprova. O escore não certifica persistência de dados, pois nenhum caso foi confirmado.
