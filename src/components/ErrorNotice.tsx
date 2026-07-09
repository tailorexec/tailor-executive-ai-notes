import { useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Mensagem de erro padrao. O usuario nunca ve a mensagem tecnica de cara: ela fica
 * atras de um "ver mais", para ele poder copiar e reportar sem se assustar.
 */
export function ErrorNotice({
  message,
  detail,
  className = '',
}: {
  /** Mensagem amigavel. Se omitida, usa a padrao do app. */
  message?: string
  /** Texto tecnico (codigo, HTTP, excecao). Opcional. */
  detail?: string
  className?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className={`alert-error ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="leading-snug">{message ?? t('common.errorGeneric')}</p>
        {detail && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {open ? t('common.seeLess') : t('common.seeMore')}
          </button>
        )}
      </div>
      {open && detail && (
        <p className="mt-2 text-xs font-mono break-all opacity-80 select-all">{detail}</p>
      )}
    </div>
  )
}
