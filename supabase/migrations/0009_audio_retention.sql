-- Retencao de audio: manter por padrao 14 dias; usuario pode marcar "manter para sempre".

alter table public.notes add column if not exists keep_audio boolean not null default false;
alter table public.notes add column if not exists audio_deleted_at timestamptz;

-- ===== Agendamento diario da limpeza (chama a edge function retention-cleanup) =====
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Guarda o segredo do cron no Vault (defina o valor no painel: Database > Vault, nome 'cron_secret').
-- O job envia esse segredo no header x-cron-secret; a function so executa se bater com CRON_SECRET.
do $$
begin
  -- remove agendamento anterior se existir
  perform cron.unschedule('audio-retention-daily')
  where exists (select 1 from cron.job where jobname = 'audio-retention-daily');
exception when others then null;
end $$;

select cron.schedule(
  'audio-retention-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://vceukqdqpkaytvkdijed.functions.supabase.co/retention-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);
