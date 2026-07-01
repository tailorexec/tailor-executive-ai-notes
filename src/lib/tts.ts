// Narracao (Text-to-Speech) gratuita, on-device, via Web Speech API.
// Nao consome nenhuma API paga. Escolhe automaticamente uma voz pt-BR se houver.

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => /pt[-_]BR/i.test(v.lang)) ??
    voices.find((v) => /^pt/i.test(v.lang)) ??
    voices[0]
  )
}

export function speak(
  text: string,
  opts: { rate?: number; onEnd?: () => void; onStart?: () => void } = {},
): void {
  if (!ttsSupported()) return
  stopSpeaking()
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'pt-BR'
  u.rate = opts.rate ?? 1
  u.pitch = 1
  u.onend = () => opts.onEnd?.()
  u.onstart = () => opts.onStart?.()
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking
}
