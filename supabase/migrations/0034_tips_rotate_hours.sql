-- Rotacao de dicas passa a ser configuravel em HORAS (nao so em dias) -- pedido do usuario pra
-- poder trocar de hora em hora (1, 2, 3, 4...), nao so a cada N dias.

update public.app_settings set tips_rotate_days = tips_rotate_days * 24;

alter table public.app_settings rename column tips_rotate_days to tips_rotate_hours;

alter table public.app_settings drop constraint if exists app_settings_tips_rotate_days_check;
alter table public.app_settings add constraint app_settings_tips_rotate_hours_check
  check (tips_rotate_hours between 1 and 720);

alter table public.app_settings alter column tips_rotate_hours set default 72;
