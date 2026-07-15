// Instalacao do PWA (Android/Chrome via beforeinstallprompt; iOS nao tem essa API -- a Apple
// nunca expos um jeito de instalar programaticamente, so via Compartilhar > Tela de Inicio no
// Safari). O evento so dispara UMA VEZ por carregamento de pagina, entao escuta cedo (chamado
// em main.tsx) e guarda numa variavel de modulo pra qualquer pagina usar depois.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function setupInstallPromptCapture(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((cb) => cb())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((cb) => cb())
  })
}

/** Chama `cb` sempre que a disponibilidade do prompt mudar. Devolve funcao de cancelar. */
export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function canInstallNow(): boolean {
  return !!deferredPrompt
}

/** Dispara o dialogo NATIVO do navegador (Chrome/Edge/Android) -- exige o clique do usuario
 *  (gesto real), nunca instala sozinho sem confirmacao. */
export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  deferredPrompt = null
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  return outcome
}

/** iPadOS 13+ se identifica como "Mac" no user-agent -- so o toque com >1 ponto distingue de um Mac de verdade. */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
}

export function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')
}

/** Mesma logica ja usada em Settings.tsx (SafeAreaDebug) -- reaproveitada aqui. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}
