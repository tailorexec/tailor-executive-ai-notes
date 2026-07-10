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
      setInterval(() => void registration.update(), 60_000)
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

// Remove sessoes corrompidas no localStorage (residuo de tentativas antigas) que
// causavam "String contains non ISO-8859-1 code point" ao montar headers do fetch.
function sanitizeAuthStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-')) continue
      const value = localStorage.getItem(key) ?? ''
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
      if (corrupted) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

sanitizeAuthStorage()
initLang()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
)
