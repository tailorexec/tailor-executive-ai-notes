-- "Mais funcoes": periodo de auto-delete por usuario, tarefas manuais, amigos e chat efemero.

-- ===== 1) Periodo de auto-delete do audio (3, 7 ou 14 dias), por usuario =====
-- Vale para o audio de notas com keep_audio = false. Transcricao e resumo permanecem.
alter table public.profiles
  add column if not exists audio_retention_days smallint not null default 14;

alter table public.profiles
  drop constraint if exists profiles_audio_retention_days_check;
alter table public.profiles
  add constraint profiles_audio_retention_days_check
  check (audio_retention_days in (3, 7, 14));

-- ===== 2) Tarefas avulsas (criadas a mao, fora de uma nota) =====
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 140),
  owner text check (owner is null or char_length(owner) <= 60),
  due date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks (user_id, done, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists tasks_owner on public.tasks;
create policy tasks_owner on public.tasks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== 3) Amizades =====
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- Um unico vinculo por par, independente de quem convidou.
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());

-- So da para convidar em nome proprio.
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert with check (requester_id = auth.uid());

-- Aceitar o convite e prerrogativa de quem recebeu.
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());

-- Recusar ou desfazer: qualquer um dos dois lados.
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ===== 4) Chat simples entre amigos (auto-deletado em 7 dias) =====
-- security definer: a policy de insert precisa ler friendships de um par que o
-- proprio RLS de friendships ja permitiria ler, mas sem depender da ordem das policies.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'message' check (kind in ('message', 'poke')),
  body text check (body is null or char_length(body) <= 50),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint friend_messages_not_self check (sender_id <> recipient_id),
  -- "cutucar" nao tem texto; mensagem tem.
  constraint friend_messages_body_required
    check (kind = 'poke' or (body is not null and char_length(btrim(body)) > 0))
);

create index if not exists friend_messages_pair_idx
  on public.friend_messages (sender_id, recipient_id, created_at desc);
create index if not exists friend_messages_recipient_idx
  on public.friend_messages (recipient_id, read_at);
create index if not exists friend_messages_created_idx
  on public.friend_messages (created_at);

alter table public.friend_messages enable row level security;

drop policy if exists friend_messages_select on public.friend_messages;
create policy friend_messages_select on public.friend_messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

-- So envia em nome proprio e so para quem ja e amigo aceito.
drop policy if exists friend_messages_insert on public.friend_messages;
create policy friend_messages_insert on public.friend_messages
  for insert with check (sender_id = auth.uid() and public.are_friends(auth.uid(), recipient_id));

-- Marcar como lido e do destinatario.
drop policy if exists friend_messages_update on public.friend_messages;
create policy friend_messages_update on public.friend_messages
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists friend_messages_delete on public.friend_messages;
create policy friend_messages_delete on public.friend_messages
  for delete using (sender_id = auth.uid() or recipient_id = auth.uid());
