import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Delete, Square, ShieldAlert, Mic } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useRecorder } from '../lib/useRecorder'
import { db } from '../lib/api'
import { generateActionItems, generateSummary, transcribeAudio } from '../lib/ai'
import { fmtClock } from '../lib/format'
import { Sheet, Spinner } from '../components/ui'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

export function Dialer() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const recorder = useRecorder()
  const [number, setNumber] = useState('')
  const [inCall, setInCall] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [processing, setProcessing] = useState(false)

  function press(k: string) {
    setNumber((n) => (n + k).slice(0, 20))
  }
  function backspace() {
    setNumber((n) => n.slice(0, -1))
  }

  function requestCall() {
    if (!number.trim()) return
    setConsentOpen(true)
  }

  async function startCall() {
    setConsentOpen(false)
    // Abre o discador nativo do aparelho...
    window.location.href = `tel:${number.replace(/[^\d+*#]/g, '')}`
    // ...e inicia a gravacao por microfone (viva-voz).
    await recorder.start()
    setInCall(true)
  }

  async function endCall() {
    const res = await recorder.stop()
    setInCall(false)
    if (!profile) return
    setProcessing(true)
    try {
      await db.logUsage(profile.id, 'recording')
      const { transcript, language } = await transcribeAudio(res.blob)
      await db.logUsage(profile.id, 'transcription')
      const summary = await generateSummary(transcript)
      await db.logUsage(profile.id, 'ai_summary')
      const actionItems = await generateActionItems(transcript)
      const note = await db.createNote({
        user_id: profile.id,
        title: `Ligacao ${number}`,
        type: 'call',
        duration_seconds: res.durationSeconds,
        language,
        transcript,
        summary,
        action_items: actionItems,
        status: 'ready',
      })
      navigate(`/nota/${note.id}`, { replace: true })
    } finally {
      setProcessing(false)
    }
  }

  if (processing) {
    return (
      <div className="min-h-screen grid place-items-center px-8 text-center">
        <div>
          <Spinner size={30} className="text-brand-500 mx-auto mb-4" />
          <p className="font-display font-semibold">Processando a ligacao...</p>
          <p className="text-content-secondary text-sm mt-1">Transcrevendo e resumindo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-6 safe-top">
      <header className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl font-bold">Discador</h1>
      </header>

      {inCall ? (
        <div className="flex-1 flex flex-col items-center justify-center pb-20">
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-full bg-brand-500/25"
              style={{ transform: `scale(${1 + recorder.level * 0.8})`, transition: 'transform 80ms' }}
            />
            <div className="grid place-items-center h-24 w-24 rounded-full bg-brand-500 text-white relative">
              <Mic size={36} />
            </div>
          </div>
          <p className="font-display text-2xl font-bold">{number}</p>
          <p className="text-content-muted mt-1 mb-1">Gravando pelo microfone (viva-voz)</p>
          <p className="font-mono text-lg tabular-nums mb-10">{fmtClock(recorder.seconds)}</p>
          <button onClick={endCall} className="btn bg-brand-500 hover:bg-brand-600 text-white h-16 w-16 rounded-full p-0" aria-label="Encerrar">
            <Square size={26} />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-8">
            <input
              className="w-full bg-transparent text-center font-display text-3xl font-bold outline-none tracking-wide"
              placeholder="Digite o numero"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto w-full mt-auto">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className="h-16 rounded-full bg-surface-elevated border border-surface-border font-display text-2xl font-semibold hover:border-brand-500/40 transition-colors"
              >
                {k}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 my-8">
            <div className="w-16" />
            <button
              onClick={requestCall}
              disabled={!number.trim()}
              className="btn bg-green-600 hover:bg-green-700 text-white h-16 w-16 rounded-full p-0 disabled:opacity-40"
              aria-label="Ligar e gravar"
            >
              <Phone size={26} />
            </button>
            <button
              onClick={backspace}
              className="grid place-items-center h-16 w-16 text-content-muted hover:text-content-primary"
              aria-label="Apagar"
            >
              <Delete size={24} />
            </button>
          </div>
        </div>
      )}

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title="Aviso de gravacao">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert size={22} className="text-brand-500 shrink-0 mt-0.5" />
          <p className="text-content-secondary text-sm">
            A gravacao sera feita pelo microfone do aparelho (use o viva-voz). Por questoes legais
            (LGPD), informe e obtenha o consentimento da outra parte antes de gravar. Voce e
            responsavel pelo uso desta gravacao.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline flex-1" onClick={() => setConsentOpen(false)}>
            Cancelar
          </button>
          <button className="btn bg-green-600 hover:bg-green-700 text-white flex-1" onClick={startCall}>
            Ligar e gravar
          </button>
        </div>
      </Sheet>
    </div>
  )
}
