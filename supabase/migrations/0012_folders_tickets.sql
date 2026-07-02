-- Pastas (com cor) e canal de suporte (tickets).

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#941010',
  created_at timestamptz not null default now()
);
alter table public.folders enable row level security;
drop policy if exists folders_all on public.folders;
create policy folders_all on public.folders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notes add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists notes_folder_id_idx on public.notes(folder_id);

-- ===== Suporte / tickets =====
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('financeiro','tecnico','feedback','outros')),
  subject text not null default '',
  message text not null,
  status text not null default 'aberto' check (status in ('aberto','resolvido')),
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;

-- dono cria/le os proprios; admin le todos
drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert with check (user_id = auth.uid());
drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets for select
  using (user_id = auth.uid() or public.is_admin());
