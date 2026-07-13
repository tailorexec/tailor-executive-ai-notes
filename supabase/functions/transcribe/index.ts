// Edge Function: transcricao de audio.
//  - Padrao: Whisper large-v3 (Groq/OpenAI) - barato e rapido.
//  - Opcional (diarize=true): AssemblyAI com speaker_labels (identifica quem falou).
//    Requer secret ASSEMBLYAI_API_KEY. Sem a chave, faz fallback para Whisper.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { callerId, checkBudget, cors, guardResponse, logUsage } from '../_shared/guard.ts'

const PROVIDER = Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'groq'
const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY')

// Limites no SERVIDOR: o cliente ja valida, mas a edge function e chamavel direto.
const MAX_FILE_MB = 30
const MAX_AUDIO_SECONDS = 2 * 60 * 60 // 2 horas

// USD por SEGUNDO de audio (transcricao nao e cobrada por token).
const PRICE_PER_SEC: Record<string, number> = {
  groq: 0.111 / 3600, // whisper-large-v3
  openai: 0.006 / 60, // whisper-1
  assemblyai: 0.37 / 3600, // com speaker labels
}

async function whisperOnce(file: File): Promise<{ text: string; seconds: number }> {
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

/**
 * Achado investigando uma nota do usuario: um audio de 25min voltou com texto vazio (200 OK,
 * sem erro), e o MESMO arquivo, reenviado depois pelo mesmo codigo, transcreveu perfeitamente
 * (22 mil caracteres). Ou seja, o provedor as vezes devolve sucesso com texto vazio de forma
 * transitoria -- nao e o audio que esta ruim. Para audio com duracao real, isso quase certamente
 * NAO e silencio de verdade (quem chega aqui ja passou pelo filtro de audio silencioso no
 * cliente); tenta de novo antes de desistir.
 */
async function whisper(file: File): Promise<{ text: string; seconds: number }> {
  const MIN_SECONDS_TO_EXPECT_TEXT = 3
  const MAX_ATTEMPTS = 3
  let last: { text: string; seconds: number } | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await whisperOnce(file)
    last = result
    if (result.text.trim() || result.seconds < MIN_SECONDS_TO_EXPECT_TEXT) return result
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
  return last!
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
    const userId = await callerId(req)
    const guard = await checkBudget(userId)
    if (!guard.ok) return guardResponse(guard)

    const inForm = await req.formData()
    const file = inForm.get('file') as File
    if (!file) throw new Error('Arquivo de audio ausente.')
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: `Arquivo muito grande. Limite de ${MAX_FILE_MB} MB.` }),
        { status: 413, headers: { ...cors, 'content-type': 'application/json' } },
      )
    }
    const diarize = inForm.get('diarize') === 'true'

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

    if (result.seconds > MAX_AUDIO_SECONDS) {
      return new Response(
        JSON.stringify({ error: 'Audio acima do limite de 2 horas.' }),
        { status: 413, headers: { ...cors, 'content-type': 'application/json' } },
      )
    }

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
