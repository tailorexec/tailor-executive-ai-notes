-- Bug: notas compartilhadas apareciam sem o audio gravado. A tabela `notes` ja libera leitura
-- para quem esta em `shared_with` (0001_init.sql, linha ~131), mas o BUCKET de audio
-- ("recordings") so tinha a policy `recordings_rw`, restrita a `owner = auth.uid()` -- ou seja,
-- so quem gravou podia gerar a signed URL do proprio audio. Compartilhar a nota nunca liberou
-- o arquivo de audio associado.
--
-- Esta policy adiciona SOMENTE leitura (select) para quem esta em `notes.shared_with` da nota
-- dona do arquivo. O caminho do arquivo e "{user_id}/{note_id}.webm" (ver saveAudio em
-- src/lib/audioStore.ts), entao o note_id vem do proprio nome do objeto.
-- `recordings_rw` (for all) continua valendo: escrita/insercao/exclusao seguem so do dono.

drop policy if exists recordings_shared_select on storage.objects;
create policy recordings_shared_select on storage.objects
  for select using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.notes n
      where n.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and auth.uid() = any(n.shared_with)
    )
  );
