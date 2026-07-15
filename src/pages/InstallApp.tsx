import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Share, SquarePlus, Download, CheckCircle2, Smartphone, ArrowLeft } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useToast } from '../components/Toast'
import {
  canInstallNow,
  isAndroidDevice,
  isIOSDevice,
  isStandaloneDisplay,
  onInstallPromptChange,
  triggerInstall,
} from '../lib/pwaInstall'

/** Chrome/Edge no Android reportam corretamente; Safari/Firefox no iOS nunca tem esse UA. */
function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent || ''
  return /Chrome|Chromium|Edg\//i.test(ua) && !/Firefox\//i.test(ua)
}

/** Passo numerado com icone -- reaproveitado pros dois sistemas operacionais. */
function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid place-items-center h-8 w-8 rounded-full bg-brand-solid text-white text-sm font-bold shrink-0">
        {n}
      </span>
      <div className="flex items-center gap-2 pt-1">
        <span className="text-accent shrink-0">{icon}</span>
        <p className="text-sm text-content-secondary leading-relaxed">{children}</p>
      </div>
    </li>
  )
}

export function InstallApp() {
  const toast = useToast()
  const [canInstall, setCanInstall] = useState(canInstallNow())
  const [installed, setInstalled] = useState(isStandaloneDisplay())
  const [installing, setInstalling] = useState(false)
  const ios = isIOSDevice()
  const android = isAndroidDevice()
  const chromium = isChromiumBrowser()

  useEffect(() => onInstallPromptChange(() => setCanInstall(canInstallNow())), [])

  async function handleInstall() {
    setInstalling(true)
    try {
      const outcome = await triggerInstall()
      if (outcome === 'accepted') {
        setInstalled(true)
        toast('App instalado!')
      } else if (outcome === 'unavailable') {
        toast('Abra este link no Chrome do Android para instalar automaticamente.', 'error')
      }
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="min-h-dvh px-5 safe-top safe-bottom pb-10">
      <header className="flex items-center gap-3 mb-8 pt-2">
        <Link
          to="/"
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Logo size="md" />
      </header>

      <div className="max-w-md mx-auto">
        <div className="grid place-items-center h-16 w-16 rounded-2xl bg-brand-solid text-white mx-auto mb-5">
          <Smartphone size={30} />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mb-2">Instalar o ANA no celular</h1>
        <p className="text-content-secondary text-center text-sm mb-8">
          Acesso rápido direto na tela de início, como um app de verdade — sem ocupar espaço extra
          e sempre na versão mais nova.
        </p>

        {installed ? (
          <div className="card p-6 text-center">
            <CheckCircle2 size={32} className="text-accent mx-auto mb-3" />
            <p className="font-display font-semibold mb-1">Já está instalado!</p>
            <p className="text-sm text-content-muted">Você está usando o ANA como app neste aparelho.</p>
          </div>
        ) : ios ? (
          <div className="card p-5">
            <p className="text-sm font-medium mb-4">No iPhone/iPad, a instalação é manual (a Apple não permite automatizar), mas leva 10 segundos:</p>
            <ol className="space-y-4">
              <Step n={1} icon={<Share size={18} />}>
                Toque no ícone de <span className="font-medium text-content-primary">Compartilhar</span> na
                barra do Safari (o quadrado com uma seta pra cima).
              </Step>
              <Step n={2} icon={<SquarePlus size={18} />}>
                Role a lista e toque em <span className="font-medium text-content-primary">"Adicionar à Tela de Início"</span>.
              </Step>
              <Step n={3} icon={<CheckCircle2 size={18} />}>
                Toque em <span className="font-medium text-content-primary">Adicionar</span>. Pronto — o ícone do ANA aparece na tela de início.
              </Step>
            </ol>
            {!/Safari/i.test(navigator.userAgent || '') || /CriOS|FxiOS/i.test(navigator.userAgent || '') ? (
              <p className="text-xs text-accent mt-4 bg-accent/10 rounded-xl px-3 py-2">
                Esse passo só funciona no <span className="font-medium">Safari</span> — se você abriu este
                link no Chrome ou outro navegador do iPhone, copie o link e abra no Safari.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="card p-5">
            {canInstall ? (
              <>
                <p className="text-sm text-content-secondary mb-4">
                  Seu navegador já pode instalar o ANA com um clique.
                </p>
                <button className="btn-primary w-full" onClick={handleInstall} disabled={installing}>
                  <Download size={18} /> {installing ? 'Instalando...' : 'Instalar agora'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium mb-4">
                  {android && !chromium
                    ? 'Abra este link no Chrome do Android para instalar automaticamente. Ou instale manualmente:'
                    : 'Instale manualmente pelo menu do navegador:'}
                </p>
                <ol className="space-y-4">
                  <Step n={1} icon={<Smartphone size={18} />}>
                    Toque no menu do navegador (<span className="font-medium text-content-primary">⋮</span>, três
                    pontinhos no canto superior).
                  </Step>
                  <Step n={2} icon={<SquarePlus size={18} />}>
                    Toque em <span className="font-medium text-content-primary">"Instalar app"</span> ou{' '}
                    <span className="font-medium text-content-primary">"Adicionar à tela inicial"</span>.
                  </Step>
                </ol>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-content-muted text-center mt-6">
          Depois de instalado, abra o app pela tela de início — o login continua o mesmo.
        </p>
      </div>
    </div>
  )
}
