import { useCallback, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

interface RecorderResult {
  blob: Blob
  durationSeconds: number
  url: string
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const resolveRef = useRef<((r: RecorderResult) => void) | null>(null)
  const startedAtRef = useRef<number>(0)
  const elapsedBeforePauseRef = useRef<number>(0)

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

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser
      rafRef.current = requestAnimationFrame(tickLevel)

      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const duration = elapsedBeforePauseRef.current
        resolveRef.current?.({ blob, durationSeconds: Math.round(duration), url })
      }
      mediaRef.current = recorder
      recorder.start()

      startedAtRef.current = Date.now()
      elapsedBeforePauseRef.current = 0
      setSeconds(0)
      setState('recording')
      timerRef.current = window.setInterval(() => {
        const elapsed = elapsedBeforePauseRef.current + (Date.now() - startedAtRef.current) / 1000
        setSeconds(Math.floor(elapsed))
      }, 250)
    } catch {
      setError('Nao foi possivel acessar o microfone. Verifique as permissoes.')
      setState('idle')
    }
  }, [tickLevel])

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
      startedAtRef.current = Date.now()
      timerRef.current = window.setInterval(() => {
        const elapsed = elapsedBeforePauseRef.current + (Date.now() - startedAtRef.current) / 1000
        setSeconds(Math.floor(elapsed))
      }, 250)
      setState('recording')
    }
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
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

  return { state, seconds, level, error, start, pause, resume, stop }
}
