-- Evolução aditiva: nenhuma tabela ou dado preexistente é removido.
alter table public.animais add column if not exists prenhe boolean not null default false;
alter table public.animais add column if not exists data_cobertura date;
alter table public.animais add column if not exists touro_semen text;
alter table public.animais add column if not exists observacoes_reproducao text;
alter table public.animais add column if not exists situacao_cria text;
alter table public.animais add column if not exists data_desmame date;
alter table public.animais add column if not exists data_prevista_desmame date;
alter table public.animais add column if not exists data_ultima_pesagem date;
alter table public.animais add column if not exists pai_touro text;
update public.animais set prenhe=true
where sistema='leite' and lower(situacao_leite)='prenhe' and prenhe=false;

alter table public.animais add constraint animais_situacao_cria_check
  check (situacao_cria is null or situacao_cria in ('mamando','desmamada','vendida','transferida','morta','natimorta'));

create table public.partos_leite (
 id uuid primary key default gen_random_uuid(),
 fazenda_id uuid not null references public.fazendas(id),
 mae_id uuid not null references public.animais(id) on delete restrict,
 data_parto date not null,
 tipo_parto text check (tipo_parto is null or tipo_parto in ('normal','assistido','cesarea')),
 quantidade_crias integer not null check (quantidade_crias between 1 and 8),
 data_cobertura date,
 touro_semen text,
 observacoes text,
 criado_em timestamptz not null default now(),
 unique (id,fazenda_id)
);
create index partos_leite_mae_data_idx on public.partos_leite(mae_id,data_parto desc);
create index partos_leite_fazenda_idx on public.partos_leite(fazenda_id,data_parto desc);

create table public.crias_parto_leite (
 id uuid primary key default gen_random_uuid(),
 fazenda_id uuid not null,
 parto_id uuid not null,
 cria_id uuid references public.animais(id) on delete set null,
 identificacao text,
 nome text,
 sexo text check (sexo is null or sexo in ('macho','femea')),
 peso_nascer numeric check (peso_nascer is null or peso_nascer>0),
 situacao_ao_nascer text not null check (situacao_ao_nascer in ('viva','natimorta','morreu_depois')),
 criado_em timestamptz not null default now(),
 foreign key (parto_id,fazenda_id) references public.partos_leite(id,fazenda_id) on delete cascade
);
create unique index crias_parto_leite_cria_idx on public.crias_parto_leite(cria_id) where cria_id is not null;
create index crias_parto_leite_parto_idx on public.crias_parto_leite(parto_id);
create index crias_parto_leite_fazenda_idx on public.crias_parto_leite(fazenda_id);
create index animais_leite_prenhe_idx on public.animais(fazenda_id,proxima_previsao_parto) where sistema='leite' and prenhe=true;

alter table public.partos_leite enable row level security;
alter table public.crias_parto_leite enable row level security;
create policy partos_leite_acesso on public.partos_leite for all to authenticated
 using (private.usuario_tem_acesso_fazenda(fazenda_id))
 with check (private.usuario_tem_acesso_fazenda(fazenda_id));
create policy crias_parto_leite_acesso on public.crias_parto_leite for all to authenticated
 using (private.usuario_tem_acesso_fazenda(fazenda_id))
 with check (private.usuario_tem_acesso_fazenda(fazenda_id));
revoke all on public.partos_leite,public.crias_parto_leite from anon;
grant select,insert,update,delete on public.partos_leite,public.crias_parto_leite to authenticated;

-- Impede associação mãe/cria entre propriedades, inclusive por acesso direto à API.
create function public.validar_vinculos_leite() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.mae_id is not null and not exists(
   select 1 from public.animais m where m.id=new.mae_id and m.fazenda_id=new.fazenda_id and m.sistema='leite' and m.categoria is distinct from 'Cria leiteira'
 ) then raise exception 'Mãe inválida para esta fazenda'; end if;
 if new.situacao_cria is not null and (new.sistema<>'leite' or new.categoria is distinct from 'Cria leiteira')
   and new.situacao_cria<>'transferida' then raise exception 'Situação de cria incompatível'; end if;
 return new;
