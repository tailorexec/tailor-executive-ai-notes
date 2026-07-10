// Edge Function: alerta de orcamento (executada diariamente pelo pg_cron, 03:30).
// Soma o gasto de ONTEM em api_usage e, se passar do limiar de app_settings.ai_daily_alert_usd,
// grava uma linha em budget_alerts. O admin ve o aviso no painel e em /admin/api.
// Protegida por header x-cron-secret == CRON_SECRET. Deploy com --no-verify-jwt.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })

  // Janela de ontem, em UTC.
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end.getTime() - 86400000)
  const day = start.toISOString().slice(0, 10)

  const { data: settings } = await admin
    .from('app_settings')
    .select('ai_daily_alert_usd')
    .limit(1)
    .single()
  const threshold = Number(settings?.ai_daily_alert_usd ?? 10)

  const { data: rows, error } = await admin
    .from('api_usage')
    .select('cost_usd')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const spend = (rows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)
  if (spend < threshold) {
    return new Response(JSON.stringify({ ok: true, day, spend, threshold, alerted: false }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  // `day` e unique: rodar duas vezes no mesmo dia nao duplica o alerta.
  await admin
    .from('budget_alerts')
    .upsert({ day, spend_usd: spend, threshold_usd: threshold }, { onConflict: 'day' })

  return new Response(JSON.stringify({ ok: true, day, spend, threshold, alerted: true }), {
    headers: { 'content-type': 'application/json' },
  })
})
