-- Monitoramento de consumo das APIs pagas (Anthropic, Groq, AssemblyAI).
-- Escrito pelas edge functions com a service role; lido SO pelo administrador.

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  -- set null: o historico de custo sobrevive a exclusao da conta.
  user_id uuid references auth.users (id) on delete set null,
  provider text not null check (provider in ('anthropic', 'groq', 'assemblyai', 'openai')),
  model text not null,
  task text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- Transcricao e cobrada por duracao de audio, nao por token.
  audio_seconds integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_created_idx on public.api_usage (created_at desc);
create index if not exists api_usage_user_idx on public.api_usage (user_id, created_at desc);
create index if not exists api_usage_provider_idx on public.api_usage (provider, created_at desc);

alter table public.api_usage enable row level security;

-- Sem policy de insert/update/delete: so a service role (que ignora RLS) escreve.
drop policy if exists api_usage_admin_select on public.api_usage;
create policy api_usage_admin_select on public.api_usage
  for select using (public.is_admin());
