-- Auto-confirmacao de usuarios (uso interno).
-- Remove a dependencia do e-mail de confirmacao (SMTP padrao e limitado),
-- que estava impedindo o login. Cada novo usuario ja nasce confirmado.

create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm on auth.users;
create trigger trg_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Confirma imediatamente quem ja existe (ex.: a conta admin criada antes).
update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now());
