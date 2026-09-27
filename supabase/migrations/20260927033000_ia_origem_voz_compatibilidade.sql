-- Aceita a origem de voz do novo registro sem invalidar dados de áudio e foto anteriores.
alter table public.registros_ia drop constraint if exists registros_ia_tipo_entrada_check;
alter table public.registros_ia add constraint registros_ia_tipo_entrada_check
 check (tipo_entrada in ('texto','audio','foto','voz'));
comment on column public.registros_ia.tipo_entrada is
 'Origem do registro: texto, voz, audio legado ou foto legada.';
