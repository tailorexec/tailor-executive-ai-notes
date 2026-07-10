// Edge Function: limpeza de audio por retencao (executada diariamente pelo pg_cron).
// Remove o audio de notas com keep_audio=false e mais de N dias, mantendo a transcricao.
// N vem do "Periodo de auto-delete" do usuario (profiles.audio_retention_days: 3, 7 ou 14).
// Tambem esvazia a lixeira e o chat efemero entre amigos.
// Protegida por header x-cron-secret == CRON_SECRET. Deploy com --no-verify-jwt.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_RETENTION_DAYS = 14 // para quem nunca mexeu na opcao
const RETENTION_CHOICES = [3, 7, 14]
const TRASH_DAYS = 7 // lixeira -> exclusao definitiva
const CHAT_DAYS = 7 // mensagens entre amigos
const BUCKET = 'recordings'

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

/** Audio local (idb:) ou externo (http) nao vive no nosso bucket. */
const isBucketPath = (p: string) => !!p && !p.startsWith('idb:') && !p.startsWith('http')

Deno.serve(async (req) => {
  // So aceita chamadas com o segredo correto.
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })

  // Agrupa os usuarios pelo periodo escolhido e apaga o audio de cada grupo no seu prazo.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, audio_retention_days')

  if (profErr) return new Response(JSON.stringify({ error: profErr.message }), { status: 500 })

  const byDays = new Map<number, string[]>()
  for (const p of profiles ?? []) {
    const d = RETENTION_CHOICES.includes(p.audio_retention_days)
      ? p.audio_retention_days
      : DEFAULT_RETENTION_DAYS
    byDays.set(d, [...(byDays.get(d) ?? []), p.id])
  }

  let removed = 0
  for (const [days, userIds] of byDays) {
    if (!userIds.length) continue
    const { data: notes, error } = await admin
      .from('notes')
      .select('id, audio_url')
      .in('user_id', userIds)
      .eq('keep_audio', false)
      .is('audio_deleted_at', null)
      .not('audio_url', 'is', null)
      .lt('created_at', daysAgo(days))
      .limit(500)

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

    for (const n of notes ?? []) {
      if (!isBucketPath(n.audio_url as string)) continue
      await admin.storage.from(BUCKET).remove([n.audio_url])
      await admin
        .from('notes')
        .update({ audio_url: null, audio_deleted_at: new Date().toISOString() })
        .eq('id', n.id)
      removed++
    }
  }

  // Lixeira: exclui DEFINITIVAMENTE notas na lixeira ha mais de TRASH_DAYS dias.
  const { data: trashed } = await admin
    .from('notes')
    .select('id, audio_url')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', daysAgo(TRASH_DAYS))
    .limit(500)

  let purged = 0
  for (const n of trashed ?? []) {
    if (isBucketPath(n.audio_url as string)) {
      await admin.storage.from(BUCKET).remove([n.audio_url])
    }
    await admin.from('notes').delete().eq('id', n.id)
    purged++
  }

  // Chat entre amigos: efemero, some depois de CHAT_DAYS dias (avisado na UI).
  const { count: chatPurged } = await admin
    .from('friend_messages')
    .delete({ count: 'exact' })
    .lt('created_at', daysAgo(CHAT_DAYS))

  return new Response(JSON.stringify({ ok: true, removed, purged, chatPurged: chatPurged ?? 0 }), {
    headers: { 'content-type': 'application/json' },
  })
})
