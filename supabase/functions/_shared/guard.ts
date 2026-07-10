// Freio de gasto compartilhado pelas edge functions que chamam APIs pagas.
// Ordem das checagens: kill switch -> teto global do mes -> cota diaria do usuario -> rate limit.
//
// A contabilidade (api_usage) e escrita DEPOIS da chamada, entao o guard sempre olha o
// consumo ja registrado. Um usuario pode estourar a cota na ultima chamada; o excedente
// e limitado ao custo de uma unica chamada, e a proxima ja e barrada.

// @ts-nocheck  (ambiente Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** O JWT ja foi verificado pelo gateway; aqui so lemos o `sub` para atribuir o custo. */
export function callerId(req: Request): string | null {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).sub ?? null
  } catch {
    return null
  }
}

/** Nunca deixa a contabilidade derrubar a resposta ao usuario. */
export async function logUsage(row: Record<string, unknown>) {
  try {
    const admin = adminClient()
    if (!admin) return
    await admin.from('api_usage').insert(row)
  } catch (_) {
    /* silencioso de proposito */
  }
}

export interface GuardResult {
  ok: boolean
  status?: number
  error?: string
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

export const guardResponse = (g: GuardResult) => json({ error: g.error }, g.status ?? 429)

/**
 * Roda os freios antes de gastar dinheiro. Se o banco falhar, DEIXA PASSAR:
 * derrubar o app inteiro por causa do medidor seria pior que uma chamada a mais.
 */
export async function checkBudget(userId: string | null): Promise<GuardResult> {
  if (!userId) return { ok: false, status: 401, error: 'Sessao invalida. Entre novamente.' }

  const admin = adminClient()
  if (!admin) return { ok: true }

  let g: Record<string, number | boolean>
  try {
    const { data, error } = await admin.rpc('usage_guard', { p_user: userId })
    if (error || !data) return { ok: true }
    g = data as Record<string, number | boolean>
  } catch (_) {
    return { ok: true }
  }

  if (g.ai_enabled === false) {
    return { ok: false, status: 503, error: 'As funcoes de IA estao temporariamente desativadas pelo administrador.' }
  }

  if (Number(g.month_cost_global) >= Number(g.monthly_usd_global)) {
    return {
      ok: false,
      status: 503,
      error: 'O orcamento mensal de IA da empresa foi atingido. Fale com o administrador.',
    }
  }

  if (Number(g.day_cost_user) >= Number(g.daily_usd_per_user)) {
    return {
      ok: false,
      status: 429,
      error: 'Voce atingiu seu limite diario de uso da IA. Tente novamente amanha.',
    }
  }

  if (Number(g.calls_last_min) >= Number(g.rate_per_min)) {
    return {
      ok: false,
      status: 429,
      error: 'Muitas solicitacoes em pouco tempo. Espere um minuto e tente de novo.',
    }
  }

  return { ok: true }
}
