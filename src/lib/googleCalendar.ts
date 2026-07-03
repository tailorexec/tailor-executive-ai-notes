// Integracao com Google Calendar (leitura).
// Fluxo: authorization code por redirect. O client e "confidencial" (tem secret),
// entao o Google bloqueia o fluxo implicit; a troca do code por token e feita na
// Edge Function google-oauth (que guarda o CLIENT_SECRET no servidor).

import { config } from './config'
import { supabase } from './supabase'

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const STORE = 'tailor.gcal'

export interface CalEvent {
  id: string
  title: string
  start: string
  allDay: boolean
}


function storedToken(): string | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const { token, exp } = JSON.parse(raw)
    return Date.now() < exp ? token : null
  } catch {
    return null
  }
}

export function isCalendarConnected(): boolean {
  return !!storedToken()
}

export function disconnectCalendar(): void {
  localStorage.removeItem(STORE)
}

/* ---------------------------------------------------------------------------
 * Fluxo AUTHORIZATION CODE por redirect (funciona no celular e no PWA).
 * 1) startCalendarConnect() manda a pagina para o Google (response_type=code).
 * 2) Ao voltar, a URL tem ?code=... ; finishCalendarConnect() troca o code por
 *    um access_token via Edge Function e salva.
 * ------------------------------------------------------------------------- */
const STATE_KEY = 'tailor.gcal.state'

function redirectUri(): string {
  return window.location.origin + '/'
}

/** Inicia a conexao redirecionando a pagina para o consentimento do Google. */
export function startCalendarConnect(): { ok: boolean; error?: string } {
  if (!config.googleClientId) {
    return { ok: false, error: 'Client ID do Google não configurado (VITE_GOOGLE_CLIENT_ID).' }
  }
  const state = Math.random().toString(36).slice(2)
  try {
    sessionStorage.setItem(STATE_KEY, state)
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    include_granted_scopes: 'true',
    access_type: 'online',
    state,
    // Permite escolher/trocar a conta e reexibe o consentimento.
    prompt: 'select_account consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return { ok: true }
}

/**
 * Ao voltar do Google: se houver ?code=..., troca por token via Edge Function.
 * Retorna { done } indicando se havia um retorno OAuth para tratar.
 */
export async function finishCalendarConnect(): Promise<{ done: boolean; ok?: boolean; error?: string }> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const err = params.get('error')
  const state = params.get('state')
  if (!code && !err) return { done: false }

  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(STATE_KEY)
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    /* ignore */
  }
  // Limpa a URL (remove code/state/error).
  history.replaceState(null, '', window.location.pathname)

  if (err) {
    return { done: true, ok: false, error: err === 'access_denied' ? 'Permissão negada no Google.' : `Erro do Google: ${err}` }
  }
  if (saved && state !== saved) {
    return { done: true, ok: false, error: 'Falha de segurança (state) ao conectar. Tente de novo.' }
  }
  if (!supabase) {
    return { done: true, ok: false, error: 'Supabase não configurado para concluir a conexão.' }
  }
  try {
    const { data, error } = await supabase.functions.invoke('google-oauth', {
      body: { code, redirect_uri: redirectUri() },
    })
    if (error) return { done: true, ok: false, error: error.message || 'Falha ao trocar o código.' }
    const d = data as { access_token?: string; expires_in?: number; error?: string }
    if (d.access_token) {
      localStorage.setItem(
        STORE,
        JSON.stringify({ token: d.access_token, exp: Date.now() + (d.expires_in ? d.expires_in * 1000 : 3300000) }),
      )
      return { done: true, ok: true }
    }
    return { done: true, ok: false, error: d.error || 'O Google não retornou um token.' }
  } catch (e) {
    return { done: true, ok: false, error: String(e) }
  }
}

export async function listUpcomingEvents(
  max = 5,
): Promise<{ needsAuth: boolean; events: CalEvent[]; error?: string }> {
  const token = storedToken()
  if (!token) return { needsAuth: true, events: [] }
  const now = new Date().toISOString()
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(now)}&maxResults=${max}&singleEvents=true&orderBy=startTime`
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      disconnectCalendar()
      return { needsAuth: true, events: [], error: 'Sessão do Google expirada. Conecte novamente.' }
    }
    if (!res.ok) {
      const hint =
        res.status === 403
          ? ' Ative a "Google Calendar API" no Google Cloud e confirme o escopo de calendário.'
          : ''
      return { needsAuth: false, events: [], error: `Erro ${res.status} da Google Calendar API.${hint}` }
    }
    const data = await res.json()
    const events: CalEvent[] = (data.items ?? []).map((e: {
      id: string
      summary?: string
      start?: { dateTime?: string; date?: string }
    }) => ({
      id: e.id,
      title: e.summary || '(sem titulo)',
      start: e.start?.dateTime || e.start?.date || '',
      allDay: !e.start?.dateTime,
    }))
    return { needsAuth: false, events }
  } catch (e) {
    return { needsAuth: false, events: [], error: `Falha de rede ao buscar eventos: ${String(e)}` }
  }
}
