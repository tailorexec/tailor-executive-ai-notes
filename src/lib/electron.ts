// Ponte com o app Windows nativo (Electron) -- so existe quando o site roda dentro do wrapper
// (ver electron/preload.cjs). No navegador comum e no PWA, window.anaElectron e undefined,
// entao tudo aqui vira no-op fora do app Windows.

export type AnaUpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' }

export interface AnaElectronBridge {
  platform: 'win32'
  onRecordHotkey: (cb: () => void) => () => void
  checkForUpdates: () => void
  onUpdateStatus: (cb: (payload: AnaUpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    anaElectron?: AnaElectronBridge
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.anaElectron
}
