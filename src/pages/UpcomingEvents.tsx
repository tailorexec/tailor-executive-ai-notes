import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, RefreshCw, Clock, Link2Off, Mic, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startCalendarConnect,
  finishCalendarConnect,
  disconnectCalendar,
  isCalendarConnected,
  listUpcomingEvents,
  type CalEvent,
  type CalError,
} from '../lib/googleCalendar'
import { fmtDate, fmtTime } from '../lib/format'
import { Spinner, Skeleton, Sheet } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'

const PAGE_SIZE = 10
/** No modo pagina buscamos varias paginas de uma vez e paginamos no cliente. */
const PAGE_MODE_MAX = 50

export function UpcomingEvents({ mode = 'card' }: { mode?: 'card' | 'page' }) {
  const isPage = mode === 'page'
  const [events, setEvents] = useState<CalEvent[]>([])
  const [needsAuth, setNeedsAuth] = useState(!isCalendarConnected())
  const [loading, setLoading] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [error, setError] = useState<CalError | null>(null)
  const [page, setPage] = useState(0)
  const toast = useToast()
  const t = useT()
  const navigate = useNavigate()

  function recordFromEvent(e: CalEvent) {
    const qs = new URLSearchParams({ mode: 'meeting', title: e.title, context: e.title })
    navigate(`/capturar?${qs.toString()}`)
  }

  async function refresh() {
    setLoading(true)
    try {
      const r = await listUpcomingEvents(isPage ? PAGE_MODE_MAX : 10)
      setNeedsAuth(r.needsAuth)
      setEvents(r.events)
      setError(r.error ?? null)
      setPage(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const returning = params.has('code') || params.has('error')
      if (returning) setLoading(true)
      const res = await finishCalendarConnect()
      if (returning) setLoading(false)
      if (res.done) {
        if (res.ok) {
          setNeedsAuth(false)
          // No desktop os eventos ja aparecem no card + botao "Ver meus eventos" — nao abre o popup.
          const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
          if (!isPage && !isDesktop) setEventsOpen(true)
          toast('Google Calendar conectado')
          refresh()
        } else {
          setError({ key: 'common.errorGeneric', detail: res.error })
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
    const res = startCalendarConnect()
    if (!res.ok) {
      setError({ key: 'common.errorGeneric', detail: res.error })
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

  const errorBlock = error ? (
    <ErrorNotice className="text-xs" message={t(error.key)} detail={error.detail} />
  ) : null

  function eventLine(e: CalEvent) {
    return (
      <>
        {e.start ? fmtDate(e.start) : ''}
        {e.start && !e.allDay ? ` · ${fmtTime(e.start)}` : e.allDay ? ` · ${t('events.allDay')}` : ''}
      </>
    )
  }

  /* ----------------------- Modo PAGINA (rota /agenda) ---------------------- */
  if (isPage) {
    const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
    const slice = events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

    if (needsAuth) {
      return (
        <div className="card p-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-accent/10 text-accent shrink-0">
              <CalendarDays size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-display font-semibold">{t('events.title')}</p>
              <p className="text-sm text-content-muted">{t('events.connectSub')}</p>
            </div>
          </div>
          <button className="btn-neutral w-full md:w-auto text-sm px-3.5 py-2" onClick={connect} disabled={loading}>
            {loading ? <Spinner /> : <CalendarDays size={18} className="text-accent" />}
            {t('events.connect')}
          </button>
          {errorBlock && <div className="mt-3">{errorBlock}</div>}
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary"
          >
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />} {t('events.update')}
          </button>
          <button onClick={disconnect} className="flex items-center gap-1 text-xs text-content-muted hover:text-accent">
            <Link2Off size={12} /> {t('events.disconnect')}
          </button>
        </div>

        {errorBlock && <div className="mb-3">{errorBlock}</div>}

        {loading && events.length === 0 ? (
          <div className="grid place-items-center py-12">
            <Spinner className="text-accent" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-content-muted text-center py-10">{t('events.none')}</p>
        ) : (
          <>
            <ul className="grid sm:grid-cols-2 gap-3 min-w-0">
              {slice.map((e) => (
                <li key={e.id} className="card p-4 min-w-0">
                  <div className="flex gap-3">
                    <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-solid text-white shrink-0">
                      <CalendarDays size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
                        <Clock size={12} />
                        {eventLine(e)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => recordFromEvent(e)} className="btn-outline w-full h-9 mt-3 text-sm">
                    <Mic size={16} /> {t('events.record')}
                  </button>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="grid place-items-center h-9 w-9 rounded-xl bg-surface-elevated border border-surface-border disabled:opacity-40"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-content-muted tabular-nums">
                  {page + 1} / {pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                  disabled={page >= pages - 1}
                  className="grid place-items-center h-9 w-9 rounded-xl bg-surface-elevated border border-surface-border disabled:opacity-40"
                  aria-label="Próxima"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  /* ------------------------- Modo CARD (home) ------------------------------ */
  return (
    <div className="card p-4 mb-4">
      {!needsAuth && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <CalendarDays size={18} className="text-accent" /> {t('events.title')}
          </h3>
          <button onClick={refresh} className="text-content-muted hover:text-content-primary" aria-label="Atualizar">
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
          </button>
        </div>
      )}

      {needsAuth ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-accent/10 text-accent shrink-0">
                <CalendarDays size={20} />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold">{t('events.title')}</p>
                <p className="text-sm text-content-muted">{t('events.connectSub')}</p>
              </div>
            </div>
            <button className="btn-neutral w-full md:w-auto shrink-0 text-sm px-3.5 py-2" onClick={connect} disabled={loading}>
              {loading ? <Spinner /> : <CalendarDays size={18} className="text-accent" />}
              {t('events.connect')}
            </button>
          </div>
          {errorBlock && <div className="mt-2">{errorBlock}</div>}
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
                  <div className="h-9 w-1 rounded-full bg-brand-solid shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.title}</p>
                    <p className="text-xs text-content-muted">{eventLine(e)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {errorBlock && <div className="mb-3">{errorBlock}</div>}
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
            <button onClick={disconnect} className="flex items-center gap-1 text-xs text-content-muted hover:text-accent">
              <Link2Off size={12} /> {t('events.disconnect')}
            </button>
          </div>

          {loading && events.length === 0 ? (
            <div className="grid place-items-center py-8">
              <Spinner className="text-accent" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-content-muted text-center py-6">{t('events.none')}</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3 min-w-0 max-h-[60vh] overflow-y-auto pr-1">
              {events.map((e) => (
                <li key={e.id} className="card p-4 min-w-0">
                  <div className="flex gap-3">
                    <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-solid text-white shrink-0">
                      <CalendarDays size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
                        <Clock size={12} />
                        {eventLine(e)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => recordFromEvent(e)} className="btn-outline w-full h-9 mt-3 text-sm">
                    <Mic size={16} /> {t('events.record')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  )
}
