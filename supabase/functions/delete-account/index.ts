// Exclusao definitiva da propria conta (exigida pela Google Play e pela Apple).
// O usuario so pode excluir a SI MESMO: o id vem do JWT, nunca do body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAuditServer } from '../_shared/guard.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'nao autenticado' }, 401)

  // Identidade vem SOMENTE do token do proprio usuario.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'nao autenticado' }, 401)
  const userId = userData.user.id

  const admin = createClient(url, service)

  try {
    // 1) Apaga os audios do usuario no storage.
    const { data: files } = await admin.storage.from('recordings').list(userId, { limit: 1000 })
    if (files?.length) {
      await admin.storage.from('recordings').remove(files.map((f) => `${userId}/${f.name}`))
    }
    // 2) Apaga o avatar (se houver).
    const { data: avatars } = await admin.storage.from('avatars').list(userId, { limit: 100 })
    if (avatars?.length) {
      await admin.storage.from('avatars').remove(avatars.map((f) => `${userId}/${f.name}`))
    }

    // 3) Remove o usuario de shared_with das notas de terceiros.
    const { data: shared } = await admin.from('notes').select('id,shared_with').contains('shared_with', [userId])
    for (const n of shared ?? []) {
      const next = ((n as { shared_with: string[] }).shared_with ?? []).filter((id) => id !== userId)
      await admin.from('notes').update({ shared_with: next }).eq('id', (n as { id: string }).id)
    }

    // 4) Dados proprios. profiles tem ON DELETE CASCADE a partir de auth.users,
    //    e notes/folders/tickets/usage cascateiam de profiles. Ainda assim, apagamos
    //    explicitamente para nao depender da ordem das FKs.
    await admin.from('notes').delete().eq('user_id', userId)
    await admin.from('folders').delete().eq('user_id', userId)
    await admin.from('support_tickets').delete().eq('user_id', userId)
    await admin.from('usage_events').delete().eq('user_id', userId)
    await admin.from('profiles').delete().eq('id', userId)

    // 5) Por fim, a conta de autenticacao.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) throw delErr

    return json({ ok: true })
  } catch (e) {
    // Falha aqui pode deixar dados orfaos no meio de uma exclusao (storage/tabelas ja
    // parcialmente apagados) -- vale severidade alta, nao um erro comum de request.
    await logAuditServer({
      severity: 'critical',
      category: 'system',
      source: 'edge:delete-account',
      message: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      user_id: userId,
    })
    return json({ error: e instanceof Error ? e.message : 'falha ao excluir conta' }, 500)
  }
})
