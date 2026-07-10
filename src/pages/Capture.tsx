import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mic,
  Image as ImageIcon,
  Pause,
  Play,
  Square,
  Upload,
  FileText,
  Link2,
  Video,
  MonitorSmartphone,
  Headphones,
  Info,
} from 'lucide-react'
import { extractFile, extractLink, FileError, TEXT_FILE_ACCEPT } from '../lib/extract'
import { IMAGE_ACCEPT, isSupportedImage, MAX_IMAGE_MB, prepareImage } from '../lib/image'
import { aiError } from '../lib/aiError'
import { useAuth } from '../auth/AuthProvider'
import { useRecorder, canCaptureSystemAudio, supportsTabAudio } from '../lib/useRecorder'
import { db, config } from '../lib/api'
import { generateActionItems, generateSummary, summarizeImage, transcribeAudio } from '../lib/ai'
import { saveAudio } from '../lib/audioStore'
import { isSilentAudio } from '../lib/audioLevel'
import { currentDevice } from '../lib/device'
import { fmtClock, fmtDuration } from '../lib/format'
import { Spinner } from '../components/ui'
import { ConsentSheet, RecordingNotice } from '../components/ConsentSheet'
import { hasRecordingConsent, setRecordingConsent } from '../lib/consent'
import { takePendingUpload } from '../lib/sharedFile'
import { bgRecorder, canRecordInBackground } from '../lib/bgRecorder'
import { TEMPLATES } from '../lib/templates'
import type { NoteSourceType } from '../lib/types'

type Mode = 'record' | 'meeting' | 'upload' | 'video' | 'file' | 'link' | 'image'

const MAX_VIDEO_MB = 25

const STEPS = ['Transcrevendo audio', 'Gerando resumo', 'Extraindo action items', 'Finalizando'] as const

