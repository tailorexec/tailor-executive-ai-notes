-- Controle de gasto com as APIs pagas: cota por usuario, teto global, rate limit e alerta.

-- ===== 1) Limites configuraveis (linha unica de app_settings) =====
alter table public.app_settings
  add column if not exists ai_enabled boolean not null default true,
  add column if not exists ai_daily_usd_per_user numeric(10, 2) not null default 2.00,
  add column if not exists ai_monthly_usd_global numeric(10, 2) not null default 300.00,
  add column if not exists ai_rate_per_min integer not null default 20,
  add column if not exists ai_daily_alert_usd numeric(10, 2) not null default 10.00;

-- ===== 2) Tokens de cache (o prompt caching cobra diferente de entrada normal) =====
alter table public.api_usage
  add column if not exists cache_write_tokens integer not null default 0,
  add column if not exists cache_read_tokens integer not null default 0;

-- ===== 3) Guarda de consumo: uma unica ida ao banco por chamada de IA =====
-- Devolve o gasto do dia do usuario, o gasto global do mes, as chamadas no ultimo
-- minuto e os limites vigentes. So a service role executa (o gasto global e do admin).
create or replace function public.usage_guard(p_user uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'day_cost_user', coalesce((
      select sum(cost_usd) from api_usage
      where user_id = p_user and created_at >= date_trunc('day', now())
    ), 0),
    'month_cost_global', coalesce((
      select sum(cost_usd) from api_usage
      where created_at >= date_trunc('month', now())
    ), 0),
    'calls_last_min', (
      select count(*) from api_usage
      where user_id = p_user and created_at >= now() - interval '1 minute'
    ),
    'ai_enabled', s.ai_enabled,
    'daily_usd_per_user', s.ai_daily_usd_per_user,
    'monthly_usd_global', s.ai_monthly_usd_global,
    'rate_per_min', s.ai_rate_per_min
  )
  from app_settings s
  limit 1;
$$;

revoke all on function public.usage_guard(uuid) from public, anon, authenticated;
grant execute on function public.usage_guard(uuid) to service_role;

-- ===== 4) Alertas de orcamento (gravados pelo cron, lidos pelo admin) =====
create table if not exists public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  spend_usd numeric(12, 6) not null,
  threshold_usd numeric(10, 2) not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.budget_alerts enable row level security;

drop policy if exists budget_alerts_admin_select on public.budget_alerts;
create policy budget_alerts_admin_select on public.budget_alerts
  for select using (public.is_admin());

drop policy if exists budget_alerts_admin_update on public.budget_alerts;
create policy budget_alerts_admin_update on public.budget_alerts
  for update using (public.is_admin()) with check (public.is_admin());

-- Insert so pela service role (cron). Sem policy de insert/delete.

-- ===== 5) Agendamento diario do alerta =====
do $$
begin
  perform cron.unschedule('budget-check-daily')
  where exists (select 1 from cron.job where jobname = 'budget-check-daily');
exception when others then null;
end $$;

select cron.schedule(
  'budget-check-daily',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://vceukqdqpkaytvkdijed.functions.supabase.co/budget-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);
