-- Dicas dinamicas na Home (antes so existia uma, fixa em codigo: Ctrl+Shift+G no Electron).
-- Admin cria/edita pelo /admin/dicas; qualquer usuario ve uma dica ativa por vez na Home e
-- pode dispensar -- a proxima aparece na visita seguinte (ao contrario da versao antiga, que
-- era "esconde para sempre" porque so existia uma dica no total).

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  active boolean not null default true,
  electron_only boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tips enable row level security;

drop policy if exists tips_select_active on public.tips;
create policy tips_select_active on public.tips
  for select using (active = true);

-- Admin ve tudo (inclusive inativas, pra poder reativar) e e o unico que escreve.
drop policy if exists tips_admin_all on public.tips;
create policy tips_admin_all on public.tips
  for all using (public.is_admin()) with check (public.is_admin());

-- Preserva o comportamento de hoje (a dica do atalho) como a primeira linha da tabela.
insert into public.tips (body, electron_only)
values ('Utilize o comando Ctrl+Shift+G para iniciar uma gravação rápida de reunião.', true)
on conflict do nothing;
