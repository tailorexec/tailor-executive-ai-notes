-- Nova origem de nota: 'image' (resumo de imagem lido pela IA de visao).
alter table public.notes drop constraint if exists notes_type_check;
alter table public.notes add constraint notes_type_check
  check (type in ('recording', 'upload', 'file', 'link', 'call', 'video', 'image'));
