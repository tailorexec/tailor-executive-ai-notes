import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Delete, Square, ShieldAlert, Mic, MessageCircle, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useRecorder } from '../lib/useRecorder'
import { db } from '../lib/api'
import { generateActionItems, generateSummary, transcribeAudio } from '../lib/ai'
import { currentDevice } from '../lib/device'
import { fmtClock, fmtTime } from '../lib/format'
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
  const [via, setVia] = useState<'phone' | 'whatsapp'>('phone')
  const [history, setHistory] = useState<{ number: string; via: string; at: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('tailor.calls') || '[]')
    } catch {
      return []
    }
  })

  function saveHistory(next: typeof history) {
    setHistory(next)
    localStorage.setItem('tailor.calls', JSON.stringify(next))
  }

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

  async function startCall(method: 'phone' | 'whatsapp') {
    setConsentOpen(false)
    setVia(method)
    // 1) Pede o microfone primeiro (evita conflito entre o botao e a permissao).
    await recorder.start()
    setInCall(true)
    // 2) Registra no historico.
    saveHistory([{ number, via: method, at: new Date().toISOString() }, ...history].slice(0, 50))
    // 3) Abre a chamada.
    if (method === 'whatsapp') {
      window.open(`https://wa.me/${number.replace(/[^\d]/g, '')}`, '_blank')
    } else {
      window.location.href = `tel:${number.replace(/[^\d+*#]/g, '')}`
    }
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
        title: `${via === 'whatsapp' ? 'WhatsApp' : 'Ligacao'} ${number}`,
        type: 'call',
        device: currentDevice(),
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
          <div className="text-center py-6">
            <input
              className="w-full bg-transparent text-center font-display text-3xl font-bold outline-none tracking-wide"
              placeholder="Digite o numero"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
            />
          </div>

          {history.length > 0 && (
            <div className="max-w-sm mx-auto w-full mb-4">
              <div className="flex items-center justify-between mb-1 px-1">
                <p className="text-xs uppercase tracking-wide text-content-muted">Historico</p>
                <button className="text-xs text-brand-500" onClick={() => saveHistory([])}>Limpar</button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-surface-elevated border border-surface-border px-3 py-2">
                    <button onClick={() => setNumber(h.number)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {h.via === 'whatsapp' ? <MessageCircle size={15} className="text-green-600 shrink-0" /> : <Phone size={15} className="text-content-muted shrink-0" />}
                      <span className="font-medium truncate">{h.number}</span>
                      <span className="text-xs text-content-muted ml-auto">{fmtTime(h.at)}</span>
                    </button>
                    <button onClick={() => saveHistory(history.filter((_, idx) => idx !== i))} aria-label="Apagar" className="text-content-muted hover:text-brand-500 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        <p className="text-sm font-medium mb-3">Como deseja ligar? (a gravacao inicia junto)</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startCall('whatsapp')}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl py-5 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
          >
            <MessageCircle size={26} />
            WhatsApp
          </button>
          <button
            onClick={() => startCall('phone')}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl py-5 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
          >
            <Phone size={26} />
            Telefone
          </button>
        </div>
        <button className="btn-outline w-full mt-3" onClick={() => setConsentOpen(false)}>
          Cancelar
        </button>
      </Sheet>
    </div>
  )
}
