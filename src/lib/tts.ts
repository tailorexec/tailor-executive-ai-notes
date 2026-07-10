// Narracao (Text-to-Speech) gratuita, on-device, via Web Speech API.
// Nao consome nenhuma API paga e nao gera arquivo: a voz e sintetizada pelo proprio
// sistema a cada execucao, entao nao ha o que salvar ou cachear.

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Prefere as vozes de melhor qualidade. As "natural/neural/premium" do sistema
 * (Google, Microsoft Natural, Siri) soam bem mais fluidas que a voz compacta padrao.
 */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const ptBr = voices.filter((v) => /^pt[-_]?BR/i.test(v.lang))
  const pool = ptBr.length ? ptBr : voices.filter((v) => /^pt/i.test(v.lang))
  const candidates = pool.length ? pool : voices

  return (
    candidates.find((v) => /natural|neural|premium|enhanced|google|siri/i.test(v.name)) ??
    candidates.find((v) => !v.localService) ?? // vozes de servidor costumam ser as boas
    candidates[0]
  )
}

/** No Chrome as vozes chegam de forma assincrona: getVoices() vem vazio no primeiro acesso. */
export function warmUpVoices(): void {
  if (ttsSupported()) window.speechSynthesis.getVoices()
}

/**
 * O Chrome interrompe a fala depois de ~15s. Enfileirar frase a frase resolve isso
 * e ainda deixa pausar/retomar mais responsivo.
 */
function chunk(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?;:\n]+[.!?;:\n]*/g) ?? [text]
  const out: string[] = []
  let buf = ''
  for (const p of parts) {
    if (buf && (buf + p).length > 180) {
      out.push(buf.trim())
      buf = p
    } else {
      buf += p
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out.filter(Boolean)
}

export function speak(
  text: string,
  opts: { rate?: number; onEnd?: () => void; onStart?: () => void } = {},
): void {
  if (!ttsSupported()) return
  stopSpeaking()
  warmUpVoices()

  const voice = pickVoice()
  const pieces = chunk(text)
  if (!pieces.length) return

  pieces.forEach((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'pt-BR'
    u.rate = opts.rate ?? 1
    u.pitch = 1
    if (i === 0) u.onstart = () => opts.onStart?.()
    if (i === pieces.length - 1) u.onend = () => opts.onEnd?.()
    window.speechSynthesis.speak(u)
  })
}

/** Pausa mantendo a posicao; retomar continua de onde parou, nao reinicia. */
export function pauseSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.pause()
}

export function resumeSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.resume()
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking
}

export function isPaused(): boolean {
  return ttsSupported() && window.speechSynthesis.paused
}
