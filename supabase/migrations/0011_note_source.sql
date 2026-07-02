-- Origem da nota (celular/computador) e novo tipo 'video'.
alter table public.notes add column if not exists device text; -- 'mobile' | 'desktop' | null
alter table public.notes drop constraint if exists notes_type_check;
alter table public.notes add constraint notes_type_check
  check (type in ('recording','upload','file','link','call','video'));
