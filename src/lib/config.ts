// Central configuration. Reads Vite env vars; falls back to "mock mode"
// so the whole app is navegable/testavel sem backend nem chaves de IA.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const config = {
  supabaseUrl: url ?? '',
  supabaseAnonKey: anon ?? '',
  /** When Supabase is not configured we run fully local (localStorage). */
  mockMode: !url || !anon,

  /** Only e-mails deste dominio podem se cadastrar. */
  allowedDomain: 'tailorexec.com.br',
  adminEmail: 'flavio.junior@tailorexec.com.br',

  /** Limite inicial de duracao de gravacao (2 horas). */
  recordingMaxSeconds: 2 * 60 * 60,

  app: {
    name: 'Tailor Executive AI Notes',
    shortName: 'Tailor Notes',
  },
} as const

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === config.adminEmail
}

export function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.trim().toLowerCase()
  return domain === config.allowedDomain
}
