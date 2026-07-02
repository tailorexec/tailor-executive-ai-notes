import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import {
  connectCalendar,
  disconnectCalendar,
  isCalendarConnected,
  listUpcomingEvents,
  type CalEvent,
} from '../lib/googleCalendar'
import { fmtDate, fmtTime } from '../lib/format'
import { Spinner, Skeleton } from '../components/ui'

export function UpcomingEvents() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [needsAuth, setNeedsAuth] = useState(!isCalendarConnected())
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const r = await listUpcomingEvents()
      setNeedsAuth(r.needsAuth)
      setEvents(r.events)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isCalendarConnected()) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connect() {
    setLoading(true)
    try {
      const ok = await connectCalendar()
      if (ok) await refresh()
      else setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <CalendarDays size={18} className="text-brand-500" /> Proximos eventos
        </h3>
        {!needsAuth && (
          <button onClick={refresh} className="text-content-muted hover:text-content-primary" aria-label="Atualizar">
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>

      {needsAuth ? (
        <button className="btn-primary w-full" onClick={connect} disabled={loading}>
          {loading ? <Spinner /> : <CalendarDays size={18} />}
          Conectar Google Calendar
        </button>
      ) : loading && events.length === 0 ? (
        <ul className="space-y-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-1 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-2/3 mb-1.5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : events.length === 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-content-muted">Nenhum evento proximo.</p>
          <button className="text-xs text-brand-500" onClick={() => { disconnectCalendar(); setNeedsAuth(true) }}>
            Desconectar
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <div className="h-9 w-1 rounded-full bg-brand-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{e.title}</p>
                <p className="text-xs text-content-muted">
                  {e.start ? fmtDate(e.start) : ''}
                  {e.start && !e.allDay ? ` · ${fmtTime(e.start)}` : e.allDay ? ' · dia todo' : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
