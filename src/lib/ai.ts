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
} from './aiMock'
import type { ActionItem, MeetingAnalysis } from './types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw error
  return data as T
}

export async function transcribeAudio(audio: Blob): Promise<{ transcript: string; language: string }> {
  if (config.mockMode) {
    await delay(1200)
    return { transcript: mockTranscript(), language: 'pt-BR' }
  }
  const form = new FormData()
  form.append('file', audio, 'audio.webm')
  // Edge function reads multipart and forwards to the transcription provider.
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.functions.invoke('transcribe', { body: form })
  if (error) throw error
  return data as { transcript: string; language: string }
}

export async function generateSummary(transcript: string): Promise<string> {
  if (config.mockMode) {
    await delay(700)
    return mockSummary(transcript)
  }
  const r = await invoke<{ summary: string }>('ai', { task: 'summary', transcript })
  return r.summary
}

export async function generateDetailed(transcript: string): Promise<string> {
  if (config.mockMode) {
    await delay(1200)
    return mockDetailed(transcript)
  }
  const r = await invoke<{ detailed: string }>('ai', { task: 'detailed', transcript })
  return r.detailed
}

export async function generateActionItems(transcript: string): Promise<ActionItem[]> {
  if (config.mockMode) {
    await delay(500)
    return mockActionItems(transcript)
  }
  const r = await invoke<{ actionItems: ActionItem[] }>('ai', { task: 'action_items', transcript })
  return r.actionItems
}

export async function generateAnalysis(transcript: string): Promise<MeetingAnalysis> {
  if (config.mockMode) {
    await delay(1400)
    return mockAnalysis(transcript)
  }
  const r = await invoke<{ analysis: MeetingAnalysis }>('ai', { task: 'analysis', transcript })
  return r.analysis
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
