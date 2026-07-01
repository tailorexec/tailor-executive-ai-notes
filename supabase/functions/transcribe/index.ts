// Edge Function: transcricao de audio (Whisper large-v3 via Groq ou OpenAI).
// Guarda as chaves no servidor. Deploy: `supabase functions deploy transcribe`.
//
// Configure os secrets:
//   TRANSCRIPTION_PROVIDER = groq | openai
//   GROQ_API_KEY   (se groq)  -> modelo whisper-large-v3 (barato/rapido, otimo PT)
//   OPENAI_API_KEY (se openai)-> modelo whisper-1

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const PROVIDER = Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'groq'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const inForm = await req.formData()
    const file = inForm.get('file') as File
    if (!file) throw new Error('Arquivo de audio ausente.')

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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) throw new Error(`${PROVIDER} ${res.status}: ${await res.text()}`)
    const data = await res.json()

    return new Response(JSON.stringify({ transcript: data.text ?? '', language: 'pt-BR' }), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
