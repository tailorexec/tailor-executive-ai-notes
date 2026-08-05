// Detecta se uma gravacao esta praticamente muda (silencio).
// Importante: o Whisper "alucina" frases aleatorias quando recebe audio silencioso
// (ex.: gravar durante uma ligacao real no celular, quando o sistema reserva o microfone).
// Nesses casos, evitamos transcrever para nao gerar conteudo inventado.

async function decodeMono(blob: Blob): Promise<{ data: Float32Array; sampleRate: number } | null> {
  try {
    const buf = await blob.arrayBuffer()
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const audio = await ctx.decodeAudioData(buf)
    const data = audio.getChannelData(0)
    await ctx.close()
    return { data, sampleRate: audio.sampleRate }
  } catch {
    return null
  }
}

/** RMS medio do audio inteiro (0 = mudo). Exportado tambem pra diagnostico de gravacao vazia. */
export async function audioRms(blob: Blob): Promise<number> {
  const audio = await decodeMono(blob)
  if (!audio) return 1 // se nao der para decodificar, assume que tem audio (nao bloqueia)
  const ch = audio.data
  const step = Math.max(1, Math.floor(ch.length / 100000))
  let sum = 0
  let count = 0
  for (let i = 0; i < ch.length; i += step) {
    sum += ch[i] * ch[i]
    count++
  }
  return Math.sqrt(sum / Math.max(1, count))
}

/**
 * Maior RMS entre janelas de ~5s. A media do arquivo INTEIRO condena uma reuniao longa em que
 * o usuario falou pouco (ex.: 69 min ouvindo e alguns minutos falando): a fala dilui na media
 * e a gravacao parece "muda". Por janelas, basta UM trecho com voz para contar como audivel.
 */
export async function audioPeakRms(blob: Blob): Promise<number> {
  const audio = await decodeMono(blob)
  if (!audio) return 1
  const ch = audio.data
  // Mesmo orcamento de ~100k amostras do audioRms, distribuido pelo arquivo inteiro.
  const step = Math.max(1, Math.floor(ch.length / 100000))
  const windowSamples = Math.max(step, Math.floor(audio.sampleRate * 5))
  let peak = 0
  let sum = 0
  let count = 0
  let windowEnd = windowSamples
  for (let i = 0; i < ch.length; i += step) {
    if (i >= windowEnd) {
      if (count > 0) peak = Math.max(peak, Math.sqrt(sum / count))
      sum = 0
      count = 0
      windowEnd = i + windowSamples
    }
    sum += ch[i] * ch[i]
    count++
  }
  if (count > 0) peak = Math.max(peak, Math.sqrt(sum / count))
  return peak
}

/** true se o audio for praticamente mudo do comeco ao fim (evita transcricao alucinada). */
export async function isSilentAudio(blob: Blob | undefined | null): Promise<boolean> {
  if (!blob || blob.size < 2500) return true
  return (await audioPeakRms(blob)) < 0.004
}
