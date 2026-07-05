// Lembretes de eventos do Google Calendar enquanto o app esta aberto.
// (PWA sem push server-side: os lembretes disparam com o app aberto/em segundo plano.)

import { getNotifPrefs, notify } from './notifications'
import { isCalendarConnected, listUpcomingEvents } from './googleCalendar'
import { getLang } from './lang'

const REMIND_WINDOW_MIN = 15 // avisa quando faltar entre 0 e 15 min para o evento
const POLL_MS = 3 * 60 * 1000 // reconsulta a cada 3 min
const SEEN_KEY = 'tailor.gcal.reminded'

function getSeen(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function saveSeen(s: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-100)))
  } catch {
    /* ignore */
  }
}

function texts(title: string, mins: number): { t: string; b: string } {
  const l = getLang()
  if (l === 'en') return { t: 'Meeting soon', b: `${title} starts in ${mins} min` }
  if (l === 'es') return { t: 'Reunión pronto', b: `${title} empieza en ${mins} min` }
  return { t: 'Reunião em breve', b: `${title} começa em ${mins} min` }
}

/** Inicia o verificador de lembretes. Retorna funcao de limpeza. */
export function startCalendarReminders(): () => void {
  let stopped = false

  async function tick() {
    if (stopped) return
    try {
      if (!isCalendarConnected() || !getNotifPrefs().calendar) return
      const { events } = await listUpcomingEvents(10)
      const now = Date.now()
      const seen = getSeen()
      let changed = false
      for (const e of events) {
        if (!e.start || e.allDay) continue
        const start = Date.parse(e.start)
        if (Number.isNaN(start)) continue
        const mins = (start - now) / 60000
        const key = `${e.id}@${start}`
        if (mins > 0 && mins <= REMIND_WINDOW_MIN && !seen.has(key)) {
          const { t, b } = texts(e.title, Math.max(1, Math.round(mins)))
          notify(t, b)
          seen.add(key)
          changed = true
        }
      }
      if (changed) saveSeen(seen)
    } catch {
      /* ignore (falha de rede/quota nao deve quebrar o app) */
    }
  }

  tick()
  const id = window.setInterval(tick, POLL_MS)
  return () => {
    stopped = true
    window.clearInterval(id)
  }
}
