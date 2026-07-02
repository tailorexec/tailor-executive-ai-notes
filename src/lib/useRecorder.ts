import { useCallback, useRef, useState } from 'react'
import { config } from './config'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

interface RecorderResult {
  blob: Blob
  durationSeconds: number
  url: string
}

interface StartOptions {
  /** Tambem captura o audio da aba/sistema (reuniao) e mistura com o microfone. */
  system?: boolean
}

/** Captura de audio interno (aba/sistema) so existe no desktop via getDisplayMedia. */
export function canCaptureSystemAudio(): boolean {
  const md = navigator.mediaDevices as MediaDevices | undefined
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return !!md && typeof md.getDisplayMedia === 'function' && !isMobile
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  /** Fica true quando a captura termina sozinha (ex.: usuario clicou em "Parar compartilhamento"). */
  const [ended, setEnded] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const resolveRef = useRef<((r: RecorderResult) => void) | null>(null)
  const startedAtRef = useRef<number>(0)
  const elapsedBeforePauseRef = useRef<number>(0)
  const mimeRef = useRef<string>('audio/webm')

  const tickLevel = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3))
    rafRef.current = requestAnimationFrame(tickLevel)
  }, [])

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - startedAtRef.current) / 1000
      setSeconds(Math.floor(elapsed))
    }, 250)
  }, [])

  const start = useCallback(
    async (opts?: StartOptions) => {
      setError(null)
      setEnded(false)
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyserRef.current = analyser

        // Microfone (sua voz)
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = mic
        ctx.createMediaStreamSource(mic).connect(analyser)

        let recordStream: MediaStream = mic

        if (opts?.system) {
          // Audio da aba/sistema (a outra ponta da reuniao)
          const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          displayStreamRef.current = display
          const sysTracks = display.getAudioTracks()
          if (sysTracks.length === 0) {
            display.getTracks().forEach((t) => t.stop())
            mic.getTracks().forEach((t) => t.stop())
            ctx.close().catch(() => {})
            setError(
              'Voce precisa marcar "Compartilhar audio" no dialogo (compartilhe a aba da reuniao ou a tela toda). Tente novamente.',
            )
            setState('idle')
            return
          }
          // Nao precisamos do video: encerra a faixa de video.
          display.getVideoTracks().forEach((t) => t.stop())

          // Mistura microfone + audio do sistema numa unica faixa.
          const dest = ctx.createMediaStreamDestination()
          ctx.createMediaStreamSource(mic).connect(dest)
          const sysSource = ctx.createMediaStreamSource(new MediaStream(sysTracks))
          sysSource.connect(dest)
          sysSource.connect(analyser)
          recordStream = dest.stream

          // Se o usuario parar o compartilhamento pelo navegador, encerramos.
          sysTracks[0].onended = () => setEnded(true)
        }

        rafRef.current = requestAnimationFrame(tickLevel)

        const mime = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''
        mimeRef.current = mime || 'audio/webm'
        const recorder = new MediaRecorder(recordStream, {
          ...(mime ? { mimeType: mime } : {}),
          audioBitsPerSecond: config.recordingBitrate,
        })
        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeRef.current })
          const url = URL.createObjectURL(blob)
          resolveRef.current?.({
            blob,
            durationSeconds: Math.round(elapsedBeforePauseRef.current),
            url,
          })
        }
        mediaRef.current = recorder
        recorder.start()

        elapsedBeforePauseRef.current = 0
        setSeconds(0)
        setState('recording')
        startTimer()
      } catch (err) {
        const name = (err as DOMException)?.name
        if (name === 'NotAllowedError') {
          setError('Permissao negada. Autorize o microfone e o compartilhamento de audio.')
        } else {
          setError('Nao foi possivel iniciar a captura de audio.')
        }
        setState('idle')
      }
    },
    [startTimer, tickLevel],
  )

  const pause = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state === 'recording') {
      rec.pause()
      elapsedBeforePauseRef.current += (Date.now() - startedAtRef.current) / 1000
      if (timerRef.current) clearInterval(timerRef.current)
      setState('paused')
    }
  }, [])

  const resume = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state === 'paused') {
      rec.resume()
      startTimer()
      setState('recording')
    }
  }, [startTimer])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    setLevel(0)
  }, [])

  const stop = useCallback((): Promise<RecorderResult> => {
    return new Promise((resolve) => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        if (mediaRef.current.state === 'recording') {
          elapsedBeforePauseRef.current += (Date.now() - startedAtRef.current) / 1000
        }
        resolveRef.current = (r) => {
          cleanup()
          setState('stopped')
          resolve(r)
        }
        mediaRef.current.stop()
      } else {
        resolve({ blob: new Blob(), durationSeconds: seconds, url: '' })
      }
    })
  }, [cleanup, seconds])

  return { state, seconds, level, error, ended, start, pause, resume, stop }
}
