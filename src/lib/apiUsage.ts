// Leitura do consumo das APIs pagas. So o administrador enxerga (RLS em api_usage).

import { supabase } from './supabase'

export type Provider = 'anthropic' | 'groq' | 'assemblyai' | 'openai'

export interface ApiUsageRow {
  id: string
  user_id: string | null
  provider: Provider
  model: string
  task: string
  input_tokens: number
  output_tokens: number
  audio_seconds: number
  cost_usd: number
  created_at: string
}

export type PeriodKey = 'day' | 'week' | 'month' | 'custom'

export interface Period {
  from: Date
  to: Date
}

export function periodRange(key: PeriodKey, custom?: { from: string; to: string }): Period {
  const to = new Date()
  if (key === 'custom' && custom?.from && custom?.to) {
    const f = new Date(custom.from)
    const t = new Date(custom.to)
    t.setHours(23, 59, 59, 999)
    return { from: f, to: t }
  }
  const from = new Date()
  if (key === 'day') from.setHours(0, 0, 0, 0)
  else if (key === 'week') from.setDate(from.getDate() - 7)
  else from.setDate(from.getDate() - 30)
  return { from, to }
}

export async function listApiUsage(period: Period): Promise<ApiUsageRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('api_usage')
    .select('*')
    .gte('created_at', period.from.toISOString())
    .lte('created_at', period.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []) as ApiUsageRow[]
}

export interface UsageTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  audioSeconds: number
  costUsd: number
  users: number
  costPerUser: number
  tokensPerUser: number
  costPerCall: number
  byProvider: { provider: string; calls: number; tokens: number; costUsd: number }[]
  byTask: { task: string; calls: number; tokens: number; costUsd: number }[]
  byDay: { day: string; costUsd: number }[]
}

export function summarize(rows: ApiUsageRow[]): UsageTotals {
  const users = new Set<string>()
  let inputTokens = 0
  let outputTokens = 0
  let audioSeconds = 0
  let costUsd = 0

  const provider = new Map<string, { calls: number; tokens: number; costUsd: number }>()
  const task = new Map<string, { calls: number; tokens: number; costUsd: number }>()
  const day = new Map<string, number>()

  for (const r of rows) {
    if (r.user_id) users.add(r.user_id)
    inputTokens += r.input_tokens
    outputTokens += r.output_tokens
    audioSeconds += r.audio_seconds
    costUsd += Number(r.cost_usd)

    const tok = r.input_tokens + r.output_tokens
    const p = provider.get(r.provider) ?? { calls: 0, tokens: 0, costUsd: 0 }
    provider.set(r.provider, { calls: p.calls + 1, tokens: p.tokens + tok, costUsd: p.costUsd + Number(r.cost_usd) })

    const tk = task.get(r.task) ?? { calls: 0, tokens: 0, costUsd: 0 }
    task.set(r.task, { calls: tk.calls + 1, tokens: tk.tokens + tok, costUsd: tk.costUsd + Number(r.cost_usd) })

    const d = r.created_at.slice(0, 10)
    day.set(d, (day.get(d) ?? 0) + Number(r.cost_usd))
  }

  const userCount = users.size || 0
  const totalTokens = inputTokens + outputTokens

  return {
    calls: rows.length,
    inputTokens,
    outputTokens,
    totalTokens,
    audioSeconds,
    costUsd,
    users: userCount,
    costPerUser: userCount ? costUsd / userCount : 0,
    tokensPerUser: userCount ? totalTokens / userCount : 0,
    costPerCall: rows.length ? costUsd / rows.length : 0,
    byProvider: [...provider.entries()]
      .map(([p, v]) => ({ provider: p, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byTask: [...task.entries()]
      .map(([tname, v]) => ({ task: tname, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byDay: [...day.entries()].map(([d, c]) => ({ day: d, costUsd: c })).sort((a, b) => a.day.localeCompare(b.day)),
  }
}

/** Custo por usuario, do maior para o menor. */
export function costByUser(rows: ApiUsageRow[]): { userId: string | null; costUsd: number; calls: number }[] {
  const m = new Map<string | null, { costUsd: number; calls: number }>()
  for (const r of rows) {
    const cur = m.get(r.user_id) ?? { costUsd: 0, calls: 0 }
    m.set(r.user_id, { costUsd: cur.costUsd + Number(r.cost_usd), calls: cur.calls + 1 })
  }
  return [...m.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd)
}

export const usd = (n: number) =>
  n >= 1 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toFixed(4)}` : '$0.00'

export const compactNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
