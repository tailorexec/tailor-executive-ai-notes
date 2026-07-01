import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getAppSettings } from '../lib/appSettings'
import type { AppSettings } from '../lib/types'

interface SettingsCtx {
  settings: AppSettings | null
  refresh: () => Promise<void>
  setLocal: (s: AppSettings) => void
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const refresh = useCallback(async () => {
    const s = await getAppSettings()
    setSettings(s)
  }, [])

  useEffect(() => {
    refresh()
    // Verifica periodicamente (avisos/manutencao publicados pelo admin).
    const t = setInterval(refresh, 60000)
    return () => clearInterval(t)
  }, [refresh])

  return <Ctx.Provider value={{ settings, refresh, setLocal: setSettings }}>{children}</Ctx.Provider>
}

export function useAppSettings(): SettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppSettings deve ser usado dentro de SettingsProvider')
  return ctx
}
