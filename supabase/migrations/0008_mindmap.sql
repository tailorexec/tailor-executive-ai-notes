-- Mapa mental da nota (gerado sob demanda).
alter table public.notes add column if not exists mindmap jsonb;
