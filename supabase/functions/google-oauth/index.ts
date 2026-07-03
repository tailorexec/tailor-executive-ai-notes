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
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json({ error: 'GOOGLE_CLIENT_ID/SECRET nao configurados no servidor.' }, 500)
    }
    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri) return json({ error: 'code e redirect_uri sao obrigatorios.' }, 400)

    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
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
