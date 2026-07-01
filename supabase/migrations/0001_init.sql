-- Tailor Executive AI Notes - schema inicial
-- Rode via Supabase SQL editor ou `supabase db push`.

-- ============ Tabelas ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  email      text not null unique,
  phone      text not null default '',
  role       text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nova nota',
  emoji text,
  type text not null default 'recording' check (type in ('recording','upload','file','link','call')),
  folder text,
  duration_seconds integer not null default 0,
  audio_url text,
  language text not null default 'pt-BR',
  transcript text not null default '',
  summary text not null default '',
  detailed_summary text,
  analysis jsonb,
  action_items jsonb not null default '[]'::jsonb,
  chat jsonb not null default '[]'::jsonb,
  shared_with uuid[] not null default '{}',
  status text not null default 'processing' check (status in ('processing','ready','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id);
create index if not exists notes_shared_idx on public.notes using gin (shared_with);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  type text not null check (type in
    ('recording','transcription','ai_summary','ai_detailed','ai_analysis','ai_chat','tts')),
  created_at timestamptz not null default now()
);
create index if not exists usage_user_idx on public.usage_events(user_id);

-- ============ Helpers ============

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or lower(p.email) = 'flavio.junior@tailorexec.com.br')
  );
$$;

-- Restringe cadastro ao dominio corporativo (executa antes de criar o usuario).
create or replace function public.enforce_email_domain()
returns trigger language plpgsql security definer as $$
begin
  if lower(split_part(new.email, '@', 2)) <> 'tailorexec.com.br' then
    raise exception 'Apenas e-mails @tailorexec.com.br podem se cadastrar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_domain on auth.users;
create trigger trg_enforce_domain
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- Cria o profile automaticamente a partir dos metadados do signUp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    case when lower(new.email) = 'flavio.junior@tailorexec.com.br' then 'admin'
         else coalesce(new.raw_user_meta_data->>'role', 'member') end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_notes_touch on public.notes;
create trigger trg_notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.usage_events enable row level security;

-- profiles: cada um le/edita o seu; admin le todos; todos leem lista basica p/ compartilhar
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (true);  -- perfis sao visiveis para permitir compartilhamento entre parceiros

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

-- notes: dono ou compartilhado le; dono escreve; admin le tudo
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes for select
  using (user_id = auth.uid() or auth.uid() = any(shared_with) or public.is_admin());

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes for insert
  with check (user_id = auth.uid());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes for delete
  using (user_id = auth.uid());

-- usage: cada um insere/le o seu; admin le tudo
drop policy if exists usage_insert on public.usage_events;
create policy usage_insert on public.usage_events for insert
  with check (user_id = auth.uid());

drop policy if exists usage_select on public.usage_events;
create policy usage_select on public.usage_events for select
  using (user_id = auth.uid() or public.is_admin());

-- ============ Storage (audios) ============
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

drop policy if exists recordings_rw on storage.objects;
create policy recordings_rw on storage.objects for all
  using (bucket_id = 'recordings' and owner = auth.uid())
  with check (bucket_id = 'recordings' and owner = auth.uid());

-- ============ Backfill (usuarios criados ANTES desta migration) ============
-- Cria o profile para quem ja existe em auth.users e nao tem profile.
insert into public.profiles (id, first_name, last_name, email, phone, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'first_name', ''),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  u.email,
  coalesce(u.raw_user_meta_data->>'phone', ''),
  case when lower(u.email) = 'flavio.junior@tailorexec.com.br' then 'admin' else 'member' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Garante que o admin oficial seja administrador (mesmo que ja tivesse profile).
update public.profiles set role = 'admin'
where lower(email) = 'flavio.junior@tailorexec.com.br';
