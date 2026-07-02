// Detecta se uma gravacao esta praticamente muda (silencio).
// Importante: o Whisper "alucina" frases aleatorias quando recebe audio silencioso
// (ex.: gravar durante uma ligacao real no celular, quando o sistema reserva o microfone).
// Nesses casos, evitamos transcrever para nao gerar conteudo inventado.

async function audioRms(blob: Blob): Promise<number> {
  try {
    const buf = await blob.arrayBuffer()
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const audio = await ctx.decodeAudioData(buf)
    const ch = audio.getChannelData(0)
    const step = Math.max(1, Math.floor(ch.length / 100000))
    let sum = 0
    let count = 0
    for (let i = 0; i < ch.length; i += step) {
      sum += ch[i] * ch[i]
      count++
    }
    await ctx.close()
    return Math.sqrt(sum / Math.max(1, count))
  } catch {
    return 1 // se nao der para decodificar, assume que tem audio (nao bloqueia)
  }
}

/** true se o audio for praticamente mudo (evita transcricao alucinada). */
export async function isSilentAudio(blob: Blob | undefined | null): Promise<boolean> {
  if (!blob || blob.size < 2500) return true
  const rms = await audioRms(blob)
  return rms < 0.004
}
