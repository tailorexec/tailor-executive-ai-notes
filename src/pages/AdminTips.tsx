import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lightbulb, Monitor, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { adminListTips, createTip, deleteTip, setTipActive } from '../lib/tips'
import type { Tip } from '../lib/types'
import { Chip, ConfirmDialog, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { logSilentError } from '../lib/auditLog'

const BODY_MAX = 280

const SUGGESTIONS = [
  'Grave uma reunião com um clique usando o botão de gravação inteligente na tela inicial.',
  'Você pode compartilhar uma nota com outra pessoa sem perder o controle sobre ela — quem recebe pode remover o compartilhamento quando quiser.',
  'Organize suas notas em pastas coloridas para encontrar tudo mais rápido.',
  'Peça para a ANA gerar um mapa mental da reunião — ótimo para visualizar os principais pontos.',
  'Defina uma prioridade (alta, média, baixa) nas notas mais importantes para não perdê-las de vista.',
  'Envie um áudio ou vídeo já gravado para transcrever e resumir automaticamente.',
  'No computador, grave o áudio de qualquer chamada (Zoom, Meet, Teams) direto da aba do navegador.',
  'Ative "manter conectado" no login para não precisar digitar sua senha toda vez.',
]

export function AdminTips() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [tips, setTips] = useState<Tip[] | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [electronOnly, setElectronOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tip | null>(null)

  function refresh() {
    adminListTips()
      .then(setTips)
      .catch((err) => {
        setTips([])
        logSilentError('client:AdminTips.refresh', err)
        toast('Não foi possível carregar as dicas', 'error')
      })
  }

  useEffect(refresh, [])

  async function save() {
    if (!profile || !body.trim()) return
    setSaving(true)
    try {
      await createTip({ body, title: title || null, electron_only: electronOnly, created_by: profile.id })
      setTitle('')
      setBody('')
      setElectronOnly(false)
      toast('Dica publicada')
      refresh()
    } catch (err) {
      logSilentError('client:AdminTips.save', err)
      toast('Não foi possível publicar a dica', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(tip: Tip) {
    setBusyId(tip.id)
    try {
      await setTipActive(tip.id, !tip.active)
      refresh()
    } catch (err) {
      logSilentError('client:AdminTips.toggleActive', err)
      toast('Não foi possível atualizar a dica', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    const tip = pendingDelete
    if (!tip) return
    setBusyId(tip.id)
    try {
      await deleteTip(tip.id)
      toast('Dica excluída')
      refresh()
    } catch (err) {
      logSilentError('client:AdminTips.delete', err)
      toast('Não foi possível excluir a dica', 'error')
    } finally {
      setBusyId(null)
      setPendingDelete(null)
    }
  }

  return (
    <div className="px-5 safe-top pb-12">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Lightbulb size={20} className="text-accent" /> Dicas
        </h1>
      </header>

      <div className="card p-4 mb-6">
        <p className="text-xs uppercase tracking-wide text-content-muted mb-2">Sugestões (clique para usar)</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setBody(s)}
              className="text-xs text-left rounded-xl bg-surface-elevated border border-surface-border px-3 py-2 hover:border-accent/40 transition-colors max-w-xs"
            >
              {s}
            </button>
          ))}
        </div>

        <input
          className="input mb-2"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input min-h-24 resize-none"
          placeholder="Escreva a dica..."
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-[11px] text-content-muted mt-1 mb-3">{BODY_MAX - body.length} caracteres restantes</p>

        <label className="flex items-center gap-2 text-sm text-content-secondary mb-4">
          <input type="checkbox" checked={electronOnly} onChange={(e) => setElectronOnly(e.target.checked)} />
          Somente no app Windows
        </label>

        <button onClick={save} disabled={!body.trim() || saving} className="btn-primary" >
          {saving ? <Spinner size={16} /> : <Lightbulb size={16} />}
          Publicar dica
        </button>
      </div>

      {tips === null ? (
        <div className="grid place-items-center py-16">
          <Spinner className="text-accent" />
        </div>
      ) : tips.length === 0 ? (
        <p className="text-sm text-content-muted text-center py-8">Nenhuma dica criada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {tips.map((tip) => (
            <li key={tip.id} className="card p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {tip.title && <p className="font-medium text-sm">{tip.title}</p>}
                <p className="text-sm text-content-secondary">{tip.body}</p>
                {tip.electron_only && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-content-muted">
                    <Monitor size={12} /> Somente app Windows
                  </span>
                )}
              </div>
              <Chip active={tip.active} onClick={() => toggleActive(tip)}>
                {busyId === tip.id ? <Spinner size={13} /> : tip.active ? 'Ativa' : 'Inativa'}
              </Chip>
              <button
                onClick={() => setPendingDelete(tip)}
                disabled={busyId === tip.id}
                className="grid place-items-center h-9 w-9 rounded-xl text-content-muted hover:text-accent shrink-0"
                aria-label="Excluir dica"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir dica?"
        message="Esta dica deixa de aparecer para todo mundo imediatamente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
