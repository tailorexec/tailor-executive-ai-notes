// Edge Function: extrai o texto principal de uma pagina web (server-side, sem CORS).
// Deploy: `supabase functions deploy extract-link`   <-- COM verificacao de JWT.
//
// Esta funcao faz o servidor buscar uma URL escolhida pelo usuario: e um SSRF por
// natureza. As protecoes abaixo sao obrigatorias.
//   - exige usuario autenticado (sem --no-verify-jwt);
//   - so http/https nas portas 80/443;
//   - bloqueia loopback, redes privadas, link-local e hosts de metadados de nuvem;
//   - segue redirects MANUALMENTE, revalidando cada salto (um 302 para 169.254.169.254
//     e o jeito classico de furar um bloqueio feito so na URL inicial);
//   - timeout e teto de bytes lidos.

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { callerId, cors } from '../_shared/guard.ts'

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8000
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB de HTML ja e muito

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

/** IPv4 em faixa privada/reservada. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((n) => n > 255)) return true // invalido: bloqueia
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local + metadados de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast e reservado
  return false
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (!h.includes(':')) return false
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true // unique-local
  if (h.startsWith('fe80')) return true // link-local
  if (h.startsWith('::ffff:')) return isPrivateIPv4(h.slice(7)) // IPv4 mapeado
  return false
}

/** Valida um salto. Retorna a URL segura ou lanca com a razao. */
function assertSafeUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('URL invalida.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Use um link http ou https.')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Porta nao permitida.')

  const host = u.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Este endereco nao pode ser acessado.')
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error('Este endereco nao pode ser acessado.')
  }
  return u
}

/** Le no maximo MAX_BYTES do corpo, para nao engolir um arquivo gigante. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => {})
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    if (off + c.length > total) break
    buf.set(c, off)
    off += c.length
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf)
}

/** fetch com redirects manuais: cada Location e revalidado. */
async function safeFetch(startUrl: string): Promise<Response> {
  let url = assertSafeUrl(startUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; TailorAINotes/1.0; +https://tailorexec.com.br)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      await res.body?.cancel().catch(() => {})
      if (!loc) throw new Error('Redirecionamento invalido.')
      url = assertSafeUrl(new URL(loc, url).toString())
      continue
    }
    return res
  }
  throw new Error('Redirecionamentos demais.')
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ')
}

function pickMain(html: string): string {
  const m = html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i)
  return m ? m[0] : html
}

function htmlToText(html: string): string {
  // Remove elementos estruturais de navegacao/rodape/barra lateral primeiro (menos ruido).
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  h = pickMain(h)
  h = h
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  h = decodeEntities(h)
  return h.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^[ \t]+|[ \t]+$/gm, '').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Sem usuario autenticado esta funcao viraria um proxy aberto para qualquer um.
    if (!callerId(req)) return json({ error: 'Sessao invalida. Entre novamente.' }, 401)

    const { url } = await req.json()
    if (typeof url !== 'string' || !url) return json({ error: 'URL invalida (use http/https).' }, 400)

    let res: Response
    try {
      res = await safeFetch(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao abrir o link.'
      return json({ error: msg.includes('timed out') || msg.includes('abort') ? 'A pagina demorou demais para responder.' : msg }, 400)
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      return json({ error: `Nao consegui abrir a pagina (HTTP ${res.status}).` }, 400)
    }

    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('html') && !ctype.includes('text')) {
      await res.body?.cancel().catch(() => {})
      return json({ error: 'O link nao aponta para uma pagina de texto/HTML.' }, 400)
    }

    const html = await readCapped(res)
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 200) : ''
    const text = htmlToText(html).slice(0, 16000)
    if (!text) return json({ error: 'Nao consegui extrair texto desta pagina.' }, 400)
    return json({ text, title })
  } catch (err) {
    return json({ error: `Falha ao buscar o link: ${String(err)}` }, 500)
  }
})
