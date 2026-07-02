// AI service facade. In mock mode uses the offline generators; in real mode
// invokes Supabase Edge Functions (which hold the API keys server-side).
//
// Model routing (real mode, handled inside the edge function):
//   - summary        -> claude-haiku-4-5   (rapido/barato)
//   - detailed       -> claude-sonnet-5    (resumo detalhado inteligente)
//   - analysis       -> claude-sonnet-5    (analise de reuniao)
//   - chat           -> claude-haiku-4-5
//   - transcription  -> Whisper large-v3 (provedor configurado)

import { config } from './config'
import { supabase } from './supabase'
import {
  mockAnalysis,
  mockActionItems,
  mockChatReply,
  mockDetailed,
  mockFeedback,
  mockSummary,
  mockTranscript,
  mockDiarizedTranscript,
  mockAskAll,
  mockMindMap,
} from './aiMock'
import type { ActionItem, MeetingAnalysis, MindMap } from './types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw error
  return data as T
}

export async function transcribeAudio(
  audio: Blob,
  opts: { diarize?: boolean } = {},
): Promise<{ transcript: string; language: string }> {
  if (config.mockMode) {
    await delay(opts.diarize ? 1800 : 1200)
    return { transcript: opts.diarize ? mockDiarizedTranscript() : mockTranscript(), language: 'pt-BR' }
  }
  const form = new FormData()
  // Usa o nome/extensao real do arquivo (ex.: video.mp4) para o provedor detectar o formato.
  const filename = (audio as File).name || 'audio.webm'
  form.append('file', audio, filename)
  if (opts.diarize) form.append('diarize', 'true')
  // Edge function reads multipart and forwards to the transcription provider.
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.functions.invoke('transcribe', { body: form })
  if (error) throw error
  return data as { transcript: string; language: string }
}

export interface AiMeta {
  template?: string
  context?: string
}

export async function generateSummary(transcript: string, meta: AiMeta = {}): Promise<string> {
  if (config.mockMode) {
    await delay(700)
    return mockSummary(transcript)
  }
  const r = await invoke<{ summary: string }>('ai', { task: 'summary', transcript, ...meta })
  return r.summary
}

export async function generateDetailed(transcript: string, meta: AiMeta = {}): Promise<string> {
  if (config.mockMode) {
    await delay(1200)
    return mockDetailed(transcript)
  }
  const r = await invoke<{ detailed: string }>('ai', { task: 'detailed', transcript, ...meta })
  return r.detailed
}

export async function generateActionItems(transcript: string, meta: AiMeta = {}): Promise<ActionItem[]> {
  if (config.mockMode) {
    await delay(500)
    return mockActionItems(transcript)
  }
  const r = await invoke<{ actionItems: ActionItem[] }>('ai', { task: 'action_items', transcript, ...meta })
  return r.actionItems
}

export async function generateAnalysis(transcript: string, meta: AiMeta = {}): Promise<MeetingAnalysis> {
  if (config.mockMode) {
    await delay(1400)
    return mockAnalysis(transcript)
  }
  const r = await invoke<{ analysis: MeetingAnalysis }>('ai', { task: 'analysis', transcript, ...meta })
  return r.analysis
}

export async function translateText(text: string, target: string): Promise<string> {
  if (config.mockMode) {
    await delay(700)
    return `[${target}]\n${text}`
  }
  const r = await invoke<{ text: string }>('ai', { task: 'translate', text, target })
  return r.text
}

export async function generateMindMap(transcript: string, meta: AiMeta = {}): Promise<MindMap> {
  if (config.mockMode) {
    await delay(900)
    return mockMindMap(transcript)
  }
  const r = await invoke<{ mindmap: MindMap }>('ai', { task: 'mindmap', transcript, ...meta })
  return r.mindmap
}

export async function generateFeedback(
  transcript: string,
  audience: 'cliente' | 'candidato',
): Promise<string> {
  if (config.mockMode) {
    await delay(1000)
    return mockFeedback(transcript, audience)
  }
  const r = await invoke<{ feedback: string }>('ai', { task: 'feedback', transcript, audience })
  return r.feedback
}

export interface NoteDigest {
  title: string
  created_at: string
  summary: string
}

/** Busca semantica: pergunta em linguagem natural sobre TODAS as notas. */
export async function askAllNotes(question: string, notes: NoteDigest[]): Promise<string> {
  if (config.mockMode) {
    await delay(800)
    return mockAskAll(question, notes)
  }
  const digest = notes
    .slice(0, 80)
    .map((n) => ({ title: n.title, date: n.created_at, summary: n.summary }))
  const r = await invoke<{ answer: string }>('ai', { task: 'search', question, notes: digest })
  return r.answer
}

export async function chatWithNote(
  question: string,
  transcript: string,
  history: { role: string; content: string }[],
): Promise<string> {
  if (config.mockMode) {
    await delay(600)
    return mockChatReply(question, transcript)
  }
  const r = await invoke<{ reply: string }>('ai', { task: 'chat', question, transcript, history })
  return r.reply
}
