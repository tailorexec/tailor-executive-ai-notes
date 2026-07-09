const KEY = 'tailor.recConsent'

/** Marca por usuario: o aviso de gravacao ja foi lido e aceito. */
function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function hasRecordingConsent(userId?: string): boolean {
  if (!userId) return false
  return read()[userId] === true
}

export function setRecordingConsent(userId?: string): void {
  if (!userId) return
  const all = read()
  all[userId] = true
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage cheio/bloqueado: apenas nao persiste */
  }
}
