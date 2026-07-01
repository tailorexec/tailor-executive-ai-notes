import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mic, Pause, Play, Square, Upload, FileText, Link2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useRecorder } from '../lib/useRecorder'
import { db, config } from '../lib/api'
import { generateActionItems, generateSummary, transcribeAudio } from '../lib/ai'
import { saveAudio } from '../lib/audioStore'
import { fmtClock, fmtDuration } from '../lib/format'
import { Spinner } from '../components/ui'
import type { NoteSourceType } from '../lib/types'

type Mode = 'record' | 'upload' | 'file' | 'link'

const STEPS = ['Transcrevendo audio', 'Gerando resumo', 'Extraindo action items', 'Finalizando'] as const

export function Capture() {
  const [params] = useSearchParams()
  const mode = (params.get('mode') as Mode) || 'record'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const recorder = useRecorder()

  const [title, setTitle] = useState('')
  const [textInput, setTextInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const startedRef = useRef(false)

  const autoStoppedRef = useRef(false)

  useEffect(() => {
    if (mode === 'record' && !startedRef.current) {
      startedRef.current = true
      recorder.start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Encerra automaticamente ao atingir o limite de 2 horas.
  useEffect(() => {
    if (
      mode === 'record' &&
      recorder.seconds >= config.recordingMaxSeconds &&
      !autoStoppedRef.current
    ) {
      autoStoppedRef.current = true
      onStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.seconds])

  async function finalize(opts: {
    type: NoteSourceType
    transcript?: string
    duration?: number
    audioBlob?: Blob
    fallbackTitle: string
  }) {
    if (!profile) return
    setProcessing(true)
    setError(null)
    try {
      let transcript = opts.transcript ?? ''
      let language = 'pt-BR'

      if (opts.audioBlob) {
        setStep(0)
        await db.logUsage(profile.id, 'recording')
        const res = await transcribeAudio(opts.audioBlob)
        transcript = res.transcript
        language = res.language
        await db.logUsage(profile.id, 'transcription')
      }

      setStep(1)
      const summary = await generateSummary(transcript)
      await db.logUsage(profile.id, 'ai_summary')

      setStep(2)
      const actionItems = await generateActionItems(transcript)

      setStep(3)
      let note = await db.createNote({
        user_id: profile.id,
        title: title.trim() || opts.fallbackTitle,
        type: opts.type,
        duration_seconds: opts.duration ?? 0,
        language,
        transcript,
        summary,
        action_items: actionItems,
        status: 'ready',
      })

      // Persiste o audio (Supabase Storage no modo real, IndexedDB no modo demo).
      if (opts.audioBlob) {
        const ref = await saveAudio(note.id, profile.id, opts.audioBlob)
        if (ref) note = await db.updateNote(note.id, { audio_url: ref })
      }

      navigate(`/nota/${note.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar.')
      setProcessing(false)
    }
  }

  async function onStopRecording() {
    const res = await recorder.stop()
    await finalize({
      type: 'recording',
      audioBlob: res.blob,
      duration: res.durationSeconds,
      fallbackTitle: `Gravacao ${new Date().toLocaleDateString('pt-BR')}`,
    })
  }

  async function onUploadAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await finalize({
      type: 'upload',
      audioBlob: file,
      duration: 0,
      fallbackTitle: file.name.replace(/\.[^.]+$/, ''),
    })
  }

  async function onFileText(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isText = /\.(txt|md|csv)$/i.test(file.name)
    const content = isText ? await file.text() : ''
    await finalize({
      type: 'file',
      transcript: content || `Documento importado: ${file.name}. (Extracao de conteudo sera feita no servidor.)`,
      fallbackTitle: file.name.replace(/\.[^.]+$/, ''),
    })
  }

  async function onSubmitText() {
    if (!textInput.trim()) {
      setError('Cole um texto ou link para continuar.')
      return
    }
    await finalize({
      type: mode === 'link' ? 'link' : 'file',
      transcript: textInput.trim(),
      fallbackTitle: mode === 'link' ? 'Conteudo do link' : 'Nota de texto',
    })
  }

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center safe-top">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-pulse-ring" />
          <div className="grid place-items-center h-20 w-20 rounded-full bg-brand-500 text-white relative">
            <Spinner size={28} />
          </div>
        </div>
        <h2 className="font-display text-xl font-bold">{STEPS[step]}...</h2>
        <p className="text-content-secondary mt-2 max-w-xs">
          A IA esta processando sua nota. Isso leva apenas alguns segundos.
        </p>
        <div className="flex gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-surface-border'}`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-6 safe-top">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl font-bold">
          {mode === 'record' && 'Gravar audio'}
          {mode === 'upload' && 'Enviar audio'}
          {mode === 'file' && 'PDF, arquivo ou texto'}
          {mode === 'link' && 'Link da web'}
        </h1>
      </header>

      <div className="mb-6">
        <label className="label">Titulo (opcional)</label>
        <input
          className="input"
          placeholder="Ex: Reuniao comercial - Cliente X"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {mode === 'record' && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          {recorder.error ? (
            <p className="text-brand-400 text-center mb-6">{recorder.error}</p>
          ) : (
            <>
              <div className="relative mb-8">
                <div
                  className="absolute inset-0 rounded-full bg-brand-500/25"
                  style={{ transform: `scale(${1 + recorder.level * 0.8})`, transition: 'transform 80ms' }}
                />
                <div className="grid place-items-center h-28 w-28 rounded-full bg-brand-500 text-white relative">
                  <Mic size={40} />
                </div>
              </div>
              <p className="font-display text-4xl font-bold tabular-nums mb-2">{fmtClock(recorder.seconds)}</p>
              <p className="text-content-muted mb-1">
                {recorder.state === 'paused' ? 'Pausado' : 'Gravando...'}
              </p>
              {(() => {
                const remaining = config.recordingMaxSeconds - recorder.seconds
                const low = remaining <= 300
                return (
                  <p className={`mb-9 text-sm ${low ? 'text-brand-400 font-medium' : 'text-content-muted'}`}>
                    Limite de 2 horas • restam {fmtDuration(Math.max(0, remaining))}
                  </p>
                )
              })()}

              <div className="flex items-center gap-4">
                {recorder.state === 'recording' ? (
                  <button onClick={recorder.pause} className="btn-ghost h-14 w-14 rounded-full p-0">
                    <Pause size={22} />
                  </button>
                ) : (
                  <button onClick={recorder.resume} className="btn-ghost h-14 w-14 rounded-full p-0">
                    <Play size={22} />
                  </button>
                )}
                <button
                  onClick={onStopRecording}
                  className="btn-primary h-16 w-16 rounded-full p-0"
                  aria-label="Encerrar e processar"
                >
                  <Square size={24} />
                </button>
              </div>
              <p className="text-xs text-content-muted mt-8 max-w-xs text-center">
                Dica: em reunioes por telefone, use o viva-voz para captar melhor as duas vozes.
              </p>
            </>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full max-w-sm py-12 flex flex-col items-center gap-3 border-dashed hover:border-brand-500/50"
          >
            <Upload size={36} className="text-brand-500" />
            <p className="font-medium">Selecionar arquivo de audio</p>
            <p className="text-sm text-content-muted">MP3, M4A, WAV, WEBM</p>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onUploadAudio} />
        </div>
      )}

      {mode === 'file' && (
        <div className="flex-1 flex flex-col gap-4 pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full py-10 flex flex-col items-center gap-3 border-dashed hover:border-brand-500/50"
          >
            <FileText size={32} className="text-brand-500" />
            <p className="font-medium">Selecionar PDF, TXT, DOCX...</p>
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" className="hidden" onChange={onFileText} />
          <div className="text-center text-content-muted text-sm">ou cole o texto abaixo</div>
          <textarea
            className="input min-h-[160px] resize-none"
            placeholder="Cole aqui o texto a ser resumido..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button className="btn-primary" onClick={onSubmitText}>
            Processar texto
          </button>
        </div>
      )}

      {mode === 'link' && (
        <div className="flex-1 flex flex-col gap-4 pb-24">
          <div className="relative">
            <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              className="input pl-11"
              placeholder="https://..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={onSubmitText}>
            Resumir link
          </button>
          <p className="text-xs text-content-muted">
            A extracao do conteudo da pagina e feita no servidor (modo real).
          </p>
        </div>
      )}
    </div>
  )
}
