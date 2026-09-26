-- Corrige a resolução de colunas no predicado do registro de saída.
drop policy if exists saidas_corte_insercao on public.saidas_corte;
create policy saidas_corte_insercao on public.saidas_corte for insert to authenticated
 with check (private.usuario_tem_acesso_fazenda(fazenda_id) and exists (
   select 1 from public.animais a
   where a.id=saidas_corte.animal_id and a.fazenda_id=saidas_corte.fazenda_id
    and a.lote_id is not distinct from saidas_corte.lote_id
    and a.sistema='corte' and a.status='ativo'
 ));
