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

let scriptPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if ((window as unknown as { google?: unknown }).google) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar o Google.'))
    document.head.appendChild(s)
  })
  return scriptPromise
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

export interface ConnectResult {
  ok: boolean
  error?: string
}

function gisErrorMessage(err: { type?: string; message?: string } | undefined): string {
  const type = err?.type
  if (type === 'popup_failed_to_open')
    return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.'
  if (type === 'popup_closed') return 'A janela de login foi fechada antes de concluir.'
  return err?.message || type || 'Falha desconhecida ao autenticar.'
}

export async function connectCalendar(): Promise<ConnectResult> {
  if (!config.googleClientId) {
    return { ok: false, error: 'Client ID do Google não configurado (VITE_GOOGLE_CLIENT_ID).' }
  }
  await loadGis()
  return new Promise((resolve) => {
    let settled = false
    const done = (r: ConnectResult) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    try {
      // @ts-expect-error GIS global
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: SCOPE,
        callback: (resp: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => {
          if (resp.access_token) {
            localStorage.setItem(
              STORE,
              JSON.stringify({
                token: resp.access_token,
                exp: Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3300000),
              }),
            )
            done({ ok: true })
          } else {
            done({ ok: false, error: resp.error_description || resp.error || 'O Google não retornou um token de acesso.' })
          }
        },
        // Sem isso, fechar/cancelar o popup deixava a Promise pendente (carregando pra sempre).
        error_callback: (err: { type?: string; message?: string }) => done({ ok: false, error: gisErrorMessage(err) }),
      })
      client.requestAccessToken({ prompt: 'consent' })
    } catch (e) {
      done({ ok: false, error: String(e) })
    }
  })
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
