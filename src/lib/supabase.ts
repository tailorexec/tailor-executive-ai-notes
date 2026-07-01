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

// Only instantiate a real client when configured. In mock mode this stays null
// and the data layer uses the localStorage-backed implementation instead.
export const supabase: SupabaseClient | null = config.mockMode
  ? null
  : createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: safeFetch,
      },
    })
