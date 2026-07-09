import { Capacitor, registerPlugin } from '@capacitor/core'

interface StopResult {
  path: string
  size: number
  durationSeconds: number
  mimeType: string
}

interface BgRecorderDef {
  start(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<StopResult>
  getStatus(): Promise<{ recording: boolean; paused: boolean; seconds: number }>
  readChunk(o: { path: string; offset: number; length: number }): Promise<{ data: string; read: number }>
  discard(o: { path: string }): Promise<void>
}

const BgRecorder = registerPlugin<BgRecorderDef>('BgRecorder')

/** Gravacao com a tela apagada so existe no APK Android. */
export function canRecordInBackground(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

const CHUNK = 1024 * 1024 // 1 MB

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return buf
}

export const bgRecorder = {
  start: () => BgRecorder.start(),
  pause: () => BgRecorder.pause(),
  resume: () => BgRecorder.resume(),
  status: () => BgRecorder.getStatus(),

  /** Encerra e monta o Blob lendo o arquivo em pedacos (evita string base64 gigante). */
  async stop(): Promise<{ blob: Blob; durationSeconds: number }> {
    const info = await BgRecorder.stop()
    const parts: ArrayBuffer[] = []
    let offset = 0
    while (offset < info.size) {
      const { data, read } = await BgRecorder.readChunk({ path: info.path, offset, length: CHUNK })
      if (!read) break
      parts.push(b64ToBuffer(data))
      offset += read
    }
    await BgRecorder.discard({ path: info.path }).catch(() => {})
    return {
      blob: new Blob(parts, { type: info.mimeType || 'audio/mp4' }),
      durationSeconds: info.durationSeconds,
    }
  },
}
