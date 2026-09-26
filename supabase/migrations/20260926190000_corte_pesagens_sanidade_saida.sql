-- Evolução aditiva: nenhum cadastro ou pesagem existente é alterado.
alter table public.pesagens add column if not exists responsavel text;
alter table public.manejos add column if not exists dose_unidade text;
alter table public.manejos add column if not exists via_aplicacao text;
alter table public.manejos add column if not exists lote_produto text;
alter table public.manejos add column if not exists motivo text;
alter table public.manejos add column if not exists frequencia text;
alter table public.manejos add column if not exists duracao_dias integer;
alter table public.manejos add column if not exists data_fim date;
alter table public.manejos add column if not exists carencia_dias integer;
alter table public.manejos add column if not exists data_fim_carencia date;
alter table public.animais drop constraint if exists animais_status_check;
alter table public.animais add constraint animais_status_check check (status in ('ativo','inativo','vendido','abatido','morto','transferido','descartado'));
alter table public.transacoes drop constraint if exists transacoes_origem_check;
alter table public.transacoes add constraint transacoes_origem_check check (origem in ('manual','foto','audio','ia','importacao','saida'));

create table public.saidas_corte (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id),
  animal_id uuid not null unique references public.animais(id) on delete cascade,
  lote_id uuid references public.lotes(id) on delete set null,
  data_saida date not null,
  tipo text not null check (tipo in ('venda','abate','morte','transferencia','descarte')),
  peso_final numeric check (peso_final > 0),
  rendimento_carcaca numeric check (rendimento_carcaca > 0 and rendimento_carcaca <= 100),
  valor_venda numeric not null default 0 check (valor_venda >= 0),
  frete numeric not null default 0 check (frete >= 0),
  outras_despesas numeric not null default 0 check (outras_despesas >= 0),
  comprador_destino text,
  observacoes text,
  criado_em timestamptz not null default now()
);
create index saidas_corte_lote_idx on public.saidas_corte(fazenda_id,lote_id,data_saida);
alter table public.saidas_corte enable row level security;
create policy saidas_corte_consulta on public.saidas_corte for select to authenticated
 using (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy saidas_corte_insercao on public.saidas_corte for insert to authenticated
 with check (private.usuario_tem_acesso_fazenda(fazenda_id) and exists (
  select 1 from public.animais a where a.id=saidas_corte.animal_id and a.fazenda_id=saidas_corte.fazenda_id and a.sistema='corte' and a.status='ativo'
  and a.lote_id is not distinct from saidas_corte.lote_id
 ));
grant select,insert on public.saidas_corte to authenticated;

-- RPCs security invoker mantêm RLS para todas as tabelas e são transacionais.
create function public.registrar_pesagens_lote_corte(p_lote_id uuid,p_data date,p_pesos jsonb,p_responsavel text default null,p_observacoes text default null)
returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; v_animal uuid; v_peso numeric; v_fazenda uuid; v_total integer:=0;
begin
  select l.fazenda_id into v_fazenda from public.lotes l join public.fazendas f on f.id=l.fazenda_id
   where l.id=p_lote_id and l.sistema='corte' and l.ativo and f.proprietario_id=(select auth.uid());
  if v_fazenda is null or p_data is null or jsonb_typeof(p_pesos)<>'array' or jsonb_array_length(p_pesos)=0 then raise exception 'Lote ou pesagens inválidas'; end if;
  for item in select value from jsonb_array_elements(p_pesos) loop
    v_animal:=(item->>'animal_id')::uuid; v_peso:=(item->>'peso_kg')::numeric;
    if v_peso is null or v_peso<=0 or not exists(select 1 from public.animais a where a.id=v_animal and a.fazenda_id=v_fazenda and a.lote_id=p_lote_id and a.sistema='corte' and a.status='ativo') then raise exception 'Animal ou peso inválido'; end if;
    if exists(select 1 from public.pesagens where animal_id=v_animal and data_pesagem=p_data) then raise exception 'Animal já pesado nesta data'; end if;
    insert into public.pesagens(fazenda_id,lote_id,animal_id,data_pesagem,peso_kg,responsavel,observacoes)
     values(v_fazenda,p_lote_id,v_animal,p_data,v_peso,nullif(btrim(p_responsavel),''),nullif(btrim(p_observacoes),''));
    v_total:=v_total+1;
  end loop;
  return v_total;
end $$;

create function public.registrar_manejo_corte(p_lote_id uuid,p_animais uuid[],p_dados jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_fazenda uuid; v_animal uuid; v_total integer:=0;
begin
  select l.fazenda_id into v_fazenda from public.lotes l join public.fazendas f on f.id=l.fazenda_id
   where l.id=p_lote_id and l.sistema='corte' and f.proprietario_id=(select auth.uid());
  if v_fazenda is null or coalesce(array_length(p_animais,1),0)=0 or p_dados->>'produto' is null or p_dados->>'data_manejo' is null then raise exception 'Manejo inválido'; end if;
  if p_dados->>'tipo' not in ('vacina','medicamento','vermifugo','antiparasitario','vitamina','exame','diagnostico','procedimento','outro') then raise exception 'Tipo inválido'; end if;
  for v_animal in select distinct unnest(p_animais) loop
    if not exists(select 1 from public.animais a where a.id=v_animal and a.fazenda_id=v_fazenda and a.lote_id=p_lote_id and a.sistema='corte' and a.status='ativo') then raise exception 'Animal não pertence ao lote ou está inativo'; end if;
    insert into public.manejos(fazenda_id,lote_id,animal_id,tipo,produto,dose,data_manejo,proxima_data,responsavel,observacoes,dose_unidade,via_aplicacao,lote_produto,motivo,frequencia,duracao_dias,data_fim,carencia_dias,data_fim_carencia)
    values(v_fazenda,p_lote_id,v_animal,p_dados->>'tipo',p_dados->>'produto',nullif(p_dados->>'dose',''),(p_dados->>'data_manejo')::date,nullif(p_dados->>'proxima_data','')::date,nullif(p_dados->>'responsavel',''),nullif(p_dados->>'observacoes',''),nullif(p_dados->>'dose_unidade',''),nullif(p_dados->>'via_aplicacao',''),nullif(p_dados->>'lote_produto',''),nullif(p_dados->>'motivo',''),nullif(p_dados->>'frequencia',''),nullif(p_dados->>'duracao_dias','')::integer,nullif(p_dados->>'data_fim','')::date,nullif(p_dados->>'carencia_dias','')::integer,nullif(p_dados->>'data_fim_carencia','')::date);
    v_total:=v_total+1;
  end loop;
  return v_total;
end $$;

create function public.registrar_saida_corte(p_animal_id uuid,p_dados jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_animal public.animais%rowtype; v_id uuid; v_tipo text; v_data date; v_valor numeric; v_frete numeric; v_outras numeric; v_peso numeric; v_rendimento numeric;
begin
  select a.* into v_animal from public.animais a join public.fazendas f on f.id=a.fazenda_id
   where a.id=p_animal_id and a.sistema='corte' and a.status='ativo' and f.proprietario_id=(select auth.uid()) for update of a;
  if not found then raise exception 'Animal não encontrado ou já encerrado'; end if;
  v_tipo:=p_dados->>'tipo';v_data:=(p_dados->>'data_saida')::date;
  v_valor:=coalesce((p_dados->>'valor_venda')::numeric,0);v_frete:=coalesce((p_dados->>'frete')::numeric,0);v_outras:=coalesce((p_dados->>'outras_despesas')::numeric,0);
  v_peso:=nullif(p_dados->>'peso_final','')::numeric;
  v_rendimento:=nullif(p_dados->>'rendimento_carcaca','')::numeric;
  if v_tipo not in ('venda','abate','morte','transferencia','descarte') or v_data is null or v_valor<0 or v_frete<0 or v_outras<0 or (v_peso is not null and v_peso<=0) or (v_rendimento is not null and (v_rendimento<=0 or v_rendimento>100)) or (v_animal.data_entrada is not null and v_data<v_animal.data_entrada) then raise exception 'Dados de saída inválidos'; end if;
  if v_tipo='venda' and v_valor<=0 then raise exception 'Informe o valor da venda'; end if;
  insert into public.saidas_corte(fazenda_id,animal_id,lote_id,tipo,data_saida,peso_final,rendimento_carcaca,valor_venda,frete,outras_despesas,comprador_destino,observacoes)
   values(v_animal.fazenda_id,v_animal.id,v_animal.lote_id,v_tipo,v_data,v_peso,v_rendimento,v_valor,v_frete,v_outras,nullif(p_dados->>'comprador_destino',''),nullif(p_dados->>'observacoes','')) returning id into v_id;
  update public.animais set status=case v_tipo when 'venda' then 'vendido' when 'abate' then 'abatido' when 'morte' then 'morto' when 'transferencia' then 'transferido' else 'descartado' end,
   peso_atual=coalesce(v_peso,peso_atual) where id=v_animal.id and fazenda_id=v_animal.fazenda_id;
  if v_valor>0 then insert into public.transacoes(fazenda_id,lote_id,animal_id,tipo,categoria,descricao,valor,data_competencia,status,origem)
   values(v_animal.fazenda_id,v_animal.lote_id,v_animal.id,'receita','Venda de gado','Saída: '||v_animal.identificacao,v_valor,v_data,'pago','saida'); end if;
  if v_frete>0 then insert into public.transacoes(fazenda_id,lote_id,animal_id,tipo,categoria,descricao,valor,data_competencia,status,origem)
   values(v_animal.fazenda_id,v_animal.lote_id,v_animal.id,'despesa','Frete','Frete: '||v_animal.identificacao,v_frete,v_data,'pago','saida'); end if;
  if v_outras>0 then insert into public.transacoes(fazenda_id,lote_id,animal_id,tipo,categoria,descricao,valor,data_competencia,status,origem)
   values(v_animal.fazenda_id,v_animal.lote_id,v_animal.id,'despesa','Outras despesas','Saída: '||v_animal.identificacao,v_outras,v_data,'pago','saida'); end if;
  return v_id;
end $$;
revoke all on function public.registrar_pesagens_lote_corte(uuid,date,jsonb,text,text) from public,anon;
revoke all on function public.registrar_manejo_corte(uuid,uuid[],jsonb) from public,anon;
revoke all on function public.registrar_saida_corte(uuid,jsonb) from public,anon;
grant execute on function public.registrar_pesagens_lote_corte(uuid,date,jsonb,text,text),public.registrar_manejo_corte(uuid,uuid[],jsonb),public.registrar_saida_corte(uuid,jsonb) to authenticated;

-- Atualiza a conferência de exclusão para incluir os fechamentos.
create or replace function public.excluir_animal_confirmado(
  p_animal_id uuid, p_registros_esperados integer, p_confirmar_relacionados boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_fazenda uuid; v_registros integer;
begin
  select a.fazenda_id into v_fazenda from public.animais a
  join public.fazendas f on f.id=a.fazenda_id
  where a.id=p_animal_id and f.proprietario_id=(select auth.uid())
  for update of a;
  if v_fazenda is null then raise exception 'Animal não encontrado ou sem permissão'; end if;
  select
    (select count(*) from public.pesagens where animal_id=p_animal_id) +
    (select count(*) from public.manejos where animal_id=p_animal_id) +
    (select count(*) from public.transacoes where animal_id=p_animal_id) +
    (select count(*) from public.producao_leite where animal_id=p_animal_id) +
    (select count(*) from public.saidas_corte where animal_id=p_animal_id) +
    (select count(*) from public.documentos where animal_id=p_animal_id) +
    (select count(*) from public.animais where mae_id=p_animal_id or pai_id=p_animal_id or bezerro_id=p_animal_id)
  into v_registros;
  if p_registros_esperados is distinct from v_registros
     or (v_registros>0 and p_confirmar_relacionados is not true) then
    raise exception 'Registros vinculados mudaram; revise a confirmação';
  end if;
  delete from public.documentos where animal_id=p_animal_id and fazenda_id=v_fazenda;
  delete from public.transacoes where animal_id=p_animal_id and fazenda_id=v_fazenda;
  delete from public.producao_leite where animal_id=p_animal_id and fazenda_id=v_fazenda;
  delete from public.animais where id=p_animal_id and fazenda_id=v_fazenda;
  if not found then raise exception 'Não foi possível excluir o animal'; end if;
end $$;

create or replace function public.excluir_lote_confirmado(
  p_lote_id uuid, p_registros_esperados integer, p_confirmar_relacionados boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_fazenda uuid; v_registros integer;
begin
  select l.fazenda_id into v_fazenda from public.lotes l
  join public.fazendas f on f.id=l.fazenda_id
  where l.id=p_lote_id and f.proprietario_id=(select auth.uid())
  for update of l;
  if v_fazenda is null then raise exception 'Lote não encontrado ou sem permissão'; end if;
  if exists(select 1 from public.animais where lote_id=p_lote_id) then
    raise exception 'Remova ou mova os animais vinculados antes de excluir o lote';
  end if;
  select
    (select count(*) from public.pesagens where lote_id=p_lote_id) +
    (select count(*) from public.manejos where lote_id=p_lote_id) +
    (select count(*) from public.transacoes where lote_id=p_lote_id) +
    (select count(*) from public.documentos where lote_id=p_lote_id) +
    (select count(*) from public.saidas_corte where lote_id=p_lote_id) +
    (select count(*) from public.movimentacoes_estoque where lote_id=p_lote_id)
  into v_registros;
  if p_registros_esperados is distinct from v_registros
     or (v_registros>0 and p_confirmar_relacionados is not true) then
    raise exception 'Registros vinculados mudaram; revise a confirmação';
  end if;
  delete from public.documentos where lote_id=p_lote_id and fazenda_id=v_fazenda;
  delete from public.transacoes where lote_id=p_lote_id and fazenda_id=v_fazenda;
  update public.movimentacoes_estoque set lote_id=null where lote_id=p_lote_id and fazenda_id=v_fazenda;
  delete from public.lotes where id=p_lote_id and fazenda_id=v_fazenda;
  if not found then raise exception 'Não foi possível excluir o lote'; end if;
end $$;

revoke all on function public.excluir_animal_confirmado(uuid,integer,boolean) from public, anon;
revoke all on function public.excluir_lote_confirmado(uuid,integer,boolean) from public, anon;
grant execute on function public.excluir_animal_confirmado(uuid,integer,boolean) to authenticated;
grant execute on function public.excluir_lote_confirmado(uuid,integer,boolean) to authenticated;
