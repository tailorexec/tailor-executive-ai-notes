import { CalendarDays } from 'lucide-react'
import { UpcomingEvents } from './UpcomingEvents'
import { useT } from '../lib/i18n'

/** Agenda: eventos do Google Calendar + atalho para gravar a reuniao do evento. */
export function Agenda() {
  const t = useT()
  return (
    <div className="px-5 safe-top">
      <header className="flex items-center gap-3 mb-6">
        <span className="grid place-items-center h-10 w-10 rounded-full bg-brand-solid text-white shrink-0">
          <CalendarDays size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">{t('nav.agenda')}</h1>
          <p className="text-sm text-content-muted">{t('events.title')}</p>
        </div>
      </header>

      {/* Modo pagina: lista os eventos direto aqui (10 por pagina), sem "ver meus eventos". */}
      <div className="max-w-4xl pb-6">
        <UpcomingEvents mode="page" />
      </div>
    </div>
  )
}
