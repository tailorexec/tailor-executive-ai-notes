import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw, Clock, Link2Off } from 'lucide-react'
import {
  connectCalendar,
  disconnectCalendar,
  isCalendarConnected,
  listUpcomingEvents,
  type CalEvent,
} from '../lib/googleCalendar'
import { fmtDate, fmtTime } from '../lib/format'
import { Spinner, Skeleton } from '../components/ui'
import { useToast } from '../components/Toast'

/** Painel de agenda para a tela de Config: lista os proximos eventos em cards. */
export function CalendarSettings() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [needsAuth, setNeedsAuth] = useState(!isCalendarConnected())
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function refresh() {
    setLoading(true)
    try {
      const r = await listUpcomingEvents(10)
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
      if (ok) {
        await refresh()
        toast('Google Calendar conectado')
      } else {
        setLoading(false)
        toast('Conexao cancelada', 'info')
      }
    } catch {
      setLoading(false)
      toast('Nao foi possivel conectar', 'error')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs uppercase tracking-wide text-content-muted">Agenda</p>
        {!needsAuth && (
          <button
            onClick={() => {
              disconnectCalendar()
              setNeedsAuth(true)
              setEvents([])
              toast('Google Calendar desconectado', 'info')
            }}
            className="flex items-center gap-1 text-xs text-content-muted hover:text-brand-500"
          >
            <Link2Off size={12} /> Desconectar
          </button>
        )}
      </div>

      {needsAuth ? (
        <div className="card p-5 mb-6 text-center">
          <div className="grid place-items-center h-12 w-12 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto mb-3">
            <CalendarDays size={22} />
          </div>
          <p className="font-medium mb-1">Conecte seu Google Calendar</p>
          <p className="text-sm text-content-muted mb-4">
            Veja suas proximas reunioes aqui, em lista e cards.
          </p>
          <button className="btn-primary w-full" onClick={connect} disabled={loading}>
            {loading ? <Spinner /> : <CalendarDays size={18} />}
            Conectar Google Calendar
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-medium text-content-secondary">Proximos eventos</span>
            <button onClick={refresh} className="text-content-muted hover:text-content-primary" aria-label="Atualizar">
              {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
            </button>
          </div>

          {loading && events.length === 0 ? (
            <ul className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="card p-4 flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </li>
              ))}
            </ul>
          ) : events.length === 0 ? (
            <div className="card p-5 text-sm text-content-muted text-center">Nenhum evento proximo.</div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {events.map((e) => (
                <li key={e.id} className="card p-4 flex gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                    <CalendarDays size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{e.title}</p>
                    <p className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
                      <Clock size={12} />
                      {e.start ? fmtDate(e.start) : ''}
                      {e.start && !e.allDay ? ` · ${fmtTime(e.start)}` : e.allDay ? ' · dia todo' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
