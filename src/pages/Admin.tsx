import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Mic,
  FileText,
  Sparkles,
  Search,
  Volume2,
  NotebookPen,
} from 'lucide-react'
import { db } from '../lib/api'
import type { AdminUserRow } from '../lib/types'
import { Avatar, Spinner } from '../components/ui'
import { fmtRelative } from '../lib/format'
import { AdminSettings } from './AdminSettings'

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-content-muted mb-2">
        <span className="text-brand-500">{icon}</span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  )
}

export function Admin() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminUserRow[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    db.adminRows().then(setRows)
  }, [])

  const totals = useMemo(() => {
    if (!rows) return { users: 0, notes: 0, recordings: 0, transcriptions: 0, ai: 0, tts: 0 }
    return rows.reduce(
      (acc, r) => ({
        users: acc.users + 1,
        notes: acc.notes + r.notesCount,
        recordings: acc.recordings + r.recordings,
        transcriptions: acc.transcriptions + r.transcriptions,
        ai: acc.ai + r.aiSuggestions,
        tts: acc.tts + r.ttsCount,
      }),
      { users: 0, notes: 0, recordings: 0, transcriptions: 0, ai: 0, tts: 0 },
    )
  }, [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        `${r.profile.first_name} ${r.profile.last_name}`.toLowerCase().includes(q) ||
        r.profile.email.toLowerCase().includes(q),
    )
  }, [rows, query])

  return (
    <div className="px-5 pt-6 safe-top">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold">Administrador</h1>
          <p className="text-sm text-content-muted">Uso da plataforma por usuario</p>
        </div>
      </header>

      {rows === null ? (
        <div className="grid place-items-center py-20">
          <Spinner size={24} className="text-brand-500" />
        </div>
      ) : (
        <>
          <AdminSettings />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <StatCard icon={<Users size={16} />} label="Usuarios" value={totals.users} />
            <StatCard icon={<NotebookPen size={16} />} label="Notas" value={totals.notes} />
            <StatCard icon={<Mic size={16} />} label="Gravacoes" value={totals.recordings} />
            <StatCard icon={<FileText size={16} />} label="Transcricoes" value={totals.transcriptions} />
            <StatCard icon={<Sparkles size={16} />} label="Sugestoes IA" value={totals.ai} />
            <StatCard icon={<Volume2 size={16} />} label="Narracoes" value={totals.tts} />
          </div>

          <div className="relative mb-4">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              className="input pl-11"
              placeholder="Buscar usuario por nome ou e-mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Table (desktop) */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-content-muted">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-3 py-3 font-medium text-center">Notas</th>
                  <th className="px-3 py-3 font-medium text-center">Gravacoes</th>
                  <th className="px-3 py-3 font-medium text-center">Transcricoes</th>
                  <th className="px-3 py-3 font-medium text-center">Sugestoes IA</th>
                  <th className="px-3 py-3 font-medium text-center">Narracoes</th>
                  <th className="px-4 py-3 font-medium">Ultima atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map((r) => (
                  <tr key={r.profile.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar first={r.profile.first_name} last={r.profile.last_name} size={34} />
                        <div className="min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            {r.profile.first_name} {r.profile.last_name}
                            {r.profile.role === 'admin' && (
                              <span className="text-[10px] uppercase bg-brand-500/15 text-brand-500 px-1.5 py-0.5 rounded">
                                admin
                              </span>
                            )}
                          </p>
                          <p className="text-content-muted text-xs truncate">{r.profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">{r.notesCount}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{r.recordings}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{r.transcriptions}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{r.aiSuggestions}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{r.ttsCount}</td>
                    <td className="px-4 py-3 text-content-muted">{fmtRelative(r.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {filtered.map((r) => (
              <div key={r.profile.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar first={r.profile.first_name} last={r.profile.last_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate flex items-center gap-2">
                      {r.profile.first_name} {r.profile.last_name}
                      {r.profile.role === 'admin' && (
                        <span className="text-[10px] uppercase bg-brand-500/15 text-brand-500 px-1.5 py-0.5 rounded">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="text-content-muted text-xs truncate">{r.profile.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Notas" value={r.notesCount} />
                  <Metric label="Gravacoes" value={r.recordings} />
                  <Metric label="Transcr." value={r.transcriptions} />
                  <Metric label="Sug. IA" value={r.aiSuggestions} />
                  <Metric label="Narracoes" value={r.ttsCount} />
                  <div>
                    <p className="text-[11px] text-content-muted">Atividade</p>
                    <p className="text-xs font-medium mt-1">{fmtRelative(r.lastActivity)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-elevated rounded-xl py-2">
      <p className="font-display font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-content-muted">{label}</p>
    </div>
  )
}
