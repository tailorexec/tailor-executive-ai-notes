import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import { AuthProvider } from './auth/AuthProvider'
import { SettingsProvider } from './app/SettingsProvider'
import { ToastProvider } from './components/Toast'
import { I18nProvider } from './lib/i18n'
import { initLang } from './lib/lang'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logClientError } from './lib/auditLog'
import { setupInstallPromptCapture } from './lib/pwaInstall'
import { describeUnknownError } from './lib/errorMessage'

/**
 * Hoje nao existe NENHUM catch-all de erro no cliente: um throw fora de um try/catch, ou uma
 * promise rejeitada sem .catch, simplesmente desaparece (o usuario ve o sintoma -- tela travada,
 * botao que nao faz nada -- sem que ninguem, nem o admin, saiba que aconteceu). Os `.catch(() =>
 * {})` dentro de logClientError garantem que ESTES listeners nunca disparam um ao outro (senao
 * seria um loop: falha ao logar -> unhandledrejection -> tenta logar de novo -> falha de novo).
 */
function setupGlobalErrorLogging() {
  window.addEventListener('error', (event) => {
    logClientError({
      severity: 'error',
      category: 'silent',
      source: 'client:window',
      message: event.message || 'Erro de script sem mensagem',
      detail: { filename: event.filename, lineno: event.lineno },
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logClientError({
      severity: 'error',
      category: 'silent',
      source: 'client:window',
      message: describeUnknownError(reason) || 'unhandledrejection sem motivo',
      detail: reason instanceof Error ? { stack: reason.stack?.slice(0, 2000) } : undefined,
    })
  })
}

/**
 * O registro que a Vite injeta sozinha so escuta 'load' e nunca mais checa por uma versao
 * nova. Um PWA instalado no iOS quase sempre e RETOMADO (o WKWebView so volta do segundo
 * plano) em vez de recarregado do zero -- 'load' nunca refaz, entao o app pode ficar preso
 * numa versao antiga indefinidamente, por mais deploys que sejam publicados.
 *
 * Aqui: registra na hora (nao espera 'load'), forca uma checagem manual a cada minuto (nao
 * depende so da heuristica interna do navegador) e recarrega a pagina sozinho assim que um
 * service worker novo assume o controle -- sem isso, skipWaiting+clientsClaim atualizam o
 * "controlador" mas a tela ja renderizada continua mostrando o JS/CSS antigo ate um reload.
 */
function setupServiceWorkerUpdates() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // .catch() de proposito: uma checagem falhando (rede instavel, blip momentaneo do CDN)
      // nao e acionavel -- a proxima tentativa e so daqui 60s, e sem isto cada falha virava um
      // "erro" no audit_log sem nenhuma acao possivel do lado do codigo (ja aconteceu 3x).
      setInterval(() => registration.update().catch(() => {}), 60_000)
    },
  })

  let reloading = false
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  return updateSW
}

setupServiceWorkerUpdates()

// Remove sessoes corrompidas (residuo de tentativas antigas) que causavam "String contains
// non ISO-8859-1 code point" ao montar headers do fetch. A sessao pode estar em localStorage
// OU sessionStorage, dependendo do "manter conectado" (ver lib/supabase.ts).
function sanitizeAuthStorage() {
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) {
        if (!key.startsWith('sb-')) continue
        const value = store.getItem(key) ?? ''
        let corrupted = false
        for (let i = 0; i < value.length; i++) {
          if (value.codePointAt(i)! > 255) {
            corrupted = true
            break
          }
        }
        if (!corrupted) {
          try {
            JSON.parse(value)
          } catch {
            corrupted = true
          }
        }
        if (corrupted) store.removeItem(key)
      }
    }
  } catch (err) {
    // Raro (localStorage bloqueado/indisponivel), mas ai a limpeza nem roda -- vale saber.
    logClientError({
      severity: 'warning',
      category: 'silent',
      source: 'client:bootstrap',
      message: `sanitizeAuthStorage falhou: ${String(err)}`,
    })
  }
}

sanitizeAuthStorage()
setupGlobalErrorLogging()
setupInstallPromptCapture()
initLang()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <I18nProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </I18nProvider>
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
