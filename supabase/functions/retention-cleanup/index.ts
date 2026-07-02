// Edge Function: limpeza de audio por retencao (executada diariamente pelo pg_cron).
// Remove o audio de notas com keep_audio=false e mais de N dias, mantendo a transcricao.
// Protegida por header x-cron-secret == CRON_SECRET. Deploy com --no-verify-jwt.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RETENTION_DAYS = 14
const BUCKET = 'recordings'

Deno.serve(async (req) => {
  // So aceita chamadas com o segredo correto.
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
  const { data: notes, error } = await admin
    .from('notes')
    .select('id, audio_url')
    .eq('keep_audio', false)
    .is('audio_deleted_at', null)
    .not('audio_url', 'is', null)
    .lt('created_at', cutoff)
    .limit(500)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let removed = 0
  for (const n of notes ?? []) {
    const path = n.audio_url as string
    if (!path || path.startsWith('idb:') || path.startsWith('http')) continue
    await admin.storage.from(BUCKET).remove([path])
    await admin.from('notes').update({ audio_url: null, audio_deleted_at: new Date().toISOString() }).eq('id', n.id)
    removed++
  }

  return new Response(JSON.stringify({ ok: true, removed }), {
    headers: { 'content-type': 'application/json' },
  })
})
