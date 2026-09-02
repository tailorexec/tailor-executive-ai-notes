// Windows costuma NAO ter MIME registrado para .m4a (e alguns pickers de Android mandam
// application/octet-stream), entao File.type chega vazio/generico e qualquer checagem so por
// MIME rejeita audio valido — caso real de 2026-09-02: usuarios com .m4a barrados tanto em
// "Enviar audio" quanto em "Enviar video". Regra: MIME decide quando existe; sem MIME (ou
// MIME generico), a extensao decide.

const AUDIO_EXT = /\.(m4a|mp3|wav|wave|webm|ogg|oga|opus|aac|flac|wma|amr|mpga)$/i
const VIDEO_EXT = /\.(mp4|mov|mkv|avi|m4v|3gp|wmv|webm)$/i

export function isAudioFile(f: File): boolean {
  const t = (f.type || '').toLowerCase()
  if (t.startsWith('audio/')) return true
  if (t.startsWith('video/') || t.startsWith('image/')) return false
  return AUDIO_EXT.test(f.name)
}

export function isVideoFile(f: File): boolean {
  const t = (f.type || '').toLowerCase()
  if (t.startsWith('video/')) return true
  if (t.startsWith('audio/') || t.startsWith('image/')) return false
  // .webm sem MIME e ambiguo (audio ou video): o chamador testa isAudioFile primeiro.
  return VIDEO_EXT.test(f.name)
}

/** Content-type para armazenar/tocar o audio quando o blob nao traz MIME (ex.: .m4a no Windows). */
export function audioContentType(blob: Blob): string {
  if (blob.type) return blob.type
  const name = ((blob as File).name || '').toLowerCase()
  const ext = name.match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  const map: Record<string, string> = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    mpga: 'audio/mpeg',
    wav: 'audio/wav',
    wave: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    amr: 'audio/amr',
    wma: 'audio/x-ms-wma',
  }
  return map[ext] ?? 'audio/webm'
}

// Extensoes explicitas no `accept`: o picker do Windows filtra pelo MIME do REGISTRO do
// sistema, e maquinas sem .m4a registrado escondiam o arquivo com so "audio/*".
export const AUDIO_ACCEPT = 'audio/*,.m4a,.mp3,.wav,.webm,.ogg,.oga,.opus,.aac,.flac,.amr,.wma'
export const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.3gp,.m4a'
