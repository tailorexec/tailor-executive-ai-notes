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

/**
 * Confirma de verdade se o token e valido, perguntando ao proprio servidor de autenticacao
 * do Supabase (`auth.getUser`) — em vez de so ler o campo `sub` do token sem checar a
 * assinatura, como este codigo fazia antes.
 *
 * Isto e uma SEGUNDA trava (defesa em profundidade): o gateway do Supabase ja verifica o JWT
 * antes da requisicao chegar aqui, mas essa protecao depende de uma flag de deploy
 * (verify_jwt) que pode ser desligada por engano numa function futura — e ja aconteceu neste
 * projeto (o google-oauth rodava assim ate este mesmo commit). Sem esta segunda checagem,
 * desligar a flag deixaria qualquer um forjar um token com qualquer `sub` e se passar por
 * outro usuario, drenando o limite diario dele ou sujando a contabilidade de uso.
 *
 * Custo: uma chamada de rede ao servidor de autenticacao a cada requisicao. Irrelevante perto
 * do tempo que as proprias chamadas de IA/transcricao ja levam (segundos).
 */
export async function callerId(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const admin = adminClient()
  if (!admin) return null // sem service role nao da pra confirmar nada: trata como nao autenticado
  try {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return null
    return data.user.id
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

const AUDIT_DETAIL_MAX_CHARS = 4000

/** Corta o `detail` pra caber sem quebrar o JSON (nunca trunca a string bruta no meio de um objeto). */
function capDetail(detail?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!detail) return null
  try {
    const json = JSON.stringify(detail)
    if (json.length <= AUDIT_DETAIL_MAX_CHARS) return detail
    return { truncated: true, preview: json.slice(0, AUDIT_DETAIL_MAX_CHARS - 200) }
  } catch {
    return { truncated: true, preview: String(detail).slice(0, 500) }
  }
}

export interface AuditLogRow {
  severity: 'info' | 'warning' | 'error' | 'critical'
  category: 'system' | 'user' | 'silent' | 'security'
  source: string
  message: string
  detail?: Record<string, unknown> | null
  user_id?: string | null
  note_id?: string | null
  route?: string | null
  user_agent?: string | null
}

/**
 * So para uso SERVER-TO-SERVER (a propria edge function, que ja tem adminClient() aberto) --
 * grava direto no Postgres, sem round-trip HTTP. Chamada no catch de TODAS as edge functions,
 * entao um insert pendurado (rede lenta, Postgres ocupado) NAO PODE virar um request pendurado
 * em qualquer caminho de erro do app -- daí o timeout via Promise.race, diferente de logUsage
 * (que so grava uma vez, no caminho feliz). Nunca lanca: uma falha aqui nunca deve piorar o
 * erro original que estava sendo registrado.
 */
export async function logAuditServer(row: AuditLogRow): Promise<void> {
  try {
    const admin = adminClient()
    if (!admin) return
    const insert = admin.from('audit_log').insert({
      ...row,
      message: String(row.message ?? '').slice(0, 2000),
      detail: capDetail(row.detail),
    })
    await Promise.race([insert, new Promise((resolve) => setTimeout(resolve, 1500))])
  } catch (_) {
    /* nunca derruba quem chamou */
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

const BUDGET_UNAVAILABLE: GuardResult = {
  ok: false,
  status: 503,
  error: 'Nao foi possivel verificar o orcamento agora. Tente novamente em instantes.',
}

/**
 * O medidor de gasto quebrando e, por definicao, um erro que NINGUEM ve hoje (o usuario so
 * recebe "tente de novo"; nenhum admin sabe que a contabilidade parou de funcionar). Loga como
 * 'critical'/'silent' antes de devolver o sentinela, pra nao repetir a mesma logica 3x.
 */
async function budgetUnavailable(userId: string | null, reason: string): Promise<GuardResult> {
  await logAuditServer({
    severity: 'critical',
    category: 'silent',
    source: 'edge:guard.checkBudget',
    message: `Medidor de orcamento indisponivel: ${reason}`,
    user_id: userId,
  })
  return BUDGET_UNAVAILABLE
}

/**
 * Roda os freios antes de gastar dinheiro. Se o medidor falhar, BARRA a chamada (fail-closed):
 * a alternativa antiga (deixar passar) significa que uma falha do PROPRIO medidor vira gasto
 * sem teto e sem registro, sem nenhum aviso visivel ate a fatura chegar. Um erro ocasional
 * numa falha passageira e um preco aceitavel por nunca gastar as cegas.
 */
export async function checkBudget(userId: string | null): Promise<GuardResult> {
  if (!userId) return { ok: false, status: 401, error: 'Sessao invalida. Entre novamente.' }

  const admin = adminClient()
  if (!admin) return budgetUnavailable(userId, 'service role indisponivel')

  let g: Record<string, number | boolean>
  try {
    const { data, error } = await admin.rpc('usage_guard', { p_user: userId })
    if (error || !data) return budgetUnavailable(userId, error?.message ?? 'RPC usage_guard sem dados')
    g = data as Record<string, number | boolean>
  } catch (err) {
    return budgetUnavailable(userId, String(err))
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
