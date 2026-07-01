-- Reuniao por tema e contexto: ajuda a IA a resumir/analisar no formato certo.
alter table public.notes add column if not exists template text not null default 'geral';
alter table public.notes add column if not exists context text not null default '';
