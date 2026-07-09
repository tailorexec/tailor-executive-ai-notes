import { Link } from 'react-router-dom'
import { ShieldAlert, Users, FileLock2 } from 'lucide-react'
import { Sheet } from './ui'
import { useT } from '../lib/i18n'

/** Aviso de gravacao: exibido antes da primeira gravacao de cada usuario. */
export function ConsentSheet({
  open,
  onAccept,
  onClose,
}: {
  open: boolean
  onAccept: () => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={t('consent.title')}>
      <div className="flex items-start gap-3 mb-4">
        <ShieldAlert size={22} className="text-accent shrink-0 mt-0.5" />
        <p className="text-sm text-content-secondary">{t('consent.body')}</p>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <Users size={20} className="text-content-muted shrink-0 mt-0.5" />
        <p className="text-sm text-content-secondary">{t('consent.notify')}</p>
      </div>

      <div className="flex items-start gap-3 mb-5">
        <FileLock2 size={20} className="text-content-muted shrink-0 mt-0.5" />
        <p className="text-sm text-content-secondary">
          {t('consent.data')}{' '}
          <Link to="/privacidade" className="text-accent font-medium hover:underline">
            {t('consent.privacyLink')}
          </Link>
          .
        </p>
      </div>

      <button className="btn-primary w-full mb-2" onClick={onAccept}>
        {t('consent.accept')}
      </button>
      <button className="btn-ghost w-full" onClick={onClose}>
        {t('common.cancel')}
      </button>
    </Sheet>
  )
}

/** Faixa persistente enquanto a gravacao acontece. */
export function RecordingNotice() {
  const t = useT()
  return (
    <p className="text-xs text-content-muted text-center max-w-xs mx-auto mt-4 leading-relaxed">
      {t('consent.recording')}
    </p>
  )
}
