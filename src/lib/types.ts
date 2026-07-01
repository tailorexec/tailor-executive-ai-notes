// Domain types shared across data layer, UI and mock.

export type UserRole = 'admin' | 'member'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: UserRole
  created_at: string
}

export type NoteSourceType = 'recording' | 'upload' | 'file' | 'link' | 'call'

export interface ActionItem {
  id: string
  text: string
  owner?: string
  due?: string
  done: boolean
}

/** Estruturada saida da "Analise de Reuniao". */
export interface MeetingAnalysis {
  overallScore?: number // 0-100
  tone: string
  strengths: string[]
  improvements: string[]
  questionsAsked: string[]
  suggestedQuestions: string[]
  pacing: string
  keyPoints: string[]
  risks: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  emoji?: string | null
  type: NoteSourceType
  folder: string | null
  duration_seconds: number
  audio_url: string | null
  language: string
  transcript: string
  summary: string
  detailed_summary: string | null
  analysis: MeetingAnalysis | null
  action_items: ActionItem[]
  chat: ChatMessage[]
  shared_with: string[] // profile ids
  status: 'processing' | 'ready' | 'error'
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type UsageEventType =
  | 'recording'
  | 'transcription'
  | 'ai_summary'
  | 'ai_detailed'
  | 'ai_analysis'
  | 'ai_chat'
  | 'ai_feedback'
  | 'tts'

export interface UsageEvent {
  id: string
  user_id: string
  note_id: string | null
  type: UsageEventType
  created_at: string
}

export type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'promo'

export interface AppSettings {
  announcement_enabled: boolean
  announcement_type: AnnouncementType
  announcement_message: string
  announcement_starts_at: string | null
  announcement_ends_at: string | null
  announcement_version: number
  maintenance_enabled: boolean
  maintenance_message: string
  maintenance_eta: string
}

/** Linha agregada usada no painel de administrador. */
export interface AdminUserRow {
  profile: Profile
  notesCount: number
  recordings: number
  transcriptions: number
  aiSuggestions: number
  ttsCount: number
  lastActivity: string | null
}
