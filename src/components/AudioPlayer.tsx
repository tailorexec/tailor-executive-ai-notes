import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react'
import { getAudioUrl } from '../lib/audioStore'
import { fmtClock } from '../lib/format'
import { Spinner } from './ui'

const SPEEDS = [1, 1.25, 1.5, 2]

export function AudioPlayer({ audioRef }: { audioRef: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(0)
  const el = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let objUrl: string | null = null
    getAudioUrl(audioRef).then((u) => {
      objUrl = u && u.startsWith('blob:') ? u : null
      setUrl(u)
      setLoading(false)
    })
    return () => {
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [audioRef])

  function toggle() {
    const a = el.current
    if (!a) return
    if (playing) a.pause()
    else a.play()
  }

  function skip(sec: number) {
    const a = el.current
    if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + sec), a.duration || 0)
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (el.current) el.current.playbackRate = SPEEDS[next]
  }

  if (loading)
    return (
      <div className="card p-4 grid place-items-center h-24">
        <Spinner className="text-brand-500" />
      </div>
    )

  if (!url)
    return (
      <div className="card p-4 text-sm text-content-muted text-center">
        Audio nao disponivel para reproducao.
      </div>
    )

  return (
    <div className="card p-4">
      <audio
        ref={el}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={current}
        step={0.1}
        onChange={(e) => {
          if (el.current) el.current.currentTime = Number(e.target.value)
        }}
        className="w-full accent-brand-500 mb-2"
        aria-label="Progresso do audio"
      />
      <div className="flex items-center justify-between text-xs text-content-muted mb-3 tabular-nums">
        <span>{fmtClock(current)}</span>
        <span>{fmtClock(duration)}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => skip(-10)} className="grid place-items-center h-11 w-11 rounded-full bg-surface-elevated text-content-secondary" aria-label="Voltar 10s">
          <RotateCcw size={20} />
        </button>
        <button onClick={toggle} className="btn-primary h-14 w-14 rounded-full p-0" aria-label={playing ? 'Pausar' : 'Reproduzir'}>
          {playing ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button onClick={() => skip(10)} className="grid place-items-center h-11 w-11 rounded-full bg-surface-elevated text-content-secondary" aria-label="Avancar 10s">
          <RotateCw size={20} />
        </button>
        <button onClick={cycleSpeed} className="grid place-items-center h-11 min-w-11 px-3 rounded-full bg-surface-elevated text-content-secondary font-semibold text-sm" aria-label="Velocidade">
          {SPEEDS[speedIdx]}x
        </button>
      </div>
    </div>
  )
}
