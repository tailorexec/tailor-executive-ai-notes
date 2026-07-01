import { useEffect, useState } from 'react'
import { Megaphone, Wrench, Check } from 'lucide-react'
import { getAppSettings, updateAppSettings } from '../lib/appSettings'
import { useAppSettings } from '../app/SettingsProvider'
import type { AnnouncementType, AppSettings } from '../lib/types'
import { Spinner } from '../components/ui'

const TYPES: { v: AnnouncementType; label: string }[] = [
  { v: 'info', label: 'Informacao' },
  { v: 'warning', label: 'Alerta' },
  { v: 'maintenance', label: 'Manutencao' },
  { v: 'promo', label: 'Novidade / Promo' },
]

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${on ? 'bg-brand-500' : 'bg-surface-border'}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function AdminSettings() {
  const { refresh } = useAppSettings()
  const [s, setS] = useState<AppSettings | null>(null)
  const [savingAnn, setSavingAnn] = useState(false)
  const [savingMaint, setSavingMaint] = useState(false)
  const [okAnn, setOkAnn] = useState(false)
  const [okMaint, setOkMaint] = useState(false)

  useEffect(() => {
    getAppSettings().then(setS)
  }, [])

  if (!s) return null
  const set = (patch: Partial<AppSettings>) => setS({ ...s, ...patch })

  async function saveAnnouncement() {
    if (!s) return
    setSavingAnn(true)
    try {
      const next = await updateAppSettings({
        announcement_enabled: s.announcement_enabled,
        announcement_type: s.announcement_type,
        announcement_message: s.announcement_message,
        announcement_starts_at: s.announcement_starts_at,
        announcement_ends_at: s.announcement_ends_at,
        announcement_version: (s.announcement_version ?? 0) + 1, // reabre para quem havia fechado
      })
      setS(next)
      await refresh()
      setOkAnn(true)
      setTimeout(() => setOkAnn(false), 1800)
    } finally {
      setSavingAnn(false)
    }
  }

  async function saveMaintenance() {
    if (!s) return
    setSavingMaint(true)
    try {
      const next = await updateAppSettings({
        maintenance_enabled: s.maintenance_enabled,
        maintenance_message: s.maintenance_message,
        maintenance_eta: s.maintenance_eta,
      })
      setS(next)
      await refresh()
      setOkMaint(true)
      setTimeout(() => setOkMaint(false), 1800)
    } finally {
      setSavingMaint(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-8">
      {/* Aviso */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <Megaphone size={18} className="text-brand-500" /> Faixa de avisos
          </h3>
          <Toggle on={s.announcement_enabled} onChange={(v) => set({ announcement_enabled: v })} />
        </div>

        <label className="label">Tipo</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {TYPES.map((t) => (
            <button
              key={t.v}
              onClick={() => set({ announcement_type: t.v })}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                s.announcement_type === t.v
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-surface-elevated border-surface-border text-content-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="label">Mensagem</label>
        <textarea
          className="input min-h-[80px] resize-none mb-3"
          placeholder="Ex: Nova funcionalidade de reunioes disponivel!"
          value={s.announcement_message}
          onChange={(e) => set({ announcement_message: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Inicio (opcional)</label>
            <input
              type="datetime-local"
              className="input"
              value={toLocalInput(s.announcement_starts_at)}
              onChange={(e) => set({ announcement_starts_at: fromLocalInput(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Fim (opcional)</label>
            <input
              type="datetime-local"
              className="input"
              value={toLocalInput(s.announcement_ends_at)}
              onChange={(e) => set({ announcement_ends_at: fromLocalInput(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-xs text-content-muted mb-4">Sem datas = fixo ate voce desativar.</p>

        <button className="btn-primary w-full" onClick={saveAnnouncement} disabled={savingAnn}>
          {savingAnn ? <Spinner /> : okAnn ? <Check size={18} /> : null}
          {okAnn ? 'Publicado' : 'Publicar aviso'}
        </button>
      </div>

      {/* Manutencao */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <Wrench size={18} className="text-brand-500" /> Modo manutencao
          </h3>
          <Toggle on={s.maintenance_enabled} onChange={(v) => set({ maintenance_enabled: v })} />
        </div>

        {s.maintenance_enabled && (
          <div className="text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2 mb-3">
            Ao salvar, o app fica bloqueado para todos os usuarios (voce, admin, continua com acesso).
          </div>
        )}

        <label className="label">Mensagem de manutencao</label>
        <textarea
          className="input min-h-[80px] resize-none mb-3"
          placeholder="Estamos aprimorando a plataforma."
          value={s.maintenance_message}
          onChange={(e) => set({ maintenance_message: e.target.value })}
        />

        <label className="label">Previsao de retorno (opcional)</label>
        <input
          className="input mb-4"
          placeholder="Ex: hoje as 18h"
          value={s.maintenance_eta}
          onChange={(e) => set({ maintenance_eta: e.target.value })}
        />

        <button className="btn-primary w-full" onClick={saveMaintenance} disabled={savingMaint}>
          {savingMaint ? <Spinner /> : okMaint ? <Check size={18} /> : null}
          {okMaint ? 'Salvo' : 'Salvar manutencao'}
        </button>
      </div>
    </div>
  )
}
