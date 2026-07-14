-- Guarda o refresh_token do Google Calendar por usuario, para nao pedir reconexao toda vez que
-- o access_token expira (~1h, hoje sem refresh_token nenhum) ou quando o usuario troca de
-- navegador/dispositivo. O refresh_token da acesso de LONGO PRAZO a agenda do usuario -- por
-- isso a tabela nao tem NENHUMA policy: nem o proprio dono le ou escreve direto, so a service
-- role (via edge function google-oauth) acessa.

create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;
-- Sem policies de proposito: acesso so pela service role (RLS nao se aplica a ela).
