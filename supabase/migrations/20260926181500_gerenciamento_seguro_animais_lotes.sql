-- Apenas o proprietário autenticado pode usar a exclusão transacional.
alter table public.animais drop constraint if exists animais_status_check;
alter table public.animais add constraint animais_status_check
  check (status in ('ativo','inativo','vendido','abatido','morto','transferido'));

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