end $$;
create trigger validar_vinculos_leite before insert or update of mae_id,situacao_cria,sistema,categoria,fazenda_id on public.animais
 for each row execute function public.validar_vinculos_leite();

create function public.validar_parto_leite() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.animais a where a.id=new.mae_id and a.fazenda_id=new.fazenda_id and a.sistema='leite' and a.categoria is distinct from 'Cria leiteira')
 then raise exception 'Vaca do parto inválida'; end if;
 return new;
end $$;
create trigger validar_parto_leite before insert or update of mae_id,fazenda_id on public.partos_leite
 for each row execute function public.validar_parto_leite();

create function public.validar_cria_parto_leite() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.cria_id is not null and not exists(
   select 1 from public.animais a join public.partos_leite p on p.id=new.parto_id
   where a.id=new.cria_id and a.fazenda_id=new.fazenda_id and a.mae_id=p.mae_id
 ) then raise exception 'Cria de outra mãe ou fazenda'; end if;
 return new;
end $$;
create trigger validar_cria_parto_leite before insert or update of cria_id,parto_id,fazenda_id on public.crias_parto_leite
 for each row execute function public.validar_cria_parto_leite();

create function public.registrar_parto_leite(p_mae_id uuid,p_data date,p_tipo text,p_lactacao boolean,p_observacoes text,p_crias jsonb)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare v_mae public.animais%rowtype; v_parto uuid; v_cria jsonb; v_cria_id uuid; v_ident text; v_situacao text; v_sexo text; v_peso numeric; v_primeira uuid;
begin
 select * into v_mae from public.animais where id=p_mae_id and sistema='leite' and categoria is distinct from 'Cria leiteira' and status='ativo' for update;
 if not found or not private.usuario_tem_acesso_fazenda(v_mae.fazenda_id) then raise exception 'Vaca não encontrada'; end if;
 if p_data is null or p_data>current_date or p_data<coalesce(v_mae.data_nascimento,'1900-01-01'::date)
    then raise exception 'Data do parto inválida'; end if;
 if p_tipo is not null and p_tipo not in ('normal','assistido','cesarea') then raise exception 'Tipo de parto inválido'; end if;
 if jsonb_typeof(p_crias) is distinct from 'array' or jsonb_array_length(p_crias) not between 1 and 8 then raise exception 'Informe de 1 a 8 crias'; end if;
 insert into public.partos_leite(fazenda_id,mae_id,data_parto,tipo_parto,quantidade_crias,data_cobertura,touro_semen,observacoes)
 values(v_mae.fazenda_id,p_mae_id,p_data,p_tipo,jsonb_array_length(p_crias),v_mae.data_cobertura,v_mae.touro_semen,nullif(trim(p_observacoes),'')) returning id into v_parto;
 for v_cria in select value from jsonb_array_elements(p_crias) loop
   v_ident=nullif(trim(v_cria->>'identificacao'),''); v_situacao=v_cria->>'situacao'; v_sexo=nullif(v_cria->>'sexo','');
   if v_situacao not in ('viva','natimorta','morreu_depois') or v_sexo is not null and v_sexo not in ('macho','femea')
     or length(coalesce(v_ident,''))>80 or length(coalesce(v_cria->>'nome',''))>120 then raise exception 'Dados da cria inválidos'; end if;
   if nullif(v_cria->>'peso_nascer','') is not null then
     v_peso=(v_cria->>'peso_nascer')::numeric;
     if v_peso<=0 then raise exception 'Peso ao nascer inválido'; end if;
   else v_peso=null; end if;
   v_cria_id=null;
   if v_situacao='viva' and v_ident is null then raise exception 'Informe o brinco da cria viva'; end if;
   if v_ident is not null then
     insert into public.animais(fazenda_id,identificacao,nome,sistema,categoria,sexo,raca,data_nascimento,data_entrada,peso_entrada,peso_atual,status,situacao_cria,mae_id,pai_touro,observacoes)
     values(v_mae.fazenda_id,v_ident,nullif(trim(v_cria->>'nome'),''),'leite','Cria leiteira',v_sexo,nullif(trim(v_cria->>'raca'),''),p_data,p_data,v_peso,v_peso,
       case when v_situacao='viva' then 'ativo' else 'morto' end,case when v_situacao='viva' then 'mamando' else case when v_situacao='natimorta' then 'natimorta' else 'morta' end end,p_mae_id,coalesce(nullif(trim(v_cria->>'pai_touro'),''),v_mae.touro_semen),nullif(trim(v_cria->>'observacoes'),'')) returning id into v_cria_id;
     if v_primeira is null and v_situacao='viva' then v_primeira=v_cria_id; end if;
   end if;
   insert into public.crias_parto_leite(fazenda_id,parto_id,cria_id,identificacao,nome,sexo,peso_nascer,situacao_ao_nascer)
   values(v_mae.fazenda_id,v_parto,v_cria_id,v_ident,nullif(trim(v_cria->>'nome'),''),v_sexo,v_peso,v_situacao);
 end loop;
 if p_data>=coalesce(v_mae.data_ultimo_parto,'1900-01-01'::date) then
   update public.animais set data_ultimo_parto=p_data,
     prenhe=case when v_mae.prenhe and (v_mae.data_cobertura is null or p_data<v_mae.data_cobertura) then true else false end,
     proxima_previsao_parto=case when v_mae.prenhe and (v_mae.data_cobertura is null or p_data<v_mae.data_cobertura) then v_mae.proxima_previsao_parto else null end,
     data_cobertura=case when v_mae.prenhe and (v_mae.data_cobertura is null or p_data<v_mae.data_cobertura) then v_mae.data_cobertura else null end,
     touro_semen=case when v_mae.prenhe and (v_mae.data_cobertura is null or p_data<v_mae.data_cobertura) then v_mae.touro_semen else null end,
     situacao_leite=case when v_mae.prenhe and (v_mae.data_cobertura is null or p_data<v_mae.data_cobertura) then situacao_leite when p_lactacao then 'Em lactação' when situacao_leite='Prenhe' then 'Seca' else situacao_leite end,
     bezerro_id=coalesce(v_primeira,bezerro_id) where id=p_mae_id;
 end if;
 return v_parto;
