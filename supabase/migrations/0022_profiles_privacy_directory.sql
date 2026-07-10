-- PRIVACIDADE, parte 1 de 2 (ADITIVA): cria o diretorio interno.
--
-- `profiles_select` e `using (true)`: qualquer usuario logado le TODAS as colunas de TODOS
-- os perfis -- inclusive telefone, Instagram, LinkedIn e role. Isso existe so porque o
-- compartilhamento de notas e a busca de amigos precisam de nome, e-mail e avatar.
--
-- Esta migration apenas ADICIONA a view. A tabela so e fechada na 0023, depois que o
-- frontend que consome a view estiver publicado -- assim nada quebra para quem esta com
-- o app aberto durante o deploy.

-- security_invoker = off (padrao, explicito aqui): a view roda com os direitos do dono
-- (postgres), entao continua enxergando todas as linhas de profiles depois que a RLS
-- ficar restritiva. A protecao passa a ser a LISTA DE COLUNAS + o grant para `authenticated`.
create or replace view public.directory
with (security_invoker = off) as
select
  id,
  first_name,
  last_name,
  email,
  avatar_url
from public.profiles;

comment on view public.directory is
  'Colunas publicas de profiles (nome, e-mail, avatar) para compartilhamento de notas e busca de amigos. NUNCA adicionar telefone, redes sociais ou role aqui.';

revoke all on public.directory from public;
revoke all on public.directory from anon;
grant select on public.directory to authenticated;
