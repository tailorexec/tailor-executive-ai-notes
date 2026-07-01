// Common data-layer contract implemented by both the mock (localStorage)
// backend and the Supabase backend.

import type { AdminUserRow, Note, Profile, UsageEvent, UsageEventType } from './types'

export interface SignUpInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
}

export interface Db {
  // --- auth ---
  getCurrentProfile(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  signUp(input: SignUpInput): Promise<Profile>
  signOut(): Promise<void>

  // --- profiles ---
  listProfiles(): Promise<Profile[]>

  // --- notes ---
  listNotes(userId: string): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  createNote(input: Partial<Note> & { user_id: string; title: string }): Promise<Note>
  updateNote(id: string, patch: Partial<Note>): Promise<Note>
  /** Soft-delete: manda para a lixeira. */
  deleteNote(id: string): Promise<void>
  listTrash(userId: string): Promise<Note[]>
  restoreNote(id: string): Promise<void>
  /** Remove definitivamente (o audio deve ser apagado pelo chamador). */
  deleteNotePermanent(id: string): Promise<void>

  // --- usage / admin ---
  logUsage(userId: string, type: UsageEventType, noteId?: string | null): Promise<void>
  listUsage(): Promise<UsageEvent[]>
  adminRows(): Promise<AdminUserRow[]>
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
