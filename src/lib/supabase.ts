import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

function headerValueHasInvalidCodePoint(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.codePointAt(i)! > 255) return true
  }
  return false
}

function sanitizeHeaders(headers: HeadersInit | undefined): HeadersInit | undefined {
  if (!headers) return headers

  const sanitized = new Headers()
  const add = (key: string, value: string) => {
    if (headerValueHasInvalidCodePoint(value)) return
    sanitized.set(key, value)
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => add(key, value))
    return sanitized
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => add(key, value))
    return sanitized
  }

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) add(key, String(value))
  })
  return sanitized
}

const safeFetch: typeof fetch = (input, init) => {
  const safeInit = init ? { ...init, headers: sanitizeHeaders(init.headers) } : init
  return fetch(input, safeInit)
}

const REMEMBER_KEY = 'tailor.rememberMe'

/** Chamar ANTES de signIn()/signUp() -- define onde a sessao desta vez vai ser guardada. */
export function setRememberMe(v: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, v ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

function rememberMe(): boolean {
  try {
    // Padrao TRUE: quem nunca viu o botao (sessao ja aberta antes dele existir) continua
    // conectado normalmente -- so fica em sessionStorage quem desmarcar explicitamente.
    return localStorage.getItem(REMEMBER_KEY) !== 'false'
  } catch {
    return true
  }
}

/**
 * "Manter conectado" ligado (padrao): sessao em localStorage, sobrevive fechar o app/navegador.
 * Desligado: sessao em sessionStorage -- some quando a janela/aba fecha de verdade (no app
 * Windows isso e "Sair" pela bandeja; so minimizar mantem o processo vivo, entao continua
 * conectado ate esse ponto). A escolha em si sempre fica em localStorage: e so uma preferencia,
 * nao um segredo, e precisa sobreviver pra decidir onde ler a sessao na proxima abertura.
 */
const authStorage = {
  getItem: (key: string) => (rememberMe() ? localStorage.getItem(key) : sessionStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    if (rememberMe()) localStorage.setItem(key, value)
    else sessionStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

// Only instantiate a real client when configured. In mock mode this stays null
// and the data layer uses the localStorage-backed implementation instead.
export const supabase: SupabaseClient | null = config.mockMode
  ? null
  : createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage,
      },
      global: {
        fetch: safeFetch,
      },
    })
