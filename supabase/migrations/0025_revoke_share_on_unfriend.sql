-- Ao desfazer uma amizade, remove o ex-amigo do compartilhamento das notas dos dois lados.
--
-- Sem isto, `notes.shared_with` continua com o ID do ex-amigo para sempre: `listNotes` da
-- leitura via `shared_with.cs.{userId}`, entao ele mante'm acesso a TODAS as notas antes
-- compartilhadas mesmo depois de removido como amigo (src/lib/friends.ts:removeFriendship
-- so apagava a amizade e o chat, nunca o array shared_with).
--
-- Isto NAO apaga nenhuma nota, transcricao ou audio -- so remove um ID de um array,
-- revogando a LEITURA. E' bidirecional: tanto o requester quanto o addressee podem ter
-- compartilhado notas com o outro, entao os dois lados sao limpos.
--
-- SECURITY DEFINER e' necessario porque a RLS de `notes` so deixa cada dono atualizar as
-- proprias notas; a amizade pode ser desfeita por qualquer um dos dois lados, mas as notas
-- que precisam ser limpas podem pertencer ao OUTRO lado.

create or replace function public.revoke_share_on_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notes
    set shared_with = array_remove(shared_with, old.requester_id)
    where user_id = old.addressee_id
      and old.requester_id = any(shared_with);

  update public.notes
    set shared_with = array_remove(shared_with, old.addressee_id)
    where user_id = old.requester_id
      and old.addressee_id = any(shared_with);

  return old;
end;
$$;

revoke all on function public.revoke_share_on_unfriend() from public;

drop trigger if exists friendships_revoke_share on public.friendships;
create trigger friendships_revoke_share
  after delete on public.friendships
  for each row
  execute function public.revoke_share_on_unfriend();
