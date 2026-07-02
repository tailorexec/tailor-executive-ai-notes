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

export async function connectCalendar(): Promise<boolean> {
  await loadGis()
  return new Promise((resolve) => {
    // @ts-expect-error GIS global
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId,
      scope: SCOPE,
      callback: (resp: { access_token?: string; expires_in?: number }) => {
        if (resp.access_token) {
          localStorage.setItem(
            STORE,
            JSON.stringify({
              token: resp.access_token,
              exp: Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3300000),
            }),
          )
          resolve(true)
        } else {
          resolve(false)
        }
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export async function listUpcomingEvents(
  max = 5,
): Promise<{ needsAuth: boolean; events: CalEvent[] }> {
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
      return { needsAuth: true, events: [] }
    }
    if (!res.ok) return { needsAuth: false, events: [] }
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
  } catch {
    return { needsAuth: false, events: [] }
  }
}
