// Edge Function: troca o "authorization code" do Google por um access_token.
// Mantem o CLIENT_SECRET no servidor (nunca no frontend).
// Deploy: `supabase functions deploy google-oauth --no-verify-jwt`
// Secrets: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`

// @ts-nocheck  (ambiente Deno; tipos resolvidos no runtime do Supabase)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!CLIENT_SECRET) {
      return json({ error: 'GOOGLE_CLIENT_SECRET nao configurado no servidor.' }, 500)
    }
    const { code, redirect_uri, client_id } = await req.json()
    // O client_id e publico; usamos o enviado pelo frontend (garante que bate com o
    // usado no pedido de autorizacao) e caimos no env como fallback.
    const cid = client_id || CLIENT_ID
    if (!code || !redirect_uri || !cid) return json({ error: 'code, redirect_uri e client_id sao obrigatorios.' }, 400)

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
      return json({ error: data.error_description || data.error || `Falha ${res.status} na troca do code.` }, 400)
    }
    return json({ access_token: data.access_token, expires_in: data.expires_in })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
