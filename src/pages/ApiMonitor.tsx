import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Activity,
  DollarSign,
  Coins,
  Users,
  ExternalLink,
  Info,
  AudioLines,
  AlertTriangle,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { db } from '../lib/api'
import { Avatar, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDate, fmtDuration } from '../lib/format'
import {
  ackBudgetAlert,
  compactNum,
  costByUser,
  listApiUsage,
  listBudgetAlerts,
  periodDays,
  periodRange,
  summarize,
  usd,
  type ApiUsageRow,
  type PeriodKey,
} from '../lib/apiUsage'
import { getAppSettings, updateAppSettings } from '../lib/appSettings'
import type { AppSettings, BudgetAlert, Profile } from '../lib/types'

/** Campo numerico com botao de salvar: evita gravar a cada tecla. */
function LimitField({
  label,
  value,
  step,
  onSave,
}: {
  label: string
  value: number
  step: string
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const dirty = draft !== String(value) && draft.trim() !== '' && !Number.isNaN(Number(draft))

  useEffect(() => setDraft(String(value)), [value])

  return (
    <div>
      <label className="block text-[11px] text-content-muted mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step={step}
          className="input flex-1 min-w-0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          onClick={() => onSave(Number(draft))}
          disabled={!dirty}
          className="btn-primary h-11 w-11 rounded-xl p-0 shrink-0 disabled:opacity-40"
          aria-label="Salvar"
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  )
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Hoje' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: '30 dias' },
  { key: 'custom', label: 'Personalizado' },
]

const CONSOLES: { name: string; url: string }[] = [
  { name: 'Anthropic', url: 'https://console.anthropic.com/settings/billing' },
  { name: 'Groq', url: 'https://console.groq.com/settings/billing' },
  { name: 'AssemblyAI', url: 'https://www.assemblyai.com/app/account' },
]

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-content-muted mb-1.5">
        <span className="text-accent">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-content-muted mt-0.5">{hint}</p>}
    </div>
  )
}

