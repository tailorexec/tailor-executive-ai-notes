import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PhoneOff, Upload, Monitor, Info } from 'lucide-react'
import { useT } from '../lib/i18n'

/**
 * Discador desativado.
 *
 * Gravar uma ligacao de dentro do app e impossivel: durante a chamada o Android e o iOS
 * reservam o microfone, e outro app recebe silencio. Nao e limitacao do ANA — nenhum app
 * de terceiro consegue. Por isso a tela orienta os dois caminhos que funcionam de verdade.
 */
export function Dialer() {
  const navigate = useNavigate()
  const t = useT()

  return (
    <div className="min-h-[100dvh] flex flex-col px-5 safe-top safe-bottom-2">
      <header className="flex items-center gap-3 mb-6 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border shrink-0"
          aria-label={t('note.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl font-bold">{t('nav.dialer')}</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center pb-10">
        <div className="card p-6 max-w-md w-full">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-brand-solid text-white mx-auto mb-4">
            <PhoneOff size={26} />
          </div>

          <h2 className="font-display font-semibold text-lg text-center">{t('dialer.unavailable')}</h2>
          <p className="text-content-secondary text-sm text-center mt-2">{t('dialer.unavailableWhy')}</p>

          <div className="flex items-start gap-3 mt-6">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-brand-solid text-white shrink-0">
              <Info size={18} />
            </span>
            <div>
              <p className="font-medium text-sm">{t('dialer.tipTitle')}</p>
              <p className="text-content-muted text-xs mt-0.5 leading-relaxed">{t('dialer.tip1')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 mt-4">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-surface-elevated text-content-secondary shrink-0">
              <Monitor size={18} />
            </span>
            <div>
              <p className="font-medium text-sm">{t('dialer.tip2Title')}</p>
              <p className="text-content-muted text-xs mt-0.5 leading-relaxed">{t('dialer.tip2')}</p>
            </div>
          </div>

          <button className="btn-primary w-full mt-6" onClick={() => navigate('/capturar?mode=upload')}>
            <Upload size={18} /> {t('dialer.sendAudio')}
          </button>
        </div>
      </div>
    </div>
  )
}
