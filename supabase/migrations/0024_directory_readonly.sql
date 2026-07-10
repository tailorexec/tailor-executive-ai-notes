-- CORRECAO: a view `directory` estava GRAVAVEL por qualquer usuario autenticado.
--
-- O Supabase tem default privileges que concedem ALL em objetos novos do schema public
-- para `anon` e `authenticated`. O `grant select` da 0022 nao removeu esse ALL herdado.
-- Como a view e simples, o Postgres a torna auto-atualizavel, e com security_invoker = off
-- ela roda com os direitos do dono (postgres) -- ou seja, um UPDATE atraves da view
-- ignorava a RLS de `profiles` e permitia editar o perfil de OUTRA pessoa.
--
-- Detectado por teste: B conseguiu renomear A via `update directory ... where id = A`.

revoke all on public.directory from authenticated;
revoke all on public.directory from anon;
revoke all on public.directory from public;

grant select on public.directory to authenticated;
