// Integracao com Google Calendar (leitura) via Google Identity Services (GIS).
// Usa apenas o Client ID (publico). Sem secret no frontend.

import { config } from './config'

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
 * Fluxo de REDIRECIONAMENTO (implicit). Funciona no celular e no PWA, onde o
 * popup do GIS e bloqueado. Redireciona a pagina para o Google e, ao voltar,
 * o token vem no fragmento (#access_token=...) e e capturado no boot.
 * ------------------------------------------------------------------------- */
const STATE_KEY = 'tailor.gcal.state'
export const GCAL_FLASH = 'tailor.gcal.flash' // 'ok' apos conectar
export const GCAL_ERROR = 'tailor.gcal.error' // mensagem de erro apos voltar

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
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
    // Permite escolher/trocar a conta e reexibe o consentimento.
    prompt: 'select_account consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return { ok: true }
}

/**
 * Captura o token/erro do fragmento apos o redirect do Google. Chamar no boot
 * (antes do render). Limpa o hash da URL. Grava flags em sessionStorage para a UI.
 */
export function captureCalendarRedirect(): void {
  const hash = window.location.hash
  if (!hash || (hash.indexOf('access_token=') === -1 && hash.indexOf('error=') === -1)) return
  const p = new URLSearchParams(hash.slice(1))
  const token = p.get('access_token')
  const expiresIn = Number(p.get('expires_in') || '3300')
  const state = p.get('state')
  const err = p.get('error')
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(STATE_KEY)
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    /* ignore */
  }
  // Remove o token/erro da URL (nao deixa vazar no historico).
  history.replaceState(null, '', window.location.pathname + window.location.search)
  try {
    if (token && (!saved || state === saved)) {
      localStorage.setItem(STORE, JSON.stringify({ token, exp: Date.now() + expiresIn * 1000 }))
      sessionStorage.setItem(GCAL_FLASH, 'ok')
    } else if (err) {
      sessionStorage.setItem(
        GCAL_ERROR,
        err === 'access_denied' ? 'Permissão negada no Google.' : `Erro do Google: ${err}`,
      )
    } else if (token && saved && state !== saved) {
      sessionStorage.setItem(GCAL_ERROR, 'Falha de segurança (state) ao conectar. Tente de novo.')
    }
  } catch {
    /* ignore */
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
