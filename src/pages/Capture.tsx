import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mic,
  Pause,
  Play,
  Square,
  Upload,
  FileText,
  Link2,
  Video,
  MonitorSmartphone,
  Headphones,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useRecorder, canCaptureSystemAudio } from '../lib/useRecorder'
import { db, config } from '../lib/api'
import { generateActionItems, generateSummary, transcribeAudio } from '../lib/ai'
import { saveAudio } from '../lib/audioStore'
import { currentDevice } from '../lib/device'
import { fmtClock, fmtDuration } from '../lib/format'
import { Spinner } from '../components/ui'
import { TEMPLATES } from '../lib/templates'
import type { NoteSourceType } from '../lib/types'

type Mode = 'record' | 'meeting' | 'upload' | 'video' | 'file' | 'link'

const MAX_VIDEO_MB = 25

const STEPS = ['Transcrevendo audio', 'Gerando resumo', 'Extraindo action items', 'Finalizando'] as const

export function Capture() {
  const [params] = useSearchParams()
  const mode = (params.get('mode') as Mode) || 'record'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const recorder = useRecorder()

  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState('geral')
  const [context, setContext] = useState('')
  const [diarize, setDiarize] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const autoStoppedRef = useRef(false)
  const isAudioMode = mode === 'record' || mode === 'meeting'

  async function startRecord() {
    autoStoppedRef.current = false
    await recorder.start()
  }

  // Encerra automaticamente ao atingir o limite de 2 horas.
  useEffect(() => {
    if (
      isAudioMode &&
      recorder.state === 'recording' &&
      recorder.seconds >= config.recordingMaxSeconds &&
      !autoStoppedRef.current
    ) {
      autoStoppedRef.current = true
      onStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.seconds])

  // Reuniao: se o usuario parar o compartilhamento pelo navegador, finaliza.
  useEffect(() => {
    if (recorder.ended && !autoStoppedRef.current) {
      autoStoppedRef.current = true
      onStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.ended])

  async function finalize(opts: {
    type: NoteSourceType
    transcript?: string
    duration?: number
    audioBlob?: Blob
    fallbackTitle: string
    skipAudioStore?: boolean
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
        const res = await transcribeAudio(opts.audioBlob, { diarize })
        transcript = res.transcript
        language = res.language
        await db.logUsage(profile.id, 'transcription')
      }

      const meta = { template, context }

      setStep(1)
      const summary = await generateSummary(transcript, meta)
      await db.logUsage(profile.id, 'ai_summary')

      setStep(2)
      const actionItems = await generateActionItems(transcript, meta)

      setStep(3)
      let note = await db.createNote({
        user_id: profile.id,
        title: title.trim() || opts.fallbackTitle,
        type: opts.type,
        device: currentDevice(),
        template,
        context,
        duration_seconds: opts.duration ?? 0,
        language,
        transcript,
        summary,
        action_items: actionItems,
        status: 'ready',
      })

      // Persiste o audio (exceto video: o video e descartado apos extrair o audio).
      if (opts.audioBlob && !opts.skipAudioStore) {
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
    const today = new Date().toLocaleDateString('pt-BR')
    await finalize({
      type: 'recording',
      audioBlob: res.blob,
      duration: res.durationSeconds,
      fallbackTitle: mode === 'meeting' ? `Reuniao ${today}` : `Gravacao ${today}`,
    })
  }

  async function startMeeting() {
    autoStoppedRef.current = false
    await recorder.start({ system: true })
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

  async function onUploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video muito grande. Limite de ${MAX_VIDEO_MB} MB (a IA extrai apenas o audio).`)
      return
    }
    // Envia o video: o provedor extrai o audio para transcrever. O video NAO e armazenado.
    await finalize({
      type: 'video',
      audioBlob: file,
      duration: 0,
      fallbackTitle: file.name.replace(/\.[^.]+$/, ''),
      skipAudioStore: true,
    })
  }

  // Apenas CARREGA o arquivo (nao processa). O processamento so ocorre ao clicar em "Processar".
  async function onFileText(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setFileName(file.name)
    const isText = /\.(txt|md|csv)$/i.test(file.name)
    setTextInput(isText ? await file.text() : '')
  }

  async function onSubmitText() {
    const content = textInput.trim()
    if (!content && !fileName) {
      setError('Selecione um arquivo ou cole um texto para continuar.')
      return
    }
    await finalize({
      type: mode === 'link' ? 'link' : 'file',
      transcript:
        content ||
        `Documento importado: ${fileName}. (Extracao de conteudo sera feita no servidor.)`,
      fallbackTitle: mode === 'link' ? 'Conteudo do link' : fileName?.replace(/\.[^.]+$/, '') || 'Nota de texto',
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
          {mode === 'meeting' && 'Gravar reuniao'}
          {mode === 'upload' && 'Enviar audio'}
          {mode === 'video' && 'Enviar video'}
          {mode === 'file' && 'PDF, arquivo ou texto'}
          {mode === 'link' && 'Link da web'}
        </h1>
      </header>

      {mode !== 'link' && (
        <div className="mb-4">
          <label className="label">Titulo (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Conversa com Cliente X"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      )}

      {(mode === 'record' || mode === 'meeting' || mode === 'upload') && (
        <div className="mb-4">
          <label className="label">{mode === 'upload' ? 'Tema do audio (opcional)' : 'Tema (opcional)'}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  template === t.id
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : 'bg-surface-elevated border-surface-border text-content-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-content-muted">
            {TEMPLATES.find((t) => t.id === template)?.hint}
          </p>
        </div>
      )}

      <div className="mb-3">
        <label className="label">Contexto (opcional)</label>
        <input
          className="input"
          placeholder="Ex: cliente X, renovacao de contrato"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <p className="text-xs text-content-muted mb-6">
        Todos os campos acima sao <span className="text-content-secondary font-medium">opcionais</span>. Se
        nao preencher, a IA gera a transcricao e o resumo normalmente, sem contexto previo.
      </p>

      {(mode === 'record' || mode === 'meeting' || mode === 'upload') && (
        <button
          type="button"
          onClick={() => setDiarize((v) => !v)}
          className="w-full flex items-center gap-3 card px-4 py-3 mb-6 text-left"
        >
          <span
            className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${diarize ? 'bg-brand-500' : 'bg-surface-border'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${diarize ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-sm">Identificar quem falou</span>
            <span className="block text-xs text-content-muted">
              Separa os falantes na transcricao. Mais preciso, com custo um pouco maior.
            </span>
          </span>
        </button>
      )}

      {error && (
        <div className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {isAudioMode && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          {mode === 'meeting' && recorder.state === 'idle' && !recorder.error ? (
            !canCaptureSystemAudio() ? (
              <div className="card p-6 text-center max-w-sm">
                <MonitorSmartphone size={36} className="text-brand-500 mx-auto mb-3" />
                <h3 className="font-display font-semibold text-lg">Disponivel no desktop</h3>
                <p className="text-content-secondary mt-2 text-sm">
                  A captura do audio interno da reuniao (com fone) funciona no computador (Chrome/Edge).
                  No celular, isso chega na versao app. Aqui voce pode usar "Gravar audio" pelo microfone.
                </p>
                <button className="btn-outline mt-5 mx-auto" onClick={() => navigate('/capturar?mode=record')}>
                  <Mic size={18} /> Gravar pelo microfone
                </button>
              </div>
            ) : (
              <div className="card p-6 max-w-md">
                <Headphones size={32} className="text-brand-500 mb-3" />
                <h3 className="font-display font-semibold text-lg">Gravar a reuniao (mesmo de fone)</h3>
                <ol className="text-content-secondary text-sm mt-3 space-y-2 list-decimal list-inside">
                  <li>Abra sua reuniao (Zoom, Meet ou Teams) em uma aba/janela.</li>
                  <li>Clique em "Iniciar" abaixo e escolha a aba da reuniao (ou a tela toda).</li>
                  <li>
                    <span className="text-content-primary font-medium">Marque "Compartilhar audio"</span> no
                    dialogo do navegador.
                  </li>
                </ol>
                <p className="text-xs text-content-muted mt-3">
                  Gravamos o audio da reuniao + seu microfone juntos. Nada de video e enviado.
                </p>
                <button className="btn-primary w-full mt-5" onClick={startMeeting}>
                  <Headphones size={18} /> Iniciar gravacao da reuniao
                </button>
              </div>
            )
          ) : mode === 'record' && recorder.state === 'idle' && !recorder.error ? (
            <div className="card p-6 text-center max-w-sm">
              <div className="grid place-items-center h-16 w-16 rounded-full bg-brand-500/10 text-brand-500 mx-auto mb-4">
                <Mic size={30} />
              </div>
              <h3 className="font-display font-semibold text-lg">Pronto para gravar</h3>
              <p className="text-content-secondary mt-2 text-sm">
                Preencha titulo, tema e contexto acima (opcionais) e inicie quando quiser.
              </p>
              <button className="btn-primary w-full mt-5" onClick={startRecord}>
                <Mic size={18} /> Iniciar gravacao
              </button>
            </div>
          ) : recorder.error ? (
            <div className="text-center max-w-sm">
              <p className="text-brand-400 mb-4">{recorder.error}</p>
              <button className="btn-primary mx-auto" onClick={mode === 'meeting' ? startMeeting : startRecord}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-8">
                <div
                  className="absolute inset-0 rounded-full bg-brand-500/25"
                  style={{ transform: `scale(${1 + recorder.level * 0.8})`, transition: 'transform 80ms' }}
                />
                <div className="grid place-items-center h-28 w-28 rounded-full bg-brand-500 text-white relative">
                  {mode === 'meeting' ? <Headphones size={40} /> : <Mic size={40} />}
                </div>
              </div>
              <p className="font-display text-4xl font-bold tabular-nums mb-2">{fmtClock(recorder.seconds)}</p>
              <p className="text-content-muted mb-1">
                {recorder.state === 'paused'
                  ? 'Pausado'
                  : mode === 'meeting'
                    ? 'Gravando reuniao (aba + microfone)...'
                    : 'Gravando...'}
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
                {mode === 'meeting'
                  ? 'Mantenha a aba da reuniao aberta. Encerrar aqui ou "Parar compartilhamento" finaliza a gravacao.'
                  : 'Dica: em reunioes por telefone, use o viva-voz para captar melhor as duas vozes.'}
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

      {mode === 'video' && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full max-w-sm py-12 flex flex-col items-center gap-3 border-dashed hover:border-brand-500/50"
          >
            <Video size={36} className="text-brand-500" />
            <p className="font-medium">Selecionar video</p>
            <p className="text-sm text-content-muted">MP4, MOV, WEBM • ate {MAX_VIDEO_MB} MB</p>
          </button>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo} />
          <p className="text-xs text-content-muted mt-4 max-w-xs text-center">
            A IA extrai apenas o audio para transcrever. O video nao e armazenado.
          </p>
        </div>
      )}

      {mode === 'file' && (
        <div className="flex-1 flex flex-col gap-4 pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full py-10 flex flex-col items-center gap-3 border-dashed hover:border-brand-500/50"
          >
            <FileText size={32} className="text-brand-500" />
            <p className="font-medium">{fileName ? 'Trocar arquivo' : 'Selecionar PDF, TXT, DOCX...'}</p>
            {fileName && <p className="text-sm text-content-secondary">{fileName}</p>}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" className="hidden" onChange={onFileText} />
          {fileName && (
            <p className="text-xs text-content-muted -mt-1">
              Arquivo selecionado. Revise o texto (se aplicavel) e clique em "Processar" — nada e gerado antes disso.
            </p>
          )}
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
