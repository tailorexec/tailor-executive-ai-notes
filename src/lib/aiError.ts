/**
 * As edge functions devolvem `{ error: "..." }` com mensagem pronta quando barram a chamada
 * (cota diaria, teto mensal, rate limit, arquivo grande demais). Nesses casos o usuario
 * precisa ler o motivo, nao um "algo deu errado" generico.
 */
const FRIENDLY = [
  'limite diario',
  'orcamento mensal',
  'Muitas solicitacoes',
  'temporariamente desativadas',
  'muito grande',
  'Limite de',
  'acima do limite',
  'Sessao invalida',
  'nao conseguiu gerar',
]

export function aiError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (!msg) return fallback
  return FRIENDLY.some((f) => msg.includes(f)) ? msg : fallback
}
