-- Compartilhar nota passa a criar uma COPIA para o destinatario (pedido do usuario em
-- 2026-09-01, mudando o modelo anterior "por referencia" de 0030/0027).
--
-- Motivo: no modelo por referencia, quem recebia so podia LER (RLS notes_update e so do
-- dono). A tela mostrava os botoes de gerar resumo detalhado/analise/chat, a IA rodava e
-- era COBRADA, e o salvamento estourava no RLS -- 5 erros identicos da Larissa Estrada no
-- /admin/audit vieram exatamente disso.
--
-- Modelo novo:
--   * O destinatario recebe uma copia PROPRIA (user_id dele) e edita/gera o que quiser.
--   * A copia leva tudo que o dono ja gerou/editou: titulo, transcricao, resumo, resumo
--     detalhado, analise, mapa mental, action items, template/contexto, prioridade.
--   * NAO leva: o arquivo de audio (so a transcricao dele), o chat com a IA (conversa
--     privada do dono), a pasta (pastas sao de cada usuario) e a lixeira/compartilhamentos.
--   * Proveniencia fica em shared_by (quem enviou) + shared_from_note_id (nota de origem,
--     usada para nao duplicar num reenvio).
--   * shared_with continua existindo so por compatibilidade e passa a viver VAZIO: um
--     trigger converte qualquer insercao ali (bundle antigo em cache de PWA) em copia.

-- ---------------------------------------------------------------------------
-- 1) Proveniencia da copia
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists shared_by uuid references public.profiles(id) on delete set null,
  add column if not exists shared_from_note_id uuid references public.notes(id) on delete set null;

create index if not exists notes_shared_from_idx
  on public.notes(shared_from_note_id) where shared_from_note_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Criacao da copia (nucleo, usado pelo RPC, pelo trigger e pelo backfill)
-- ---------------------------------------------------------------------------
-- security definer: quem compartilha precisa inserir uma nota cujo user_id e de OUTRA
-- pessoa, o que a RLS de insert (user_id = auth.uid()) proibe de proposito. O corpo so
-- sabe fazer uma coisa: clonar os campos de conteudo para o destinatario.
create or replace function public._create_shared_copy(src public.notes, p_recipient uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null or p_recipient = src.user_id then
    return 'skipped';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient) then
    return 'skipped';
  end if;

  -- Reenvio da mesma nota: se a pessoa ja tem uma copia viva, nao duplica (se ela jogou a
  -- copia na lixeira, um novo envio cria outra -- lixeira e caminho de exclusao).
  if exists (
    select 1 from public.notes
    where shared_from_note_id = src.id and user_id = p_recipient and deleted_at is null
  ) then
    return 'exists';
  end if;

  insert into public.notes (
    user_id, title, emoji, type, device, template, context,
    duration_seconds, language, transcript, summary, detailed_summary,
    analysis, mindmap, action_items, status, priority,
    shared_by, shared_from_note_id, created_at
  ) values (
    p_recipient, src.title, src.emoji, src.type, src.device, src.template, src.context,
    src.duration_seconds, src.language, src.transcript, src.summary, src.detailed_summary,
    src.analysis, src.mindmap, src.action_items, 'ready', src.priority,
    src.user_id, src.id, src.created_at
  );
  -- Fora do insert (ficam no default/null): audio_url, keep_audio, audio_deleted_at (audio
  -- nao e compartilhado), chat (conversa privada), folder/folder_id (pasta e por usuario),
  -- shared_with (sempre vazio), deleted_at. created_at preservado: e a data da reuniao.
  return 'sent';
end;
$$;

revoke all on function public._create_shared_copy(public.notes, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPC que a UI chama
-- ---------------------------------------------------------------------------
create or replace function public.share_note_copy(p_note_id uuid, p_recipient uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.notes;
begin
  select * into src
  from public.notes
  where id = p_note_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'Nota nao encontrada ou voce nao e o dono dela.';
  end if;

  -- Mesma regra da UI: so amigos com convite aceito recebem nota.
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = p_recipient)
        or (f.addressee_id = auth.uid() and f.requester_id = p_recipient))
  ) then
    raise exception 'Voces precisam ser parceiros (convite aceito) para compartilhar.';
  end if;

  return public._create_shared_copy(src, p_recipient);
end;
$$;

revoke all on function public.share_note_copy(uuid, uuid) from public, anon;
grant execute on function public.share_note_copy(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Compatibilidade com bundle antigo: shared_with vira copia e fica vazio
-- ---------------------------------------------------------------------------
-- O ShareSheet antigo grava `shared_with` direto via update. PWAs com cache podem rodar
-- esse codigo por um tempo depois do deploy; este trigger converte a intencao (compartilhar)
-- para o modelo novo e mantem o invariante shared_with = '{}'.
create or replace function public.share_with_to_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r uuid;
begin
  if new.shared_with is distinct from old.shared_with then
    foreach r in array new.shared_with loop
      if not (r = any(old.shared_with)) then
        perform public._create_shared_copy(new, r);
      end if;
    end loop;
    new.shared_with := '{}';
  end if;
  return new;
end;
$$;

revoke all on function public.share_with_to_copies() from public, anon, authenticated;

drop trigger if exists notes_share_to_copies on public.notes;
create trigger notes_share_to_copies
  before update on public.notes
  for each row
  execute function public.share_with_to_copies();

-- ---------------------------------------------------------------------------
-- 5) Migra os compartilhamentos por referencia que ja existem
-- ---------------------------------------------------------------------------
-- Cada destinatario atual ganha a copia dele agora (ex.: a nota da Aline compartilhada com
-- a Larissa). Nada e apagado: as notas dos donos ficam intactas, so o array esvazia.
do $$
declare
  n public.notes;
  r uuid;
begin
  for n in
    select * from public.notes
    where cardinality(shared_with) > 0 and deleted_at is null
  loop
    foreach r in array n.shared_with loop
      perform public._create_shared_copy(n, r);
    end loop;
  end loop;
end $$;

update public.notes set shared_with = '{}' where cardinality(shared_with) > 0;

-- ---------------------------------------------------------------------------
-- 6) Audio nunca mais e lido por terceiros: derruba a leitura compartilhada de 0027
-- ---------------------------------------------------------------------------
drop policy if exists recordings_shared_select on storage.objects;
