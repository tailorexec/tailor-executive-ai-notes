import type { NoteDevice } from './types'

/** Dispositivo atual (para marcar a origem da gravacao). */
export function currentDevice(): NoteDevice {
  if (typeof navigator === 'undefined') return null
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}
