import { Capacitor, registerPlugin } from '@capacitor/core'

interface SharedFileResult {
  empty: boolean
  name?: string
  mimeType?: string
  size?: number
  data?: string // base64
}

interface SharedFilePluginDef {
  consume(): Promise<SharedFileResult>
  addListener(event: 'sharedFile', cb: () => void): Promise<{ remove: () => void }>
}

const SharedFile = registerPlugin<SharedFilePluginDef>('SharedFile')

/** O share target so existe no APK Android (nao no navegador). */
export function canReceiveSharedFiles(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

/** Converte base64 -> ArrayBuffer em blocos (evita travar a UI em arquivos grandes). */
function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  const CHUNK = 32768
  for (let i = 0; i < bin.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bin.length)
    for (let j = i; j < end; j++) out[j] = bin.charCodeAt(j)
  }
  return buf
}

/** Retorna (e consome) o arquivo compartilhado pendente, se houver. */
export async function consumeSharedFile(): Promise<File | null> {
  if (!canReceiveSharedFiles()) return null
  try {
    const r = await SharedFile.consume()
    if (r.empty || !r.data) return null
    const buf = b64ToBuffer(r.data)
    return new File([buf], r.name || 'audio', { type: r.mimeType || 'application/octet-stream' })
  } catch {
    // too_large / read_failed: nada a importar
    return null
  }
}

/** Avisa quando um arquivo chega com o app ja aberto. */
export async function onSharedFile(cb: () => void): Promise<() => void> {
  if (!canReceiveSharedFiles()) return () => {}
  try {
    const h = await SharedFile.addListener('sharedFile', cb)
    return () => h.remove()
  } catch {
    return () => {}
  }
}

// Entrega o arquivo para a tela de captura sem passar por query string.
let pending: File | null = null
export function setPendingUpload(f: File) {
  pending = f
}
export function takePendingUpload(): File | null {
  const f = pending
  pending = null
  return f
}
