/**
 * `err instanceof Error ? err.message : String(err)` produz "[object Object]" pra qualquer
 * rejeicao que nao seja um Error de verdade (ex.: um Event de FileReader/IndexedDB, ou um erro
 * de terceiro que so implementa `.message` sem estender Error) -- aconteceu de verdade no
 * audit_log (client:aiError e client:window). Aqui tenta `.message` antes de cair pro String().
 */
export function describeUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const withMessage = err as { message?: unknown }
    if (typeof withMessage.message === 'string' && withMessage.message) return withMessage.message
    try {
      return JSON.stringify(err).slice(0, 500)
    } catch {
      /* referencia circular ou afins -- cai pro String() abaixo */
    }
  }
  return String(err ?? '')
}
