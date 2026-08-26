// Ponte com o app Windows nativo (Electron) -- so existe quando o site roda dentro do wrapper
// (ver electron/preload.cjs). No navegador comum e no PWA, window.anaElectron e undefined,
// entao tudo aqui vira no-op fora do app Windows.

export type AnaUpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; version?: string }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' }

export interface AnaElectronBridge {
  platform: 'win32'
  /** Versao do instalador nativo instalado. `undefined` em instaladores antigos (anteriores a
   *  este recurso) -- tratados como desatualizados pelo aviso de atualizacao. */
  appVersion?: string
  onRecordHotkey: (cb: () => void) => () => void
  checkForUpdates: () => void
  onUpdateStatus: (cb: (payload: AnaUpdateStatus) => void) => () => void
  /** Instala agora a atualizacao ja baixada e reabre o app. `undefined` em instaladores antigos
   *  (capability-gated) -- nesse caso o aviso cai no fallback de baixar por link. */
  quitAndInstall?: (notice?: { title: string; body: string }) => void
  /** Pede ao processo principal que reconecte o audio do sistema (loopback) apos o Windows
   *  trocar o aparelho de saida. Precisa passar pelo main porque getDisplayMedia exige uma
   *  ativacao transitoria, e so ele consegue simular o gesto. `undefined` em instaladores
   *  antigos -- ali o aviso de audio mudo de 30s continua sendo a rede de protecao. */
  requestSystemAudioReattach?: () => void
}

declare global {
  interface Window {
    anaElectron?: AnaElectronBridge
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.anaElectron
}
