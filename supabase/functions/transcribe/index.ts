// Edge Function: transcricao de audio.
//  - Padrao: Whisper large-v3 (Groq/OpenAI) - barato e rapido.
//  - Opcional (diarize=true): AssemblyAI com speaker_labels (identifica quem falou).
//    Requer secret ASSEMBLYAI_API_KEY. Sem a chave, faz fallback para Whisper.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const PROVIDER = Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'groq'
const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function whisper(file: File): Promise<string> {
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
  form.append('response_format', 'json')
  const res = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form })
  if (!res.ok) throw new Error(`${PROVIDER} ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.text ?? ''
}

async function assemblyDiarize(file: File): Promise<string | null> {
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

    let transcript: string | null = null
    if (diarize) transcript = await assemblyDiarize(file)
    if (transcript === null) transcript = await whisper(file) // fallback ou modo padrao

    return new Response(JSON.stringify({ transcript, language: 'pt-BR' }), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
