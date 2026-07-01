-- Configuracoes globais do app (avisos + manutencao), lixeira e novo tipo de uso.

-- ===== app_settings (linha unica) =====
create table if not exists public.app_settings (
  id boolean primary key default true,
  announcement_enabled boolean not null default false,
  announcement_type text not null default 'info'
    check (announcement_type in ('info','warning','maintenance','promo')),
  announcement_message text not null default '',
  announcement_starts_at timestamptz,
  announcement_ends_at timestamptz,
  announcement_version bigint not null default 0,
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Estamos em manutencao. Voltamos em breve.',
  maintenance_eta text not null default '',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select using (true);

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- ===== Lixeira: soft-delete de notas =====
alter table public.notes add column if not exists deleted_at timestamptz;
create index if not exists notes_deleted_idx on public.notes(deleted_at);

-- ===== Novo tipo de evento de uso: feedback =====
alter table public.usage_events drop constraint if exists usage_events_type_check;
alter table public.usage_events add constraint usage_events_type_check
  check (type in ('recording','transcription','ai_summary','ai_detailed','ai_analysis','ai_chat','tts','ai_feedback'));
