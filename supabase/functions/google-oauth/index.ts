// Edge Function: troca o "authorization code" do Google por um access_token.
// Mantem o CLIENT_SECRET no servidor (nunca no frontend).
// Deploy: `supabase functions deploy google-oauth`   <-- COM verificacao de JWT.
// Secrets: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`
//
// So usuarios autenticados no ANA podem chamar esta funcao (senao ela vira um oraculo de
// troca de token: qualquer um na internet poderia usar o CLIENT_SECRET do servidor para
// trocar um "code" que nao e dele). O redirect_uri tambem e validado contra as origens
// conhecidas do app -- sem isso, o Google so garante que o code foi emitido para ALGUM
// redirect_uri cadastrado no console do Google, nao para o nosso.

// @ts-nocheck  (ambiente Deno; tipos resolvidos no runtime do Supabase)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { adminClient, callerId, logAuditServer } from '../_shared/guard.ts'

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

/** Origens onde o ANA roda de verdade: os 3 aliases fixos de producao + previews do mesmo
 *  projeto Vercel + dev local. Conferido com `vercel inspect` em 2026-07-10. */
const ALLOWED_ORIGINS = [
  /^https:\/\/tailor-executive-ai-notes\.vercel\.app$/,
  /^https:\/\/tailor-executive-ai-notes-nectar-marketing-digital\.vercel\.app$/,
  /^https:\/\/tailor-executive-ai-notes-contato-1552-nectar-marketing-digital\.vercel\.app$/,
  /^https:\/\/tailor-executive-ai-notes-[a-z0-9]+-nectar-marketing-digital\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
]

function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin))
}

/** Reflete a origem da requisicao quando ela esta na lista; senao nao habilita CORS. */
function corsFor(req: Request) {
  const origin = req.headers.get('origin')
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(obj: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

/** Guarda (ou atualiza) o refresh_token do usuario -- nunca volta pro cliente. */
async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const admin = adminClient()
  if (!admin) return
  await admin
    .from('google_calendar_tokens')
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() })
}

/**
 * Renova o access_token em silencio usando o refresh_token guardado -- e o que evita o
 * usuario ter que passar pela tela do Google de novo toda vez que o token de 1h expira, ou ao
 * trocar de navegador/dispositivo (o refresh_token e por CONTA, nao por aparelho).
 */
async function handleRefresh(userId: string, cors: Record<string, string>): Promise<Response> {
  const admin = adminClient()
  if (!admin) return json({ error: 'Servidor indisponivel.' }, 503, cors)

  const { data: row } = await admin
    .from('google_calendar_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row?.refresh_token) return json({ error: 'not_connected' }, 401, cors)

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) {
    // Refresh_token revogado (ex.: usuario tirou o acesso direto no Google): limpa o registro
    // para nao tentar de novo em loop -- a proxima chamada volta a pedir reconexao normalmente.
    if (data.error === 'invalid_grant') {
      await admin.from('google_calendar_tokens').delete().eq('user_id', userId)
    }
    return json({ error: data.error_description || data.error || `Falha ${res.status} ao renovar.` }, 401, cors)
  }
  return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, cors)
}

/** Desconecta de verdade: revoga o refresh_token no Google (melhor esforco) e apaga o registro. */
async function handleDisconnect(userId: string, cors: Record<string, string>): Promise<Response> {
  const admin = adminClient()
  if (admin) {
    const { data: row } = await admin
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
    if (row?.refresh_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
        method: 'POST',
      }).catch(() => {})
    }
    await admin.from('google_calendar_tokens').delete().eq('user_id', userId)
  }
  return json({ ok: true }, 200, cors)
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let userId: string | null = null
  try {
    // Defesa em profundidade: o gateway ja exige JWT valido (funcao SEM --no-verify-jwt);
    // isto barra tambem um redeploy futuro que reintroduza a flag por engano.
    userId = await callerId(req)
    if (!userId) return json({ error: 'Sessao invalida. Entre novamente.' }, 401, cors)

    if (!CLIENT_SECRET) {
      return json({ error: 'GOOGLE_CLIENT_SECRET nao configurado no servidor.' }, 500, cors)
    }

    const reqBody = await req.json()
    if (reqBody.action === 'refresh') return await handleRefresh(userId, cors)
    if (reqBody.action === 'disconnect') return await handleDisconnect(userId, cors)

    const { code, redirect_uri, client_id } = reqBody
    // O client_id e publico; usamos o enviado pelo frontend (garante que bate com o
    // usado no pedido de autorizacao) e caimos no env como fallback.
    const cid = client_id || CLIENT_ID
    if (!code || !redirect_uri || !cid) return json({ error: 'code, redirect_uri e client_id sao obrigatorios.' }, 400, cors)

    let redirectOrigin: string
    try {
      redirectOrigin = new URL(redirect_uri).origin
    } catch {
      return json({ error: 'redirect_uri invalido.' }, 400, cors)
    }
    if (!isAllowedOrigin(redirectOrigin)) {
      return json({ error: 'redirect_uri nao permitido.' }, 400, cors)
    }

    const body = new URLSearchParams({
      code,
      client_id: cid,
      client_secret: CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (!res.ok) {
      return json({ error: data.error_description || data.error || `Falha ${res.status} na troca do code.` }, 400, cors)
    }
    // Google so manda refresh_token quando o consentimento e novo (por isso o prompt=consent
    // no pedido de autorizacao, no cliente): guarda para renovar sem reabrir a tela do Google.
    if (data.refresh_token) {
      try {
        await storeRefreshToken(userId, data.refresh_token)
      } catch (_) {
        /* nao bloqueia o connect atual por uma falha ao salvar -- so perde a renovacao futura */
      }
    }
    return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, cors)
  } catch (err) {
    await logAuditServer({
      severity: 'error',
      category: 'system',
      source: 'edge:google-oauth',
      message: String(err).slice(0, 500),
      user_id: userId,
    })
    return json({ error: String(err) }, 500, cors)
  }
})
