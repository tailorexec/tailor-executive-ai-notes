import { useEffect, useState } from 'react'
import { ArrowUpCircle, X } from 'lucide-react'
import { isElectron, type AnaUpdateStatus } from '../lib/electron'
import { LATEST_WINDOWS_BUILD } from '../lib/version'
import { WINDOWS_APP_DOWNLOAD_URL } from '../lib/windowsApp'
import { useToast } from './Toast'
import { useT } from '../lib/i18n'

/** Compara "0.18.10" vs "0.18.9": true se `a` for MENOR que `b`. Partes ausentes contam 0. */
function isOlder(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

const DISMISS_KEY = 'tailor.updateBanner.dismissed'

/**
 * Aviso fino no topo, so no app Windows (Electron), quando o instalador nativo instalado esta
 * atras da ultima versao publicada -- ou quando nem reporta versao (instalador antigo, anterior
 * a este recurso), que tambem tratamos como desatualizado. "Atualizar agora" dispara o
 * auto-updater (se o instalador suportar) ou abre o link de download direto.
 */
export function UpdateBanner() {
  const t = useT()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(() => {
    try {
      // Dispensa so pela sessao (some ao reabrir o app), pra nao esconder pra sempre.
      return sessionStorage.getItem(DISMISS_KEY) === LATEST_WINDOWS_BUILD
    } catch {
      return false
    }
  })
  // Acompanha o auto-update em segundo plano: quando fica 'downloaded', o aviso vira o botao
  // "Reiniciar e atualizar" (instala na hora). Do contrario a instalacao acontece sozinha ao sair.
  const [status, setStatus] = useState<AnaUpdateStatus['status'] | null>(null)

  useEffect(() => {
    if (!isElectron() || typeof window.anaElectron!.onUpdateStatus !== 'function') return
    return window.anaElectron!.onUpdateStatus((p) => setStatus(p.status))
  }, [])

  if (!isElectron() || dismissed) return null

  const installed = window.anaElectron!.appVersion
  const outdated = !installed || isOlder(installed, LATEST_WINDOWS_BUILD)
  if (!outdated) return null

  const ready = status === 'downloaded' && typeof window.anaElectron!.quitAndInstall === 'function'
  const downloading = status === 'downloading' || status === 'available' || status === 'checking'

  function update() {
    if (typeof window.anaElectron!.checkForUpdates === 'function') {
      // Com autoDownload no app, isto so adianta a busca -- o download roda sozinho em segundo plano.
      window.anaElectron!.checkForUpdates()
      toast(t('update.checking'))
    } else {
      // Instalador antigo sem auto-updater: so resta baixar o novo manualmente.
      window.open(WINDOWS_APP_DOWNLOAD_URL, '_blank')
    }
  }

  function restart() {
    window.anaElectron!.quitAndInstall!()
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, LATEST_WINDOWS_BUILD)
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    // max-w + alinhado a esquerda: no app Windows a Home tem controles flutuantes no canto
    // superior direito (pasta/atualizar/tema, position:fixed z-40) -- uma barra ate a borda
    // direita deixava o botao "Atualizar agora" embaixo deles. Estreita, fica bem a esquerda.
    <div className="flex items-center gap-2.5 border border-accent/30 bg-accent/10 rounded-2xl px-4 py-2 mx-5 mt-4 max-w-xl text-sm">
      <ArrowUpCircle size={16} className="text-accent shrink-0" />
      <span className="flex-1 min-w-0 text-content-primary">
        {ready ? t('update.ready') : downloading ? t('update.downloading') : t('update.available')}
      </span>
      {ready ? (
        <button onClick={restart} className="btn-primary h-8 px-3 text-sm shrink-0">
          {t('update.restart')}
        </button>
      ) : (
        <button onClick={update} disabled={downloading} className="btn-primary h-8 px-3 text-sm shrink-0 disabled:opacity-60">
          {t('update.now')}
        </button>
      )}
      <button onClick={dismiss} aria-label={t('update.dismiss')} className="shrink-0 text-content-muted hover:text-content-primary">
        <X size={16} />
      </button>
    </div>
  )
}
