import type { NoteDevice } from './types'

/** Dispositivo atual (para marcar a origem da gravacao). Robusto: usa userAgentData quando disponivel. */
export function currentDevice(): NoteDevice {
  if (typeof navigator === 'undefined') return null
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile ? 'mobile' : 'desktop'
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Windows Phone|Mobile|Mobi|Tablet/i.test(ua)) return 'mobile'
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1
  if (coarse && touch) return 'mobile'
  return 'desktop'
}
