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

  async function saveAnnouncement(enabled: boolean) {
    if (!s) return
    setSavingAnn(true)
    try {
      const next = await updateAppSettings({
        announcement_enabled: enabled,
        announcement_type: s.announcement_type,
        announcement_message: s.announcement_message,
        announcement_starts_at: s.announcement_starts_at,
        announcement_ends_at: s.announcement_ends_at,
        announcement_version: (s.announcement_version ?? 0) + 1,
      })
      setS(next)
      await refresh()
      setOkAnn(true)
      setTimeout(() => setOkAnn(false), 1800)
    } finally {
      setSavingAnn(false)
    }
  }

  async function saveMaintenance(enabled: boolean) {
    if (!s) return
    setSavingMaint(true)
    try {
      const next = await updateAppSettings({
        maintenance_enabled: enabled,
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
          {s.announcement_enabled && (
            <span className="text-[10px] uppercase tracking-wide bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
              ativo
            </span>
          )}
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

        <label className="label">Periodo (opcional)</label>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <input
            type="datetime-local"
            className="input"
            value={toLocalInput(s.announcement_starts_at)}
            onChange={(e) => set({ announcement_starts_at: fromLocalInput(e.target.value) })}
          />
          <input
            type="datetime-local"
            className="input"
            value={toLocalInput(s.announcement_ends_at)}
            onChange={(e) => set({ announcement_ends_at: fromLocalInput(e.target.value) })}
          />
        </div>
        <p className="text-xs text-content-muted mb-4">Sem datas = fixo ate voce remover.</p>

        {s.announcement_enabled ? (
          <button className="btn-outline w-full text-brand-500" onClick={() => saveAnnouncement(false)} disabled={savingAnn}>
            {savingAnn ? <Spinner /> : null} Remover aviso
          </button>
        ) : (
          <button className="btn-primary w-full" onClick={() => saveAnnouncement(true)} disabled={savingAnn}>
            {savingAnn ? <Spinner /> : okAnn ? <Check size={18} /> : null}
            {okAnn ? 'Publicado' : 'Publicar aviso'}
          </button>
        )}
      </div>

      {/* Manutencao */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <Wrench size={18} className="text-brand-500" /> Modo manutencao
          </h3>
          {s.maintenance_enabled && (
            <span className="text-[10px] uppercase tracking-wide bg-brand-500/15 text-brand-500 px-2 py-0.5 rounded-full">
              ativo
            </span>
          )}
        </div>

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

        {s.maintenance_enabled ? (
          <button className="btn-outline w-full text-brand-500" onClick={() => saveMaintenance(false)} disabled={savingMaint}>
            {savingMaint ? <Spinner /> : null} Remover manutencao
          </button>
        ) : (
          <>
            <div className="text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2 mb-3">
              Ao publicar, o app fica bloqueado para todos (voce, admin, continua com acesso).
            </div>
            <button className="btn-primary w-full" onClick={() => saveMaintenance(true)} disabled={savingMaint}>
              {savingMaint ? <Spinner /> : okMaint ? <Check size={18} /> : null}
              {okMaint ? 'Publicado' : 'Publicar manutencao'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
