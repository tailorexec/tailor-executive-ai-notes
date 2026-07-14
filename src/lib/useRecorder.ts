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

/**
 * Opcoes do seletor de compartilhamento. Elas existem para o usuario errar menos:
 *
 * - `displaySurface: 'browser'` abre o dialogo ja na aba "Guia do Chrome". Compartilhando uma
 *   guia, o "compartilhar audio" vem MARCADO por padrao; na tela inteira vem desmarcado. Ou
 *   seja, empurrar para a guia resolve tambem o esquecimento do som.
 * - `selfBrowserSurface: 'exclude'` tira a propria aba do ANA da lista de escolhas.
 * - `systemAudio: 'include'` pede o audio do sistema para quem escolher tela/janela mesmo assim.
 *
 * Sao dicas: o usuario continua livre para escolher tela inteira e desmarcar o audio — por isso
 * o `start()` abaixo trata a falta de audio como aviso, nunca como motivo para abortar.
 */
const DISPLAY_OPTIONS = {
  video: { displaySurface: 'browser' },
  audio: true,
  systemAudio: 'include',
  selfBrowserSurface: 'exclude',
} as unknown as DisplayMediaStreamOptions

/** Silencio digital absoluto por tanto tempo = a fonte escolhida quase certamente esta errada. */
const SILENCE_MS = 30_000
/** Acima disto ja consideramos que ouvimos a reuniao (ruido de fundo passa longe do zero). */
const SILENCE_RMS = 0.002

export function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Captura de audio interno (aba/sistema) so existe no desktop via getDisplayMedia. */
export function canCaptureSystemAudio(): boolean {
  const md = navigator.mediaDevices as MediaDevices | undefined
  return !!md && typeof md.getDisplayMedia === 'function' && !isMobileBrowser()
}

/**
 * Somente navegadores Chromium (Chrome, Edge, Opera, Brave) entregam o AUDIO da aba
 * no getDisplayMedia. Safari e Firefox implementam a API mas devolvem apenas o video —
 * a gravacao sairia com o seu microfone e SEM a outra ponta da reuniao.
 */
