-- Quem RECEBEU uma nota compartilhada nao tem como tira-la da propria lista hoje: a policy de
-- update de notes so deixa o DONO escrever (user_id = auth.uid()), entao nem o proprio usuario
-- em shared_with consegue se remover dali. O compartilhamento continua sendo leitura da MESMA
-- nota (sem copia) -- essa funcao so da ao destinatario o poder de sair da lista de quem ve,
-- sem tocar em mais nenhum campo da nota (titulo, transcricao, shared_with de outra pessoa etc).
--
-- security definer + search_path fixo (padrao ja usado em revoke_share_on_unfriend, 0025) --
-- roda com privilegio do dono da funcao, ignorando a RLS de update, mas o CORPO da funcao so
-- faz uma coisa bem estreita: tirar o proprio auth.uid() do array. Nao ha jeito de usar isto
-- pra editar/excluir a nota do outro usuario.
create or replace function public.leave_shared_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notes
  set shared_with = array_remove(shared_with, auth.uid())
  where id = p_note_id
    and auth.uid() = any(shared_with);
end;
$$;

grant execute on function public.leave_shared_note(uuid) to authenticated;
