-- Tag de prioridade por nota (alta | media | baixa | null).
alter table public.notes add column if not exists priority text;
