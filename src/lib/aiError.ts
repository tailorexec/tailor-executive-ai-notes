import { logClientError } from './auditLog'
import { describeUnknownError } from './errorMessage'

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
  'verificar o orcamento',
  'transcricao esta vazia',
]

/**
 * Subconjunto de FRIENDLY que e o freio de orcamento FUNCIONANDO certo, nao um bug -- e ja
 * aparece agregado no /admin/api (calls_last_min, budget_alerts). Logar de novo aqui seria
 * so ruido: um usuario testando o limite geraria uma linha de audit_log por tentativa.
 */
const EXPECTED_LIMITS = ['limite diario', 'orcamento mensal', 'Muitas solicitacoes', 'temporariamente desativadas']

/**
 * Subconjunto de FRIENDLY que a PROPRIA edge function ja loga no catch externo (severity=error,
 * category=system, source=edge:ai/edge:transcribe) antes de devolver a mensagem pro cliente --
 * logar de novo aqui so duplica a mesma falha em duas linhas (uma "warning/user", outra
 * "error/system") no /admin/audit, sem nenhuma informacao nova na segunda.
 */
const ALREADY_LOGGED_SERVER = ['nao conseguiu gerar']

/**
 * Funcao usada como `setError(aiError(err, ...))`/`toast(aiError(err, ...), 'error')` em toda
 * tela que chama IA -- por isso PRECISA continuar sincrona (nunca vire async, nunca faça
 * `await logClientError(...)`): se retornasse uma Promise, `setError` receberia um objeto em
 * vez de uma string e quebraria a tela em vez de so deixar de logar direito. O log roda solto,
 * sem bloquear o retorno.
 */
export function aiError(err: unknown, fallback: string): string {
  const msg = describeUnknownError(err)
  if (!msg) return fallback
  const matched = FRIENDLY.some((f) => msg.includes(f))
  const isExpectedLimit = EXPECTED_LIMITS.some((f) => msg.includes(f))
  const isAlreadyLoggedServer = ALREADY_LOGGED_SERVER.some((f) => msg.includes(f))
  if (!isExpectedLimit && !isAlreadyLoggedServer) {
    logClientError({
      severity: matched ? 'warning' : 'error',
      category: matched ? 'user' : 'system',
      source: 'client:aiError',
      message: msg,
      detail: err instanceof Error ? { stack: err.stack?.slice(0, 2000) } : undefined,
    })
  }
  return matched ? msg : fallback
}