/** Barrinha proporcional ao maior valor da lista. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
      <div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ApiMonitor() {
  const navigate = useNavigate()
  const toast = useToast()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<ApiUsageRow[] | null>(null)
  const [people, setPeople] = useState<Map<string, Profile>>(new Map())
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)

  async function saveSettings(patch: Partial<AppSettings>) {
    try {
      const next = await updateAppSettings(patch)
      setSettings(next)
      toast('Limites atualizados')
    } catch {
      toast('Nao consegui salvar os limites', 'error')
    }
  }

  async function dismissAlert(id: string) {
    try {
      await ackBudgetAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      toast('Nao consegui marcar o alerta', 'error')
    }
  }

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return
    setRows(null)
    listApiUsage(periodRange(period, { from, to }))
      .then(setRows)
      .catch(() => {
        setRows([])
        toast('Nao consegui carregar o consumo das APIs', 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to])

  useEffect(() => {
    db.listProfiles()
      .then((all) => setPeople(new Map(all.map((p) => [p.id, p]))))
      .catch(() => {})
    listBudgetAlerts().then(setAlerts).catch(() => {})
    getAppSettings().then(setSettings).catch(() => {})
  }, [])

  const range = useMemo(() => periodRange(period, { from, to }), [period, from, to])
  const days = periodDays(range)
  const totals = useMemo(() => (rows ? summarize(rows) : null), [rows])
  const perUser = useMemo(() => (rows ? costByUser(rows).slice(0, 10) : []), [rows])

  // A linha mais antiga do periodo: se o app comecou a registrar ontem, "7 dias" e
  // "30 dias" mostram os mesmos numeros -- e isso precisa ficar obvio na tela.
  const firstRecord = rows?.length ? rows[rows.length - 1].created_at : null

  const maxProvider = totals?.byProvider[0]?.costUsd ?? 0
  const maxTask = totals?.byTask[0]?.costUsd ?? 0
  const maxUser = perUser[0]?.costUsd ?? 0

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
          <Activity size={20} className="text-accent" /> Monitoramento da API
        </h1>
      </header>

      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              period === p.key
                ? 'bg-brand-solid border-brand-solid text-white'
                : 'bg-surface-elevated border-surface-border text-content-secondary'
            }`}
          >
            {p.label}
          </button>
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

      <p className="text-xs text-content-muted mb-4">
        Janela: {fmtDate(range.from.toISOString())} a {fmtDate(range.to.toISOString())} ({Math.round(days)} dia
        {Math.round(days) === 1 ? '' : 's'})
        {firstRecord && ` • primeiro registro em ${fmtDate(firstRecord)}`}
      </p>

      {rows === null ? (
        <div className="grid place-items-center py-20">
          <Spinner size={24} className="text-accent" />
        </div>
      ) : !totals || totals.calls === 0 ? (
        <div className="card p-8 text-center text-content-muted">
          Nenhuma chamada de API registrada neste periodo.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Kpi icon={<DollarSign size={16} />} label="Gasto total" value={usd(totals.costUsd)} />
            <Kpi
              icon={<Coins size={16} />}
              label="Tokens"
              value={compactNum(totals.totalTokens)}
              hint={`${compactNum(totals.inputTokens)} entrada • ${compactNum(totals.outputTokens)} saida`}
            />
            <Kpi
              icon={<Users size={16} />}
              label="Gasto medio / usuario"
              value={usd(totals.costPerUser)}
              hint={`${totals.users} usuario(s) ativo(s)`}
            />
            <Kpi
              icon={<Coins size={16} />}
              label="Tokens medios / usuario"
              value={compactNum(Math.round(totals.tokensPerUser))}
            />
            <Kpi icon={<Activity size={16} />} label="Chamadas" value={String(totals.calls)} />
            <Kpi icon={<DollarSign size={16} />} label="Custo medio / chamada" value={usd(totals.costPerCall)} />
            <Kpi
              icon={<AudioLines size={16} />}
              label="Audio transcrito"
              value={fmtDuration(totals.audioSeconds)}
            />
            <Kpi
              icon={<DollarSign size={16} />}
              label="Projecao mensal"
              value={usd(projectMonthly(totals.costUsd, days))}
              hint="ritmo atual x 30 dias"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div className="card p-4">
              <h2 className="font-display font-semibold mb-3">Por provedor</h2>
              <ul className="space-y-3">
                {totals.byProvider.map((p) => (
                  <li key={p.provider}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-medium text-sm capitalize">{p.provider}</span>
                      <span className="text-sm tabular-nums">{usd(p.costUsd)}</span>
                    </div>
                    <Bar value={p.costUsd} max={maxProvider} />
                    <p className="text-[11px] text-content-muted mt-1">
                      {p.calls} chamada(s) • {compactNum(p.tokens)} tokens
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <h2 className="font-display font-semibold mb-3">Por funcao</h2>
              <ul className="space-y-3">
                {totals.byTask.map((tk) => (
                  <li key={tk.task}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-medium text-sm">{tk.task}</span>
                      <span className="text-sm tabular-nums">{usd(tk.costUsd)}</span>
                    </div>
                    <Bar value={tk.costUsd} max={maxTask} />
                    <p className="text-[11px] text-content-muted mt-1">
                      {tk.calls} chamada(s) • {compactNum(tk.tokens)} tokens
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card p-4 mb-3">
            <h2 className="font-display font-semibold mb-3">Maiores consumidores</h2>
            <ul className="space-y-3">
              {perUser.map((u) => {
                const p = u.userId ? people.get(u.userId) : undefined
                const name = p ? `${p.first_name} ${p.last_name}` : 'Conta excluida'
                return (
                  <li key={u.userId ?? 'deleted'}>
                    <div className="flex items-center gap-2 mb-1">
                      {p ? (
                        <Avatar first={p.first_name} last={p.last_name} size={24} url={p.avatar_url} />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-surface-elevated shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate flex-1">{name}</span>
                      <span className="text-sm tabular-nums">{usd(u.costUsd)}</span>
                    </div>
                    <Bar value={u.costUsd} max={maxUser} />
                    <p className="text-[11px] text-content-muted mt-1">{u.calls} chamada(s)</p>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {alerts.length > 0 && (
        <div className="card p-4 mb-3 border-brand-solid">
          <h2 className="font-display font-semibold flex items-center gap-2 mb-2 text-accent">
            <AlertTriangle size={16} /> Alertas de gasto
          </h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{a.day}</span>: gasto de {usd(Number(a.spend_usd))} passou do
                  limiar de {usd(Number(a.threshold_usd))}.
                </span>
                <button onClick={() => dismissAlert(a.id)} className="btn-outline h-8 px-3 text-xs shrink-0">
                  Ciente
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settings && (
        <div className="card p-4 mb-3">
          <h2 className="font-display font-semibold flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-accent" /> Freios de gasto
          </h2>
          <p className="text-xs text-content-muted mb-4">
            Aplicados no servidor, antes de chamar a API. Valem para qualquer chamada, inclusive fora do app.
          </p>

          <button
            onClick={() => saveSettings({ ai_enabled: !settings.ai_enabled })}
            className="w-full flex items-center gap-3 mb-4 text-left"
          >
            <span
              className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${
                settings.ai_enabled ? 'bg-brand-solid' : 'bg-surface-border'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.ai_enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-sm">Funcoes de IA ativas</span>
              <span className="block text-xs text-content-muted">
                Desligar bloqueia todas as chamadas pagas na hora (freio de emergencia).
              </span>
            </span>
          </button>

          <div className="space-y-3">
            <LimitField
              label="Cota diaria por usuario (USD)"
              value={settings.ai_daily_usd_per_user}
              step="0.5"
              onSave={(v) => saveSettings({ ai_daily_usd_per_user: v })}
            />
            <LimitField
              label="Teto mensal da empresa (USD)"
              value={settings.ai_monthly_usd_global}
              step="10"
              onSave={(v) => saveSettings({ ai_monthly_usd_global: v })}
            />
            <LimitField
              label="Chamadas por minuto, por usuario"
              value={settings.ai_rate_per_min}
              step="1"
              onSave={(v) => saveSettings({ ai_rate_per_min: Math.round(v) })}
            />
            <LimitField
              label="Alerta quando o gasto do dia passar de (USD)"
              value={settings.ai_daily_alert_usd}
              step="1"
              onSave={(v) => saveSettings({ ai_daily_alert_usd: v })}
            />
          </div>
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-2">
          <Info size={16} className="text-accent" /> Saldo de creditos
        </h2>
        <p className="text-sm text-content-secondary leading-relaxed mb-3">
          Anthropic, Groq e AssemblyAI <span className="font-medium text-content-primary">nao expoem</span> o saldo
          restante por API. Os numeros acima sao o consumo real medido a cada chamada (tokens devolvidos pela
          propria API) multiplicado pela tabela de precos configurada nas edge functions. Para ver o saldo,
          abra o console do provedor:
        </p>
        <div className="flex flex-wrap gap-2">
          {CONSOLES.map((c) => (
            <a
              key={c.name}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="btn-outline h-9 px-3 text-sm"
            >
              {c.name} <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Extrapola o gasto do periodo para 30 dias, seja qual for a janela. */
function projectMonthly(cost: number, days: number): number {
  return (cost / days) * 30
}
