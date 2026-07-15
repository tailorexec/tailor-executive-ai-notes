-- Gerente/Senior (admin-only por enquanto): um usuario (manager) convida outro (member); o
-- member aceita ou recusa; uma vez aceito, o manager passa a poder ver METRICAS agregadas do
-- member (nunca o conteudo das notas -- isto so cria o vinculo, nenhuma tabela aqui expoe
-- transcricao/resumo). Grupos deixam o manager organizar os membros por nome+cor.
--
-- team_groups antes de team_links por causa da FK (group_id).

create table if not exists public.team_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_links (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  group_id uuid references public.team_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint team_links_not_self check (manager_id <> member_id),
  unique (manager_id, member_id)
);

create index if not exists team_links_member_idx on public.team_links (member_id);
create index if not exists team_groups_owner_idx on public.team_groups (owner_id);

alter table public.team_groups enable row level security;
alter table public.team_links enable row level security;

-- So o dono do grupo mexe nele, e so se for admin (equipe/gerencia e admin-only por enquanto --
-- quando existirem gerentes de verdade, e so tirar o "and public.is_admin()" daqui).
drop policy if exists team_groups_all on public.team_groups;
create policy team_groups_all on public.team_groups
  for all using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

-- Os dois lados do vinculo enxergam a linha (pra o member saber quem o convidou).
drop policy if exists team_links_select on public.team_links;
create policy team_links_select on public.team_links
  for select using (manager_id = auth.uid() or member_id = auth.uid());

-- So admin cria convite, e so em nome de si mesmo.
drop policy if exists team_links_insert on public.team_links;
create policy team_links_insert on public.team_links
  for insert with check (manager_id = auth.uid() and public.is_admin());

-- Aceitar (pending -> accepted) e prerrogativa de quem recebeu.
drop policy if exists team_links_update on public.team_links;
create policy team_links_update on public.team_links
  for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Recusar/cancelar/sair: qualquer um dos dois lados.
drop policy if exists team_links_delete on public.team_links;
create policy team_links_delete on public.team_links
  for delete using (manager_id = auth.uid() or member_id = auth.uid());

-- Helper (mesmo padrao de are_friends, 0016) -- a futura tabela/view de KPIs vai reusar isto
-- pra decidir quem pode ler as metricas agregadas de quem.
create or replace function public.is_manager_of(manager uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_links t
    where t.status = 'accepted' and t.manager_id = manager and t.member_id = member
  );
$$;

revoke all on function public.is_manager_of(uuid, uuid) from public;
grant execute on function public.is_manager_of(uuid, uuid) to authenticated;

-- Nota: quando existir uma tabela/view de metricas de verdade, adicionar um trigger
-- "after delete on team_links" (mesmo molde de revoke_share_on_unfriend, 0025) pra
-- limpar o acesso do lado do manager. Ainda nao existe nada pra limpar.
