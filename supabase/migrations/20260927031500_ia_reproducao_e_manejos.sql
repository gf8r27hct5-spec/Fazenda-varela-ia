-- Amplia operações com validação de escopo; substitui somente a função de confirmação.
create or replace function public.finalizar_registro_ia(p_id uuid,p_acao text,p_dados jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.registros_ia%rowtype; v_operacao uuid; v_tipo text; v_animal uuid; v_lote uuid; v_item uuid; v_centro uuid; v_valor numeric; v_quantidade numeric; v_data date; v_estoque numeric;
begin
 select * into r from public.registros_ia where id=p_id for update;
 if r.id is null or r.usuario_id is distinct from auth.uid() or not private.usuario_tem_acesso_fazenda(r.fazenda_id) then raise exception 'Rascunho não encontrado'; end if;
 if r.estado <> 'pendente' or r.criado_em < now()-interval '24 hours' then raise exception 'Rascunho expirado ou já finalizado'; end if;
 if p_acao='cancelar' then
  update public.registros_ia set estado='cancelado',finalizado_em=now() where id=r.id;
  return null;
 end if;
 if p_acao <> 'confirmar' or jsonb_typeof(p_dados)<>'object' then raise exception 'Ação inválida'; end if;
 v_tipo=p_dados->>'tipo';
 if v_tipo not in ('despesa','receita','conta_pagar','pesagem_animal','pesagem_lote','sanidade','leite_total','leite_vaca','estoque_entrada','estoque_saida','venda','abate','morte','parto','prenhez','observacao','mover_lote') then raise exception 'Tipo inválido'; end if;
 if nullif(p_dados->>'data','') is null then raise exception 'Data obrigatória'; end if;
 v_data=(p_dados->>'data')::date;
 if v_data > current_date + 30 or v_data < current_date - 3650 then raise exception 'Data fora do intervalo'; end if;
 v_valor=nullif(p_dados->>'valor','')::numeric;
 v_quantidade=nullif(p_dados->>'quantidade','')::numeric;
 if v_valor is not null and (v_valor<0 or v_valor>100000000) or v_quantidade is not null and (v_quantidade<=0 or v_quantidade>1000000) then raise exception 'Valor inválido'; end if;
 v_animal=nullif(p_dados->>'animal_id','')::uuid;
 v_lote=nullif(p_dados->>'lote_id','')::uuid;
 v_item=nullif(p_dados->>'estoque_id','')::uuid;
 if v_animal is not null and not exists(select 1 from public.animais where id=v_animal and fazenda_id=r.fazenda_id and status='ativo') then raise exception 'Animal indisponível'; end if;
 if v_lote is not null and not exists(select 1 from public.lotes where id=v_lote and fazenda_id=r.fazenda_id and sistema='corte' and ativo) then raise exception 'Lote indisponível'; end if;
 if v_item is not null and not exists(select 1 from public.estoque where id=v_item and fazenda_id=r.fazenda_id and ativo) then raise exception 'Item indisponível'; end if;
 if v_tipo in ('despesa','receita','conta_pagar') then
  if coalesce(v_valor,0)<=0 or length(trim(coalesce(p_dados->>'descricao','')))<2 then raise exception 'Valor e descrição obrigatórios'; end if;
  v_centro=nullif(p_dados->>'centro_id','')::uuid;
  if v_centro is not null and not exists(select 1 from public.centros_custo where id=v_centro and fazenda_id=r.fazenda_id and ativo) then raise exception 'Centro de custo inválido'; end if;
  if v_centro is null and nullif(p_dados->>'centro','') is not null then
   if length(p_dados->>'centro')>120 then raise exception 'Centro de custo longo demais'; end if;
   select id into v_centro from public.centros_custo where fazenda_id=r.fazenda_id and lower(nome)=lower(p_dados->>'centro') and ativo limit 1;
   if v_centro is null then insert into public.centros_custo(fazenda_id,nome) values(r.fazenda_id,p_dados->>'centro') returning id into v_centro; end if;
  end if;
  insert into public.transacoes(fazenda_id,tipo,valor,descricao,categoria,data_competencia,status,fornecedor_cliente,centro_custo_id,lote_id,origem)
  values(r.fazenda_id,case when v_tipo='receita' then 'receita' else 'despesa' end,v_valor,left(p_dados->>'descricao',180),coalesce(nullif(p_dados->>'categoria',''),'Outros'),v_data,case when v_tipo='conta_pagar' then 'pendente' else 'pago' end,nullif(p_dados->>'pessoa',''),v_centro,v_lote,'ia') returning id into v_operacao;
 elsif v_tipo in ('pesagem_animal','pesagem_lote') then
  if v_quantidade is null or v_tipo='pesagem_animal' and (v_animal is null or not exists(select 1 from public.animais where id=v_animal and sistema='corte')) or v_tipo='pesagem_lote' and v_lote is null then raise exception 'Peso e animal ou lote obrigatórios'; end if;
  insert into public.pesagens(fazenda_id,animal_id,lote_id,data_pesagem,peso_kg,observacoes,responsavel)
  values(r.fazenda_id,case when v_tipo='pesagem_animal' then v_animal else null end,case when v_tipo='pesagem_lote' then v_lote else (select lote_id from public.animais where id=v_animal) end,v_data,v_quantidade,nullif(p_dados->>'observacoes',''),nullif(p_dados->>'pessoa','')) returning id into v_operacao;
  if v_tipo='pesagem_animal' then update public.animais set peso_atual=v_quantidade where id=v_animal and fazenda_id=r.fazenda_id; end if;
 elsif v_tipo='sanidade' then
  if nullif(p_dados->>'produto','') is null then raise exception 'Produto obrigatório'; end if;
  if v_lote is null and v_animal is not null and exists(select 1 from public.animais where id=v_animal and fazenda_id=r.fazenda_id and sistema='leite' and categoria is distinct from 'Cria leiteira') then
   insert into public.manejos(fazenda_id,animal_id,tipo,produto,data_manejo,dose,dose_unidade,via_aplicacao,responsavel,observacoes)
   values(r.fazenda_id,v_animal,coalesce(nullif(p_dados->>'subtipo',''),'medicamento'),p_dados->>'produto',v_data,nullif(p_dados->>'dose',''),nullif(p_dados->>'unidade',''),nullif(p_dados->>'via',''),nullif(p_dados->>'pessoa',''),nullif(p_dados->>'observacoes','')) returning id into v_operacao;
  else
   if v_lote is null or (v_animal is not null and not exists(select 1 from public.animais where id=v_animal and lote_id=v_lote and sistema='corte')) then raise exception 'Lote e animais de corte obrigatórios'; end if;
  if not exists(select 1 from public.animais where lote_id=v_lote and fazenda_id=r.fazenda_id and status='ativo' and (v_animal is null or id=v_animal)) then raise exception 'Lote sem animais elegíveis'; end if;
  perform public.registrar_manejo_corte(v_lote,array(select id from public.animais where lote_id=v_lote and fazenda_id=r.fazenda_id and status='ativo' and (v_animal is null or id=v_animal)),jsonb_build_object('tipo',coalesce(nullif(p_dados->>'subtipo',''),'medicamento'),'produto',p_dados->>'produto','data_manejo',v_data::text,'dose',coalesce(p_dados->>'dose',''),'dose_unidade',coalesce(p_dados->>'unidade',''),'via_aplicacao',coalesce(p_dados->>'via',''),'responsavel',coalesce(p_dados->>'pessoa',''),'observacoes',coalesce(p_dados->>'observacoes','')));
  v_operacao=v_lote;
  end if;
 elsif v_tipo in ('leite_total','leite_vaca') then
  if v_quantidade is null or v_tipo='leite_vaca' and (v_animal is null or not exists(select 1 from public.animais where id=v_animal and sistema='leite' and categoria is distinct from 'Cria leiteira')) then raise exception 'Litros e vaca obrigatórios'; end if;
  insert into public.producao_leite(fazenda_id,animal_id,data_producao,litros,turno)
  values(r.fazenda_id,case when v_tipo='leite_vaca' then v_animal else null end,v_data,v_quantidade,case when p_dados->>'turno' in ('manha','tarde','noite') then p_dados->>'turno' else 'total_dia' end) returning id into v_operacao;
 elsif v_tipo in ('estoque_entrada','estoque_saida') then
  if v_quantidade is null then raise exception 'Quantidade obrigatória'; end if;
  if v_item is null and v_tipo='estoque_entrada' then
   if length(coalesce(p_dados->>'item','')) not between 2 and 120 or length(coalesce(p_dados->>'unidade','')) not between 1 and 30 then raise exception 'Nome e unidade obrigatórios para item novo'; end if;
   select id into v_item from public.estoque where fazenda_id=r.fazenda_id and lower(nome)=lower(p_dados->>'item') and ativo limit 1;
   if v_item is null then insert into public.estoque(fazenda_id,nome,categoria,unidade,quantidade_atual) values(r.fazenda_id,p_dados->>'item',coalesce(nullif(p_dados->>'categoria',''),'Outros'),p_dados->>'unidade',0) returning id into v_item; end if;
  end if;
  if v_item is null then raise exception 'Item de estoque obrigatório'; end if;
  select quantidade_atual into v_estoque from public.estoque where id=v_item and fazenda_id=r.fazenda_id for update;
  if v_tipo='estoque_saida' and v_estoque<v_quantidade then raise exception 'Estoque insuficiente'; end if;
  insert into public.movimentacoes_estoque(fazenda_id,estoque_id,tipo,quantidade,valor_total,data_movimentacao,motivo)
  values(r.fazenda_id,v_item,case when v_tipo='estoque_entrada' then 'entrada' else 'saida' end,v_quantidade,v_valor,v_data,nullif(p_dados->>'descricao','')) returning id into v_operacao;
  update public.estoque set quantidade_atual=v_estoque+case when v_tipo='estoque_entrada' then v_quantidade else -v_quantidade end where id=v_item;
  if v_tipo='estoque_entrada' and v_valor>0 then
   insert into public.transacoes(fazenda_id,tipo,categoria,descricao,valor,data_competencia,status,origem)
   values(r.fazenda_id,'despesa',coalesce(nullif(p_dados->>'categoria',''),'Estoque'),'Compra: '||left(p_dados->>'item',120),v_valor,v_data,'pago','ia');
  end if;
 elsif v_tipo in ('venda','abate','morte') then
  if v_animal is null or not exists(select 1 from public.animais where id=v_animal and sistema='corte') or v_tipo<>'morte' and coalesce(v_valor,0)<=0 then raise exception 'Animal e valor da saída obrigatórios'; end if;
  perform public.registrar_saida_corte(v_animal,jsonb_build_object('tipo',v_tipo,'data_saida',v_data::text,'valor_venda',coalesce(v_valor,0)::text,'peso_final',coalesce(p_dados->>'quantidade',''),'comprador_destino',coalesce(p_dados->>'pessoa',''),'observacoes',coalesce(p_dados->>'observacoes','')));
  select id into v_operacao from public.saidas_corte where animal_id=v_animal and fazenda_id=r.fazenda_id order by criado_em desc limit 1;
 elsif v_tipo='parto' then
  if v_animal is null or not exists(select 1 from public.animais where id=v_animal and sistema='leite' and categoria is distinct from 'Cria leiteira') or length(coalesce(p_dados->>'cria','')) not between 1 and 80 or p_dados->>'sexo' not in ('macho','femea') then raise exception 'Vaca, brinco e sexo da cria são obrigatórios'; end if;
  v_operacao=public.registrar_parto_leite(v_animal,v_data,null,true,nullif(p_dados->>'observacoes',''),jsonb_build_array(jsonb_build_object('identificacao',p_dados->>'cria','sexo',p_dados->>'sexo','situacao','viva')));
 elsif v_tipo='prenhez' then
  if v_animal is null or not exists(select 1 from public.animais where id=v_animal and sistema='leite' and categoria is distinct from 'Cria leiteira') then raise exception 'Vaca leiteira obrigatória'; end if;
  if nullif(p_dados->>'previsao','') is not null and (p_dados->>'previsao')::date<v_data then raise exception 'Previsão anterior à observação'; end if;
  update public.animais set prenhe=true,proxima_previsao_parto=coalesce(nullif(p_dados->>'previsao','')::date,proxima_previsao_parto),observacoes_reproducao=concat_ws(E'\n',observacoes_reproducao,nullif(p_dados->>'observacoes','')) where id=v_animal and fazenda_id=r.fazenda_id;
  v_operacao=v_animal;
 elsif v_tipo='observacao' then
  if v_animal is null or length(coalesce(p_dados->>'descricao','')) not between 2 and 500 then raise exception 'Animal e observação obrigatórios'; end if;
  update public.animais set observacoes=concat_ws(E'\n',observacoes,v_data::text||' · '||left(p_dados->>'descricao',500)) where id=v_animal and fazenda_id=r.fazenda_id;
  v_operacao=v_animal;
 elsif v_tipo='mover_lote' then
  if v_animal is null or v_lote is null or not exists(select 1 from public.animais where id=v_animal and sistema='corte') then raise exception 'Animal de corte e lote obrigatórios'; end if;
  update public.animais set lote_id=v_lote where id=v_animal and fazenda_id=r.fazenda_id;
  v_operacao=v_animal;
 else
  raise exception 'Operação não suportada';
 end if;
 update public.registros_ia set estado='confirmado',confirmado=true,resultado=p_dados,operacao_id=v_operacao,finalizado_em=now() where id=r.id;
 return v_operacao;
end $$;
