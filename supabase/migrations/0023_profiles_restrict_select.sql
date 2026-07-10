-- PRIVACIDADE, parte 2 de 2 (RESTRITIVA): fecha a tabela profiles.
--
-- Aplicar SOMENTE depois que a versao do frontend que le `public.directory` estiver no ar.
-- A partir daqui, `profiles` devolve apenas a propria linha (o admin continua vendo tudo,
-- via is_admin(), que e SECURITY DEFINER e por isso nao recursa nesta policy).
--
-- Telefone, Instagram, LinkedIn e role deixam de vazar para os outros usuarios.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
