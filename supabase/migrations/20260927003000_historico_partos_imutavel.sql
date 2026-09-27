-- O histórico registrado não pode ser apagado ou reescrito pela API do aplicativo.
drop policy if exists partos_leite_acesso on public.partos_leite;
drop policy if exists crias_parto_leite_acesso on public.crias_parto_leite;
create policy partos_leite_ler on public.partos_leite for select to authenticated
 using (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy partos_leite_registrar on public.partos_leite for insert to authenticated
 with check (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy crias_parto_leite_ler on public.crias_parto_leite for select to authenticated
 using (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy crias_parto_leite_registrar on public.crias_parto_leite for insert to authenticated
 with check (private.usuario_tem_acesso_fazenda(fazenda_id));
revoke update,delete on public.partos_leite,public.crias_parto_leite from authenticated;
