-- Preferências aditivas por fazenda. Alertas são calculados em leitura; não criam nem alteram registros.
create table if not exists public.configuracoes_alertas (
  fazenda_id uuid primary key references public.fazendas(id) on delete cascade,
  dias_sem_pesagem integer not null default 30 check (dias_sem_pesagem between 1 and 365),
  antecedencia_vacina integer not null default 14 check (antecedencia_vacina between 1 and 90),
  antecedencia_parto integer not null default 21 check (antecedencia_parto between 1 and 90),
  idade_desmame integer not null default 90 check (idade_desmame between 15 and 365),
  estoque_minimo_padrao numeric not null default 0 check (estoque_minimo_padrao between 0 and 100000),
  dias_estoque integer not null default 7 check (dias_estoque between 1 and 90),
  queda_producao_pct numeric not null default 20 check (queda_producao_pct between 1 and 90),
  aumento_despesa_pct numeric not null default 30 check (aumento_despesa_pct between 1 and 500),
  gmd_minimo numeric not null default 0.5 check (gmd_minimo between 0 and 5),
  atualizado_em timestamptz not null default now()
);
alter table public.configuracoes_alertas enable row level security;
create policy configuracoes_alertas_ler on public.configuracoes_alertas for select to authenticated
  using (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy configuracoes_alertas_inserir on public.configuracoes_alertas for insert to authenticated
  with check (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy configuracoes_alertas_alterar on public.configuracoes_alertas for update to authenticated
  using (private.usuario_tem_acesso_fazenda(fazenda_id))
  with check (private.usuario_tem_acesso_fazenda(fazenda_id));
revoke all on public.configuracoes_alertas from anon;
grant select,insert,update on public.configuracoes_alertas to authenticated;
