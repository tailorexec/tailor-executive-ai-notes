import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ScrollText, AlertTriangle, Users, ListTree, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '../lib/api'
import { Avatar, Chip, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDate } from '../lib/format'
import { periodDays, periodRange, type PeriodKey } from '../lib/apiUsage'
import {
  listAuditLog,
  summarizeAuditLog,
  type AuditCategory,
  type AuditLogRow,
  type AuditSeverity,
} from '../lib/auditLog'
import type { Profile } from '../lib/types'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Hoje' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: '30 dias' },
  { key: 'custom', label: 'Personalizado' },
]

const SEVERITIES: AuditSeverity[] = ['critical', 'error', 'warning', 'info']
const CATEGORIES: AuditCategory[] = ['system', 'silent', 'user', 'security']

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  critical: 'Critico',
  error: 'Erro',
  warning: 'Aviso',
  info: 'Info',
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  system: 'Sistema',
  silent: 'Silencioso',
  user: 'Usuario',
  security: 'Seguranca',
}

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  critical: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30',
  error: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  info: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-content-muted mb-1.5">
        <span className="text-accent">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${SEVERITY_COLOR[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

function LogRow({ row, person }: { row: AuditLogRow; person?: Profile }) {
  const [open, setOpen] = useState(false)
  const hasDetail = row.detail && Object.keys(row.detail).length > 0

  return (
    <li className="card p-3">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-1.5 mb-1">
            <SeverityBadge severity={row.severity} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              {CATEGORY_LABEL[row.category]}
            </span>
            <span className="text-[11px] text-content-muted">{row.source}</span>
          </div>
          <p className="text-sm break-words">{row.message}</p>
          <div className="flex items-center flex-wrap gap-2 mt-1.5 text-[11px] text-content-muted">
            <span>{fmtDate(row.created_at)}</span>
            {row.route && <span>• {row.route}</span>}
            {person && (
              <span className="flex items-center gap-1">
                • <Avatar first={person.first_name} last={person.last_name} size={16} url={person.avatar_url} />
                {person.first_name} {person.last_name}
              </span>
            )}
          </div>
        </div>
        {hasDetail && (
          <span className="text-content-muted shrink-0 mt-0.5">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        )}
      </button>
      {open && hasDetail && (
        <pre className="mt-3 p-2.5 rounded-lg bg-surface-elevated text-[11px] overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(row.detail, null, 2)}
        </pre>
      )}
    </li>
  )
}

export function AuditLogPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [period, setPeriod] = useState<PeriodKey>('day')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [severities, setSeverities] = useState<Set<AuditSeverity>>(new Set())
  const [categories, setCategories] = useState<Set<AuditCategory>>(new Set())
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AuditLogRow[] | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [people, setPeople] = useState<Map<string, Profile>>(new Map())

  const range = useMemo(() => periodRange(period, { from, to }), [period, from, to])
  const filters = useMemo(
    () => ({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      severities: severities.size ? [...severities] : undefined,
      categories: categories.size ? [...categories] : undefined,
      search: search.trim() || undefined,
    }),
    [range, severities, categories, search],
  )

  useEffect(() => {
    db.listProfiles()
      .then((all) => setPeople(new Map(all.map((p) => [p.id, p]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return
    setRows(null)
    setHasMore(true)
    listAuditLog(filters)
      .then((r) => {
        setRows(r)
        setHasMore(r.length === 50)
      })
      .catch(() => {
        setRows([])
        setHasMore(false)
        toast('Nao consegui carregar o log de auditoria', 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function loadMore() {
    if (!rows || !rows.length || loadingMore) return
    const last = rows[rows.length - 1]
    setLoadingMore(true)
    try {
      const more = await listAuditLog(filters, { created_at: last.created_at, id: last.id })
      setRows([...rows, ...more])
      setHasMore(more.length === 50)
    } catch {
      toast('Nao consegui carregar mais registros', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const summary = useMemo(() => (rows ? summarizeAuditLog(rows) : null), [rows])
  const days = periodDays(range)
  const searchDisabled = period === 'custom' && (!from || !to)

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
          <ScrollText size={20} className="text-accent" /> Log de auditoria
        </h1>
      </header>

      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map((p) => (
          <Chip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </Chip>
        ))}
      </div>

      {period === 'custom' && (
        <div className="space-y-3 mb-4">
          <div className="min-w-0">
            <span className="block text-[11px] text-content-muted mb-1">Inicio</span>
            <input type="date" className="input w-full min-w-0 px-2" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] text-content-muted mb-1">Fim</span>
            <input type="date" className="input w-full min-w-0 px-2" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {SEVERITIES.map((s) => (
          <Chip key={s} active={severities.has(s)} onClick={() => toggle(severities, s, setSeverities)}>
            {SEVERITY_LABEL[s]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={categories.has(c)} onClick={() => toggle(categories, c, setCategories)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      <input
        type="search"
        className="input w-full mb-4"
        placeholder={searchDisabled ? 'Selecione um periodo para buscar' : 'Buscar na mensagem...'}
        value={search}
        disabled={searchDisabled}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!searchDisabled && (
        <p className="text-xs text-content-muted mb-4">
          Janela: {fmtDate(range.from.toISOString())} a {fmtDate(range.to.toISOString())} ({Math.round(days)} dia
          {Math.round(days) === 1 ? '' : 's'})
        </p>
      )}

      {rows === null ? (
        <div className="grid place-items-center py-20">
          <Spinner size={24} className="text-accent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Kpi icon={<ListTree size={16} />} label="Registros carregados" value={String(summary?.total ?? 0)} />
            <Kpi
              icon={<AlertTriangle size={16} />}
              label="Erros + criticos"
              value={String((summary?.bySeverity.error ?? 0) + (summary?.bySeverity.critical ?? 0))}
            />
            <Kpi icon={<AlertTriangle size={16} />} label="Criticos" value={String(summary?.bySeverity.critical ?? 0)} />
            <Kpi icon={<Users size={16} />} label="Usuarios afetados" value={String(summary?.distinctUsers ?? 0)} />
          </div>

          {rows.length === 0 ? (
            <div className="card p-8 text-center text-content-muted">Nenhum evento registrado neste filtro.</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <LogRow key={r.id} row={r} person={r.user_id ? people.get(r.user_id) : undefined} />
              ))}
            </ul>
          )}

          {hasMore && rows.length > 0 && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-outline w-full h-11 mt-4">
              {loadingMore ? <Spinner size={16} className="mx-auto" /> : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
