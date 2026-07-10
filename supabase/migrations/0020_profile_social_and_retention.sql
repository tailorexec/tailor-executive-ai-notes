-- Perfil: redes sociais. E o novo padrao de auto-delete do audio: 3 dias.

alter table public.profiles
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- Guarda-corpo: instagram e um @handle, linkedin e uma URL ou handle.
alter table public.profiles drop constraint if exists profiles_instagram_len;
alter table public.profiles add constraint profiles_instagram_len
  check (instagram is null or char_length(instagram) <= 40);

alter table public.profiles drop constraint if exists profiles_linkedin_len;
alter table public.profiles add constraint profiles_linkedin_len
  check (linkedin is null or char_length(linkedin) <= 200);

-- Novo padrao para contas novas.
alter table public.profiles
  alter column audio_retention_days set default 3;

-- Contas existentes que nunca mexeram na opcao (14 = antigo padrao) passam para 3 dias.
-- Verificado antes de aplicar: nenhuma nota tem audio com mais de 3 dias, entao nada e perdido.
update public.profiles set audio_retention_days = 3 where audio_retention_days = 14;