export function supportsTabAudio(): boolean {
  if (isMobileBrowser()) return false
  const ua = navigator.userAgent
  const isChromium = /Chrome|Chromium|Edg\//i.test(ua) && !/Firefox\//i.test(ua)
  return isChromium
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  /** Fica true quando a captura termina sozinha (ex.: usuario clicou em "Parar compartilhamento"). */
  const [ended, setEnded] = useState(false)
  /** Gravando, mas sem o audio da reuniao: so a voz do usuario. Ele pode anexar depois. */
  const [systemAudioMissing, setSystemAudioMissing] = useState(false)
  /** O audio da reuniao esta anexado, porem mudo ha mais de 30s: fonte provavelmente errada. */
  const [systemSilent, setSystemSilent] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  /** Destino da mistura mic + reuniao. Existe so no modo reuniao, para dar pra anexar o audio depois. */
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  /** Analyser exclusivo da reuniao: o do nivel mistura o microfone e nunca ficaria mudo. */
  const sysAnalyserRef = useRef<AnalyserNode | null>(null)
  const sysSilentSinceRef = useRef<number | null>(null)
  const sysHeardRef = useRef(false)
  /** Ja existe audio da reuniao na mistura? Uma troca de fonte que falha nao pode desmentir isso. */
  const sysAttachedRef = useRef(false)
  const resolveRef = useRef<((r: RecorderResult) => void) | null>(null)
  const startedAtRef = useRef<number>(0)
  const elapsedBeforePauseRef = useRef<number>(0)
  const mimeRef = useRef<string>('audio/webm')

  const rms = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }

  /**
   * Vigia o audio da reuniao. Nenhuma reuniao fica em silencio absoluto por 30s, entao isso
   * denuncia a aba errada ou o audio desmarcado. So avisa; nunca interrompe a gravacao.
   */
  const watchSilence = useCallback(() => {
    const sys = sysAnalyserRef.current
    if (!sys || sysHeardRef.current) return
    // Pausado nao conta como silencio.
    if (mediaRef.current?.state !== 'recording') {
      sysSilentSinceRef.current = null
      return
    }
    if (rms(sys) > SILENCE_RMS) {
      sysHeardRef.current = true
      sysSilentSinceRef.current = null
      setSystemSilent(false)
      return
    }
    const since = sysSilentSinceRef.current ?? Date.now()
    sysSilentSinceRef.current = since
    if (Date.now() - since >= SILENCE_MS) setSystemSilent(true)
  }, [])

  const tickLevel = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    setLevel(Math.min(1, rms(analyser) * 3))
    watchSilence()
    rafRef.current = requestAnimationFrame(tickLevel)
  }, [watchSilence])

  /**
   * Liga o audio da reuniao na mistura que ja esta sendo gravada. Devolve false quando o
   * usuario compartilhou algo sem marcar a caixa de audio (o caso comum): ai a gravacao segue
   * so com o microfone e a tela avisa, em vez de jogar fora o que ja foi gravado.
   */
  const attachDisplay = useCallback((display: MediaStream): boolean => {
    const ctx = audioCtxRef.current
    const dest = destRef.current
    const analyser = analyserRef.current
    const sysTracks = display.getAudioTracks()

    if (!ctx || !dest || !analyser || sysTracks.length === 0) {
      display.getTracks().forEach((t) => t.stop())
      // Numa troca de fonte que deu errado, a fonte anterior continua valendo.
      if (!sysAttachedRef.current) setSystemAudioMissing(true)
      return false
    }

    // Trocando de fonte: descarta a captura anterior.
    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    displayStreamRef.current = display
    // Nao precisamos do video: encerra a faixa de video.
    display.getVideoTracks().forEach((t) => t.stop())

    const sysSource = ctx.createMediaStreamSource(new MediaStream(sysTracks))
    sysSource.connect(dest)
    sysSource.connect(analyser)

    const sysAnalyser = ctx.createAnalyser()
    sysAnalyser.fftSize = 512
    sysSource.connect(sysAnalyser)
    sysAnalyserRef.current = sysAnalyser
    sysHeardRef.current = false
    sysSilentSinceRef.current = null
    sysAttachedRef.current = true
    setSystemSilent(false)
    setSystemAudioMissing(false)

    // Se o usuario parar o compartilhamento pelo navegador, encerramos.
    sysTracks[0].onended = () => setEnded(true)
    return true
  }, [])

  /** Anexa (ou troca) o audio da reuniao com a gravacao ja rolando. */
  const addSystemAudio = useCallback(async (): Promise<boolean> => {
    if (!destRef.current) return false
    try {
      const display = await navigator.mediaDevices.getDisplayMedia(DISPLAY_OPTIONS)
      return attachDisplay(display)
    } catch {
      return false // usuario fechou o dialogo
    }
  }, [attachDisplay])

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
      setSystemAudioMissing(false)
      setSystemSilent(false)
      sysHeardRef.current = false
      sysSilentSinceRef.current = null
      sysAttachedRef.current = false
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyserRef.current = analyser

        // Microfone (sua voz). Mono: um mic estereo gastaria metade do bitrate com um canal
        // redundante. Os filtros de fala tambem ajudam o Whisper.
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        micStreamRef.current = mic
        ctx.createMediaStreamSource(mic).connect(analyser)

        let recordStream: MediaStream = mic

        if (opts?.system) {
          // A gravacao sai sempre do destino da mistura, mesmo antes de existir audio da reuniao.
          // E o que permite anexar a reuniao no meio da gravacao, sem trocar a faixa do recorder.
          const dest = ctx.createMediaStreamDestination()
          dest.channelCount = 1
          dest.channelCountMode = 'explicit'
          ctx.createMediaStreamSource(mic).connect(dest)
          destRef.current = dest
          recordStream = dest.stream

          // Audio da aba/sistema (a outra ponta da reuniao). Se o usuario nao marcar a caixa de
          // audio, ou fechar o dialogo, seguimos gravando so a voz dele: perder a reuniao
          // inteira seria pior. A tela avisa e oferece anexar o audio depois.
          try {
            attachDisplay(await navigator.mediaDevices.getDisplayMedia(DISPLAY_OPTIONS))
          } catch {
            setSystemAudioMissing(true)
          }
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
        // Timeslice de 1s: sem isso, o MediaRecorder so entrega dados no stop() -- se o
        // navegador travar/fechar/perder energia antes do usuario clicar em Encerrar, a
        // gravacao inteira se perderia (nada existe em memoria para salvar). Com o timeslice,
        // `snapshot()` sempre tem o audio capturado ate agora, permitindo checkpoints.
        recorder.start(1000)

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
    [attachDisplay, startTimer, tickLevel],
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
    destRef.current = null
    sysAnalyserRef.current = null
    sysAttachedRef.current = false
    setLevel(0)
  }, [])

  /** Retrata o audio capturado ATE AGORA, sem parar a gravacao -- usado para checkpoints
   *  periodicos (a gravacao so vira Blob final de verdade no stop()). */
  const snapshot = useCallback((): Blob | null => {
    if (!chunksRef.current.length) return null
    return new Blob(chunksRef.current, { type: mimeRef.current })
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

  return {
    state,
    seconds,
    level,
    error,
    ended,
    systemAudioMissing,
    systemSilent,
    start,
    addSystemAudio,
    pause,
    resume,
    stop,
    snapshot,
  }
}