export function Capture() {
  const [params] = useSearchParams()
  const mode = (params.get('mode') as Mode) || 'record'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const recorder = useRecorder()

  // Prefill via query (ex.: vindo de um evento do calendario).
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [template, setTemplate] = useState('geral')
  const [context, setContext] = useState(params.get('context') ?? '')
  const [diarize, setDiarize] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageWords, setImageWords] = useState(150)
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const autoStoppedRef = useRef(false)
  const isAudioMode = mode === 'record' || mode === 'meeting'
  // No web-mobile a captura do audio interno nao existe: mostramos so um aviso, sem formulario.
  const meetingBlocked = mode === 'meeting' && !canCaptureSystemAudio()

  // Aviso de gravacao: exibido uma vez por usuario, antes da primeira gravacao.
  const [consentOpen, setConsentOpen] = useState(false)
  const pendingStartRef = useRef<null | (() => Promise<void>)>(null)

  /** Garante o aceite do aviso antes de iniciar qualquer captura de audio. */
  function withConsent(start: () => Promise<void>) {
    if (hasRecordingConsent(profile?.id)) {
      void start()
      return
    }
    pendingStartRef.current = start
    setConsentOpen(true)
  }

  function acceptConsent() {
    setRecordingConsent(profile?.id)
    setConsentOpen(false)
    const start = pendingStartRef.current
    pendingStartRef.current = null
    if (start) void start()
  }

  // No APK Android o modo microfone usa o gravador NATIVO: sobrevive a tela apagada.
  // (Gravar Meet continua no navegador — depende do getDisplayMedia.)
  const useNative = canRecordInBackground() && mode === 'record'
  const [nState, setNState] = useState<'idle' | 'recording' | 'paused'>('idle')
  const [nSecs, setNSecs] = useState(0)

  useEffect(() => {
    if (!useNative || nState === 'idle') return
    const id = setInterval(() => {
      bgRecorder
        .status()
        .then((s) => setNSecs(s.seconds))
        .catch(() => {})
    }, 1000)
    return () => clearInterval(id)
  }, [useNative, nState])

  // Estado unificado (nativo ou navegador) usado pela UI.
  const recState = useNative ? nState : recorder.state
  const recSeconds = useNative ? nSecs : recorder.seconds
  const recLevel = useNative ? 0 : recorder.level

  /**
   * Gravando (ou pausado): o formulario sai da tela. Ele so servia antes de comecar e,
   * montado, empurrava o cronometro e os botoes de pausar/parar para baixo da dobra.
   */
  const recActive = isAudioMode && recState !== 'idle' && !recorder.error

  async function startRecord() {
    autoStoppedRef.current = false
    if (useNative) {
      await bgRecorder.start()
      setNState('recording')
      setNSecs(0)
      return
    }
    await recorder.start()
  }

  async function togglePause() {
    if (useNative) {
      if (nState === 'recording') {
        await bgRecorder.pause()
        setNState('paused')
      } else {
        await bgRecorder.resume()
        setNState('recording')
      }
      return
    }
    if (recorder.state === 'recording') recorder.pause()
    else recorder.resume()
  }

  // Encerra automaticamente ao atingir o limite de 2 horas (nativo ou navegador).
  useEffect(() => {
    if (
      isAudioMode &&
      recState === 'recording' &&
      recSeconds >= config.recordingMaxSeconds &&
      !autoStoppedRef.current
    ) {
      autoStoppedRef.current = true
      onStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recSeconds])

  // Reuniao: se o usuario parar o compartilhamento pelo navegador, finaliza.
  useEffect(() => {
    if (recorder.ended && !autoStoppedRef.current) {
      autoStoppedRef.current = true
      onStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.ended])

  // Arquivo vindo do menu "Compartilhar" do Android: processa direto, sem o usuario
  // precisar escolher de novo. Nao mostra o aviso de gravacao (nos nao gravamos nada aqui).
  const sharedHandledRef = useRef(false)
  useEffect(() => {
    if (params.get('shared') !== '1' || sharedHandledRef.current || !profile) return
    const file = takePendingUpload()
    if (!file) return
    sharedHandledRef.current = true
    const isVideo = file.type.startsWith('video/')
    void finalize({
      type: isVideo ? 'video' : 'upload',
      audioBlob: file,
      duration: 0,
      fallbackTitle: file.name.replace(/\.[^.]+$/, '') || 'Audio compartilhado',
      skipAudioStore: isVideo,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function finalize(opts: {
    type: NoteSourceType
    transcript?: string
    duration?: number
    audioBlob?: Blob
    fallbackTitle: string
    skipAudioStore?: boolean
    /** Resumo ja pronto (ex.: visao de imagem): evita uma segunda chamada paga a IA. */
    summary?: string
    /** Conteudo sem action items (imagem): pula mais uma chamada. */
    skipActionItems?: boolean
  }) {
    if (!profile) return
    setProcessing(true)
    setError(null)
    try {
      let transcript = opts.transcript ?? ''
      let language = 'pt-BR'

      if (opts.audioBlob) {
        setStep(0)
        // Evita transcricao "alucinada" quando a gravacao ficou muda.
        if (mode !== 'video' && (await isSilentAudio(opts.audioBlob))) {
          setError(
            'Nao captamos audio suficiente (gravacao silenciosa). Verifique o microfone e o viva-voz, e tente novamente.',
          )
          setProcessing(false)
          return
        }
        await db.logUsage(profile.id, 'recording')
        const res = await transcribeAudio(opts.audioBlob, { diarize })
        transcript = res.transcript
        language = res.language
        await db.logUsage(profile.id, 'transcription')
      }

      const meta = { template, context }

      setStep(1)
      let summary = opts.summary
      if (!summary) {
        summary = await generateSummary(transcript, meta)
        await db.logUsage(profile.id, 'ai_summary')
      }

      setStep(2)
      const actionItems = opts.skipActionItems ? [] : await generateActionItems(transcript, meta)

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
      setError(aiError(err, 'Falha ao processar. Tente novamente.'))
      setProcessing(false)
    }
  }

  async function onStopRecording() {
    const today = new Date().toLocaleDateString('pt-BR')

    if (useNative) {
      try {
        const res = await bgRecorder.stop()
        setNState('idle')
        await finalize({
          type: 'recording',
          audioBlob: res.blob,
          duration: res.durationSeconds,
          fallbackTitle: `Gravacao ${today}`,
        })
      } catch {
        setNState('idle')
        setError('Nao foi possivel finalizar a gravacao. Tente novamente.')
      }
      return
    }

    const res = await recorder.stop()
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
    setError(null)
    if (!file.type.startsWith('audio/')) {
      setError('Este arquivo nao e um audio. Envie MP3, M4A, WAV, WEBM ou OGG.')
      return
    }
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
    setError(null)
    if (!file.type.startsWith('video/')) {
      setError('Este arquivo nao e um video. Envie MP4, MOV, WEBM ou MKV.')
      return
    }
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
    setSelectedFile(file)
    const isText = /\.(txt|md|csv)$/i.test(file.name)
    setTextInput(isText ? await file.text() : '')
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!isSupportedImage(file)) {
      setError('Formato nao suportado. Envie PNG, JPG, WEBP ou GIF.')
      return
    }
    setFileName(file.name)
    setSelectedFile(file)
  }

  /** Le a imagem com a IA de visao (transcreve texto fotografado e resume). */
  async function onSubmitImage() {
    if (!selectedFile) {
      setError('Selecione uma imagem.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const prepared = await prepareImage(selectedFile)
      const summary = await summarizeImage(prepared, { maxWords: imageWords, context })
      setSubmitting(false)
      // A visao ja devolveu o texto e o resumo: nao ha por que pagar outra chamada.
      await finalize({
        type: 'image',
        transcript: summary,
        summary,
        skipActionItems: true,
        fallbackTitle: fileName?.replace(/\.[^.]+$/, '') || 'Resumo de imagem',
      })
    } catch (err) {
      setSubmitting(false)
      setError(aiError(err, err instanceof Error ? err.message : 'Nao consegui ler esta imagem.'))
    }
  }

  async function onSubmitText() {
    setError(null)
    let content = textInput.trim()
    if (mode === 'link') {
      if (!/^https?:\/\//i.test(content)) {
        setError('Informe uma URL valida (comecando com http:// ou https://).')
        return
      }
    } else if (!content && !selectedFile) {
      setError('Selecione um arquivo ou cole um texto para continuar.')
      return
    }

    // Extracao real (link no servidor; PDF/DOCX no navegador).
    setSubmitting(true)
    try {
      if (mode === 'link') {
        content = await extractLink(content)
      } else if (!content && selectedFile) {
        content = await extractFile(selectedFile)
      }
    } catch (err) {
      setSubmitting(false)
      // FileError ja carrega um texto pronto para o usuario; o resto vira mensagem generica.
      setError(
        err instanceof FileError
          ? err.message
          : 'Nao consegui extrair o conteudo deste arquivo. Verifique o formato e tente de novo.',
      )
      return
    }
    setSubmitting(false)

    if (!content.trim()) {
      setError('Nao consegui extrair texto deste conteudo.')
      return
    }

    await finalize({
      type: mode === 'link' ? 'link' : 'file',
      transcript: content,
      fallbackTitle:
        mode === 'link'
          ? 'Resumo do link'
          : fileName?.replace(/\.[^.]+$/, '') || 'Nota de texto',
    })
  }

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center safe-top">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-ring" />
          <div className="grid place-items-center h-20 w-20 rounded-full bg-brand-solid text-white relative">
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
              className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-brand-solid' : 'bg-surface-border'}`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col px-5 safe-top safe-bottom-2">
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
          {mode === 'meeting' && 'Gravar Meet'}
          {mode === 'upload' && 'Enviar audio'}
          {mode === 'video' && 'Enviar video'}
          {mode === 'file' && 'PDF, arquivo ou texto'}
          {mode === 'image' && 'Resumir imagem'}
          {mode === 'link' && 'Link da web'}
        </h1>
      </header>

      {mode !== 'link' && !meetingBlocked && !recActive && (
        <div className="mb-4">
          <label className="label">Título (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Conversa com Cliente X"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      )}

      {(mode === 'record' || mode === 'meeting' || mode === 'upload') && !meetingBlocked && !recActive && (
        <div className="mb-4">
          <label className="label">{mode === 'upload' ? 'Tema do áudio (opcional)' : 'Tema (opcional)'}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  template === t.id
                    ? 'bg-brand-solid border-brand-solid text-white'
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

      {!meetingBlocked && !recActive && (
        <div className="mb-3">
          <label className="label">Contexto (opcional)</label>
          <input
            className="input"
            placeholder="Ex: cliente X, renovação de contrato"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
      )}

      {!meetingBlocked && !recActive && (
        <p className="text-xs text-content-muted mb-6">
          Todos os campos acima sao <span className="text-content-secondary font-medium">opcionais</span>. Se
          nao preencher, a IA gera a transcricao e o resumo normalmente, sem contexto previo.
        </p>
      )}

      {(mode === 'record' || mode === 'meeting' || mode === 'upload') && !meetingBlocked && !recActive && (
        <button
          type="button"
          onClick={() => setDiarize((v) => !v)}
          className="w-full flex items-center gap-3 card px-4 py-3 mb-6 text-left"
        >
          <span
            className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${diarize ? 'bg-brand-solid' : 'bg-surface-border'}`}
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
        <div className="alert-error mb-4">
          {error}
        </div>
      )}

      {isAudioMode && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          {mode === 'meeting' && recorder.state === 'idle' && !recorder.error ? (
            !canCaptureSystemAudio() ? (
              <div className="card p-6 text-center max-w-sm">
                <MonitorSmartphone size={36} className="text-accent mx-auto mb-3" />
                <h3 className="font-display font-semibold text-lg">Disponível apenas no computador</h3>
                <p className="text-content-secondary mt-2 text-sm">
                  Gravar o <span className="text-content-primary font-medium">Meet</span> (e Zoom/Teams) captura o
                  {' '}<span className="text-content-primary font-medium">áudio da reunião + seu microfone</span> juntos.
                  Nenhum celular permite isso: o sistema não deixa um aplicativo capturar o áudio de outro.
                  Use o <span className="text-content-primary font-medium">navegador do computador</span> (Chrome ou Edge).
                </p>
                <button className="btn-outline mt-5 mx-auto" onClick={() => navigate('/capturar?mode=record')}>
                  <Mic size={18} /> Gravar só pelo microfone
                </button>
              </div>
            ) : (
              <div className="card p-6 max-w-md">
                <Headphones size={32} className="text-accent mb-3" />
                <h3 className="font-display font-semibold text-lg">Gravar a reunião (mesmo de fone)</h3>
                <ol className="text-content-secondary text-sm mt-3 space-y-2 list-decimal list-inside">
                  <li>Abra sua reunião (Zoom, Meet ou Teams) em uma aba/janela.</li>
                  <li>Clique em "Iniciar" abaixo e escolha a aba da reunião (ou a tela toda).</li>
                  <li>
                    <span className="text-content-primary font-medium">Marque "Compartilhar áudio"</span> no
                    diálogo do navegador.
                  </li>
                </ol>

                {/* Navegadores suportados: so Chromium entrega o audio da aba. */}
                {supportsTabAudio() ? (
                  <p className="text-xs text-content-muted mt-3 flex items-start gap-1.5">
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      Funciona no <span className="text-content-secondary font-medium">Chrome, Edge, Opera e Brave</span>.
                      No <span className="text-content-secondary font-medium">Safari</span> e no{' '}
                      <span className="text-content-secondary font-medium">Firefox</span> o navegador não entrega o áudio
                      da aba — a gravação sairia só com o seu microfone.
                    </span>
                  </p>
                ) : (
                  <div className="alert-error text-xs mt-3">
                    Seu navegador não entrega o áudio da aba. Abra o ANA no{' '}
                    <span className="font-medium">Chrome</span> ou no <span className="font-medium">Edge</span> para
                    gravar a reunião — aqui a gravação sairia só com o seu microfone.
                  </div>
                )}

                <p className="text-xs text-content-muted mt-3">
                  Gravamos o áudio da reunião + seu microfone juntos. Nada de vídeo é enviado.
                </p>
                <button
                  className="btn-primary w-full mt-5"
                  onClick={() => withConsent(startMeeting)}
                  disabled={!supportsTabAudio()}
                >
                  <Headphones size={18} /> Iniciar gravacao da reuniao
                </button>
              </div>
            )
          ) : mode === 'record' && recState === 'idle' && !recorder.error ? (
            <div className="card p-6 text-center max-w-sm">
              <div className="grid place-items-center h-16 w-16 rounded-full bg-brand-solid text-white mx-auto mb-4">
                <Mic size={30} />
              </div>
              <h3 className="font-display font-semibold text-lg">Pronto para gravar</h3>
              <p className="text-content-secondary mt-2 text-sm">
                Preencha titulo, tema e contexto acima (opcionais) e inicie quando quiser.
              </p>
              {useNative && (
                <p className="text-xs text-accent mt-2">
                  A gravacao continua mesmo com a tela apagada.
                </p>
              )}
              <button className="btn-primary w-full mt-5" onClick={() => withConsent(startRecord)}>
                <Mic size={18} /> Iniciar gravacao
              </button>
            </div>
          ) : recorder.error ? (
            <div className="text-center max-w-sm">
              <p className="text-accent mb-4">{recorder.error}</p>
              <button className="btn-primary mx-auto" onClick={() => withConsent(mode === 'meeting' ? startMeeting : startRecord)}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {/* Pausar a esquerda do botao de gravacao, encerrar a direita. */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <button
                  onClick={togglePause}
                  className="btn-ghost h-14 w-14 rounded-full p-0 shrink-0"
                  aria-label={recState === 'recording' ? 'Pausar' : 'Retomar'}
                >
                  {recState === 'recording' ? <Pause size={22} /> : <Play size={22} />}
                </button>

                <div className="relative shrink-0">
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-accent/25 pointer-events-none"
                    style={{ transform: `scale(${1 + recLevel * 0.35})`, transition: 'transform 80ms' }}
                  />
                  <div className="grid place-items-center h-28 w-28 rounded-full bg-brand-solid text-white relative">
                    {mode === 'meeting' ? <Headphones size={40} /> : <Mic size={40} />}
                  </div>
                </div>

                <button
                  onClick={onStopRecording}
                  className="btn-primary h-14 w-14 rounded-full p-0 shrink-0"
                  aria-label="Encerrar e processar"
                >
                  <Square size={24} />
                </button>
              </div>
              <p className="font-display text-4xl font-bold tabular-nums mb-2">{fmtClock(recSeconds)}</p>
              <p className="text-content-muted mb-1">
                {recState === 'paused'
                  ? 'Pausado'
                  : mode === 'meeting'
                    ? 'Gravando reuniao (aba + microfone)...'
                    : 'Gravando...'}
              </p>
              {(() => {
                const remaining = config.recordingMaxSeconds - recSeconds
                const low = remaining <= 300
                return (
                  <p className={`mb-4 text-sm ${low ? 'text-accent font-medium' : 'text-content-muted'}`}>
                    Limite de 2 horas • restam {fmtDuration(Math.max(0, remaining))}
                  </p>
                )
              })()}

              <p className="text-xs text-content-muted mt-2 max-w-xs text-center">
                {mode === 'meeting'
                  ? 'Mantenha a aba da reuniao aberta. Encerrar aqui ou "Parar compartilhamento" finaliza a gravacao.'
                  : 'Dica: em reunioes por telefone, use o viva-voz para captar melhor as duas vozes.'}
              </p>
              <RecordingNotice />
            </>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full max-w-sm py-12 flex flex-col items-center gap-3 border-dashed hover:border-accent/50"
          >
            <Upload size={36} className="text-accent" />
            <p className="font-medium">Selecionar arquivo de áudio</p>
            <p className="text-sm text-content-muted">MP3, M4A, WAV, WEBM</p>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onUploadAudio} />
        </div>
      )}

      {mode === 'video' && (
        <div className="flex-1 flex flex-col items-center justify-center pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full max-w-sm py-12 flex flex-col items-center gap-3 border-dashed hover:border-accent/50"
          >
            <Video size={36} className="text-accent" />
            <p className="font-medium">Selecionar vídeo</p>
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
            className="card w-full py-10 flex flex-col items-center gap-3 border-dashed hover:border-accent/50"
          >
            <FileText size={32} className="text-accent" />
            <p className="font-medium">{fileName ? 'Trocar arquivo' : 'Selecionar PDF, TXT, DOCX...'}</p>
            {fileName && <p className="text-sm text-content-secondary">{fileName}</p>}
          </button>
          <input ref={fileRef} type="file" accept={TEXT_FILE_ACCEPT} className="hidden" onChange={onFileText} />
          {fileName && (
            <p className="text-xs text-content-muted -mt-1">
              Arquivo selecionado. O texto do PDF/DOCX e extraido ao clicar em "Processar".
            </p>
          )}
          <div className="text-center text-content-muted text-sm">ou cole o texto abaixo</div>
          <textarea
            className="input min-h-[160px] resize-none"
            placeholder="Cole aqui o texto a ser resumido..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button className="btn-primary" onClick={onSubmitText} disabled={submitting}>
            {submitting ? <Spinner size={18} /> : null}
            {submitting ? 'Extraindo...' : 'Processar'}
          </button>
        </div>
      )}

      {mode === 'image' && (
        <div className="flex-1 flex flex-col gap-4 pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="card w-full py-10 flex flex-col items-center gap-3 border-dashed hover:border-accent/50"
          >
            <ImageIcon size={32} className="text-accent" />
            <p className="font-medium">{fileName ? 'Trocar imagem' : 'Selecionar imagem'}</p>
            <p className="text-sm text-content-muted">PNG, JPG, WEBP, GIF • ate {MAX_IMAGE_MB} MB</p>
            {fileName && <p className="text-sm text-content-secondary truncate max-w-full px-4">{fileName}</p>}
          </button>
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onPickImage} />

          <div>
            <label className="label">Tamanho do resumo</label>
            <div className="flex flex-wrap gap-2">
              {[
                { w: 80, label: 'Curto' },
                { w: 150, label: 'Medio' },
                { w: 300, label: 'Longo' },
              ].map((o) => (
                <button
                  key={o.w}
                  type="button"
                  onClick={() => setImageWords(o.w)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    imageWords === o.w
                      ? 'bg-brand-solid border-brand-solid text-white'
                      : 'bg-surface-elevated border-surface-border text-content-secondary'
                  }`}
                >
                  {o.label} • {o.w} palavras
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-content-muted flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Se a imagem tiver texto (documento, print, foto de pagina), a IA transcreve o texto e depois
              resume. A imagem nao e armazenada.
            </span>
          </p>

          <button className="btn-primary" onClick={onSubmitImage} disabled={submitting || !selectedFile}>
            {submitting ? <Spinner size={18} /> : null}
            {submitting ? 'Lendo imagem...' : 'Resumir imagem'}
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
          <button className="btn-primary" onClick={onSubmitText} disabled={submitting}>
            {submitting ? <Spinner size={18} /> : null}
            {submitting ? 'Extraindo...' : 'Resumir link'}
          </button>
          <p className="text-xs text-content-muted">
            A IA abre a pagina, extrai o conteudo principal e gera o resumo.
          </p>
        </div>
      )}

      <ConsentSheet
        open={consentOpen}
        onAccept={acceptConsent}
        onClose={() => {
          pendingStartRef.current = null
          setConsentOpen(false)
        }}
      />
    </div>
  )
}
