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
import { callerId } from '../_shared/guard.ts'

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

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Defesa em profundidade: o gateway ja exige JWT valido (funcao SEM --no-verify-jwt);
    // isto barra tambem um redeploy futuro que reintroduza a flag por engano.
    if (!(await callerId(req))) return json({ error: 'Sessao invalida. Entre novamente.' }, 401, cors)

    if (!CLIENT_SECRET) {
      return json({ error: 'GOOGLE_CLIENT_SECRET nao configurado no servidor.' }, 500, cors)
    }
    const { code, redirect_uri, client_id } = await req.json()
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
    return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, cors)
  } catch (err) {
    return json({ error: String(err) }, 500, cors)
  }
})
