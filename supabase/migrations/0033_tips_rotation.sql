-- Rotacao automatica de dicas: quando ligada, a dica mostrada na Home troca sozinha a cada N
-- dias (mesma dica pra todo mundo naquele periodo), em vez de depender so do usuario dispensar
-- uma pra ver a proxima. Fica em app_settings (linha unica), mesmo lugar de aviso/manutencao.

alter table public.app_settings
  add column if not exists tips_rotate_enabled boolean not null default false,
  add column if not exists tips_rotate_days smallint not null default 3
    check (tips_rotate_days between 1 and 30);
