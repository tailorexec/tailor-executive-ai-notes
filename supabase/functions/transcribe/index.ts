// Edge Function: transcricao de audio.
//  - Padrao: Whisper large-v3 (Groq/OpenAI) - barato e rapido.
//  - Opcional (diarize=true): AssemblyAI com speaker_labels (identifica quem falou).
//    Requer secret ASSEMBLYAI_API_KEY. Sem a chave, faz fallback para Whisper.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROVIDER = Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'groq'
const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY')

// USD por SEGUNDO de audio (transcricao nao e cobrada por token).
const PRICE_PER_SEC: Record<string, number> = {
  groq: 0.111 / 3600, // whisper-large-v3
  openai: 0.006 / 60, // whisper-1
  assemblyai: 0.37 / 3600, // com speaker labels
}

function callerId(req: Request): string | null {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).sub ?? null
  } catch {
    return null
  }
}

/** A contabilidade nunca pode derrubar a transcricao. */
async function logUsage(row: Record<string, unknown>) {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return
    const admin = createClient(url, key, { auth: { persistSession: false } })
    await admin.from('api_usage').insert(row)
  } catch (_) {
    /* silencioso de proposito */
  }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function whisper(file: File): Promise<{ text: string; seconds: number }> {
  const endpoint =
    PROVIDER === 'openai'
      ? 'https://api.openai.com/v1/audio/transcriptions'
      : 'https://api.groq.com/openai/v1/audio/transcriptions'
  const key = PROVIDER === 'openai' ? Deno.env.get('OPENAI_API_KEY') : Deno.env.get('GROQ_API_KEY')
  const model = PROVIDER === 'openai' ? 'whisper-1' : 'whisper-large-v3'
  const form = new FormData()
  form.append('file', file, file.name || 'audio.webm')
  form.append('model', model)
  form.append('language', 'pt')
  // verbose_json traz `duration` (segundos), que e como a transcricao e cobrada.
  form.append('response_format', 'verbose_json')
  const res = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form })
  if (!res.ok) throw new Error(`${PROVIDER} ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { text: data.text ?? '', seconds: Math.round(Number(data.duration) || 0) }
}

async function assemblyDiarize(file: File): Promise<{ text: string; seconds: number } | null> {
  if (!ASSEMBLYAI_API_KEY) return null
  // 1) upload
  const up = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: ASSEMBLYAI_API_KEY },
    body: await file.arrayBuffer(),
  })
  if (!up.ok) return null
  const { upload_url } = await up.json()

  // 2) solicita transcricao com identificacao de falantes
  const tr = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, speaker_labels: true, language_code: 'pt' }),
  })
  if (!tr.ok) return null
  const { id } = await tr.json()

  // 3) poll (limite de ~140s; audios muito longos podem exceder)
  const start = Date.now()
  while (Date.now() - start < 140000) {
    await new Promise((r) => setTimeout(r, 3000))
    const p = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
    })
    const data = await p.json()
    if (data.status === 'completed') {
      if (Array.isArray(data.utterances) && data.utterances.length) {
        return data.utterances.map((u: { speaker: string; text: string }) => `Falante ${u.speaker}: ${u.text}`).join('\n')
      }
      return data.text ?? ''
    }
    if (data.status === 'error') return null
  }
  return null // timeout -> fallback
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const inForm = await req.formData()
    const file = inForm.get('file') as File
    if (!file) throw new Error('Arquivo de audio ausente.')
    const diarize = inForm.get('diarize') === 'true'
    const userId = callerId(req)

    let result: { text: string; seconds: number } | null = null
    let provider = PROVIDER
    let model = PROVIDER === 'openai' ? 'whisper-1' : 'whisper-large-v3'

    if (diarize) {
      result = await assemblyDiarize(file)
      if (result) {
        provider = 'assemblyai'
        model = 'best+speaker_labels'
      }
    }
    if (result === null) result = await whisper(file) // fallback ou modo padrao

    await logUsage({
      user_id: userId,
      provider,
      model,
      task: 'transcription',
      audio_seconds: result.seconds,
      cost_usd: result.seconds * (PRICE_PER_SEC[provider] ?? 0),
    })

    return new Response(JSON.stringify({ transcript: result.text, language: 'pt-BR' }), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
