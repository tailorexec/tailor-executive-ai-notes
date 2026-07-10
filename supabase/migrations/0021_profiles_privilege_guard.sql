-- CORRECAO DE SEGURANCA: escalacao de privilegio via profiles.
--
-- `profiles_update` permite ao usuario escrever QUALQUER coluna da propria linha, e
-- `is_admin()` decide pelo par (profiles.role, profiles.email). Logo, qualquer usuario
-- autenticado podia virar administrador com um unico UPDATE:
--     update profiles set role = 'admin' where id = auth.uid();
--     update profiles set email = 'flavio.junior@tailorexec.com.br' where id = auth.uid();
-- e passar a ler as notas de todo mundo (notes_select tem `or is_admin()`), o api_usage,
-- e a editar app_settings.
--
-- Politicas de RLS nao conseguem comparar OLD com NEW, entao a guarda e um trigger.

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  real_email text;
begin
  -- Sem usuario (service role, cron, edge functions) ou ja administrador: passa direto.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- A identidade real vem de auth.users, nunca do que o cliente mandou.
  select u.email into real_email from auth.users u where u.id = new.id;

  if tg_op = 'INSERT' then
    new.id := auth.uid();
    new.email := coalesce(real_email, new.email);
    new.role := 'member';
  else
    -- Colunas de identidade e privilegio nao mudam por vontade do usuario.
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Rebaixa qualquer admin que nao seja o administrador legitimo (nenhum hoje, mas o
-- estado precisa ficar coerente com a regra).
update public.profiles
set role = 'member'
where role = 'admin'
  and lower(email) <> 'flavio.junior@tailorexec.com.br';
