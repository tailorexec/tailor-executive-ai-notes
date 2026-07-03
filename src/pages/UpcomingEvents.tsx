import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw, Clock, Link2Off } from 'lucide-react'
import {
  startCalendarConnect,
  finishCalendarConnect,
  disconnectCalendar,
  isCalendarConnected,
  listUpcomingEvents,
  type CalEvent,
} from '../lib/googleCalendar'
import { fmtDate, fmtTime } from '../lib/format'
import { Spinner, Skeleton, Sheet } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'

export function UpcomingEvents() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [needsAuth, setNeedsAuth] = useState(!isCalendarConnected())
  const [loading, setLoading] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const t = useT()

  async function refresh() {
    setLoading(true)
    try {
      const r = await listUpcomingEvents(10)
      setNeedsAuth(r.needsAuth)
      setEvents(r.events)
      setError(r.error ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const returning = new URLSearchParams(window.location.search).has('code') ||
        new URLSearchParams(window.location.search).has('error')
      if (returning) setLoading(true)
      // Voltou do Google com ?code= : conclui a troca por token.
      const res = await finishCalendarConnect()
      if (returning) setLoading(false)
      if (res.done) {
        if (res.ok) {
          setNeedsAuth(false)
          setEventsOpen(true)
          toast('Google Calendar conectado')
          refresh()
        } else {
          setError(res.error ?? 'Não foi possível conectar.')
        }
        return
      }
      if (isCalendarConnected()) {
        setNeedsAuth(false)
        refresh()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function connect() {
    setError(null)
    setLoading(true)
    // Redireciona a pagina para o consentimento do Google (volta com o token no boot).
    const res = startCalendarConnect()
    if (!res.ok) {
      setError(res.error ?? 'Não foi possível conectar.')
      setLoading(false)
    }
  }

  function disconnect() {
    disconnectCalendar()
    setNeedsAuth(true)
    setEvents([])
    setEventsOpen(false)
    toast('Google Calendar desconectado', 'info')
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <CalendarDays size={18} className="text-brand-500" /> {t('events.title')}
        </h3>
        {!needsAuth && (
          <button onClick={refresh} className="text-content-muted hover:text-content-primary" aria-label="Atualizar">
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>

      {needsAuth ? (
        <>
          <button className="btn-primary w-full" onClick={connect} disabled={loading}>
            {loading ? <Spinner /> : <CalendarDays size={18} />}
            {t('events.connect')}
          </button>
          {error && (
            <p className="mt-2 text-xs text-brand-500 bg-brand-500/10 border border-brand-500/20 rounded-lg px-3 py-2 leading-snug">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          {loading && events.length === 0 ? (
            <ul className="space-y-2.5 mb-3">
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
            <p className="text-sm text-content-muted mb-3">{t('events.none')}</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {events.slice(0, 3).map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <div className="h-9 w-1 rounded-full bg-brand-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.title}</p>
                    <p className="text-xs text-content-muted">
                      {e.start ? fmtDate(e.start) : ''}
                      {e.start && !e.allDay ? ` · ${fmtTime(e.start)}` : e.allDay ? ` · ${t('events.allDay')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mb-3 text-xs text-brand-500 bg-brand-500/10 border border-brand-500/20 rounded-lg px-3 py-2 leading-snug">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" onClick={() => setEventsOpen(true)}>
            <CalendarDays size={18} /> {t('events.see')}
          </button>
        </>
      )}

      {eventsOpen && (
        <Sheet open={eventsOpen} onClose={() => setEventsOpen(false)} title={t('events.mine')}>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary"
            >
              {loading ? <Spinner size={14} /> : <RefreshCw size={14} />} {t('events.update')}
            </button>
            <button onClick={disconnect} className="flex items-center gap-1 text-xs text-content-muted hover:text-brand-500">
              <Link2Off size={12} /> {t('events.disconnect')}
            </button>
          </div>

          {loading && events.length === 0 ? (
            <div className="grid place-items-center py-8">
              <Spinner className="text-brand-500" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-content-muted text-center py-6">{t('events.none')}</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
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
                      {e.start && !e.allDay ? ` · ${fmtTime(e.start)}` : e.allDay ? ` · ${t('events.allDay')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  )
}
