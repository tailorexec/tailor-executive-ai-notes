import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import { AuthProvider } from './auth/AuthProvider'
import { SettingsProvider } from './app/SettingsProvider'
import { ToastProvider } from './components/Toast'
import { initButtonShine } from './lib/buttonShine'
import { initLang } from './lib/lang'

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
initButtonShine()
initLang()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
