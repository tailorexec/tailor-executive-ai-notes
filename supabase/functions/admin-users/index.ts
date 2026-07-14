// Edge Function: administracao de usuarios (somente admin).
// Usa a service role (injetada pelo Supabase) para editar/excluir usuarios de auth.
// Deploy: supabase functions deploy admin-users

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAuditServer } from '../_shared/guard.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ADMIN_EMAIL = 'flavio.junior@tailorexec.com.br'
const ALLOWED_DOMAIN = 'tailorexec.com.br'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let callerId: string | null = null
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, service, { auth: { persistSession: false } })

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'Nao autenticado.' }, 401)

    const { data: userData } = await admin.auth.getUser(jwt)
    const caller = userData?.user
    if (!caller) return json({ error: 'Nao autenticado.' }, 401)
    callerId = caller.id

    const { data: prof } = await admin.from('profiles').select('role,email').eq('id', caller.id).single()
    const isAdmin = prof?.role === 'admin' || (prof?.email ?? '').toLowerCase() === ADMIN_EMAIL
    if (!isAdmin) return json({ error: 'Acesso restrito ao administrador.' }, 403)

    const body = await req.json()
    const action = body.action as string
    const id = body.id as string
    if (!id) return json({ error: 'Usuario invalido.' }, 400)

    if (action === 'delete') {
      if (id === caller.id) return json({ error: 'Voce nao pode excluir a propria conta.' }, 400)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'update') {
      const first_name = String(body.first_name ?? '').trim()
      const last_name = String(body.last_name ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (email && email.split('@')[1] !== ALLOWED_DOMAIN) {
        return json({ error: `E-mail deve ser @${ALLOWED_DOMAIN}.` }, 400)
      }
      if (email) {
        const { error: e1 } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
        if (e1) return json({ error: e1.message }, 400)
      }
      const { error: e2 } = await admin.from('profiles').update({ first_name, last_name, email }).eq('id', id)
      if (e2) return json({ error: e2.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acao invalida.' }, 400)
  } catch (err) {
    await logAuditServer({
      severity: 'error',
      category: 'system',
      source: 'edge:admin-users',
      message: String(err).slice(0, 500),
      user_id: callerId,
    })
    return json({ error: String(err) }, 500)
  }
})