end $$;
revoke all on function public.registrar_parto_leite(uuid,date,text,boolean,text,jsonb) from public,anon;
grant execute on function public.registrar_parto_leite(uuid,date,text,boolean,text,jsonb) to authenticated;

create function public.registrar_peso_cria_leite(p_cria_id uuid,p_data date,p_peso numeric)
 returns void language plpgsql security invoker set search_path='' as $$
declare v_cria public.animais%rowtype;
begin
 select * into v_cria from public.animais where id=p_cria_id and sistema='leite' and categoria='Cria leiteira' and status='ativo' for update;
 if not found or not private.usuario_tem_acesso_fazenda(v_cria.fazenda_id) then raise exception 'Cria não encontrada'; end if;
 if p_data is null or p_data>current_date or p_data<coalesce(v_cria.data_nascimento,'1900-01-01'::date)
   or p_peso is null or p_peso<=0 then raise exception 'Pesagem inválida'; end if;
 if exists(select 1 from public.pesagens where animal_id=p_cria_id and data_pesagem>=p_data) then
   raise exception 'Registre apenas pesos posteriores à última pesagem'; end if;
 insert into public.pesagens(fazenda_id,animal_id,data_pesagem,peso_kg)
 values(v_cria.fazenda_id,p_cria_id,p_data,p_peso);
 update public.animais set peso_atual=p_peso,data_ultima_pesagem=p_data where id=p_cria_id;
end $$;
revoke all on function public.registrar_peso_cria_leite(uuid,date,numeric) from public,anon;
grant execute on function public.registrar_peso_cria_leite(uuid,date,numeric) to authenticated;
