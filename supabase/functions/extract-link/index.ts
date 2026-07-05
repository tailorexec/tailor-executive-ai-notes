// Edge Function: extrai o texto principal de uma pagina web (server-side, sem CORS).
// Deploy: `supabase functions deploy extract-link --no-verify-jwt`

// @ts-nocheck  (ambiente Deno)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } })
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
  let h = pickMain(html)
  h = h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  h = decodeEntities(h)
  return h.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^[ \t]+|[ \t]+$/gm, '').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { url } = await req.json()
    if (!url || !/^https?:\/\//i.test(url)) return json({ error: 'URL invalida (use http/https).' }, 400)

    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; TailorAINotes/1.0; +https://tailorexec.com.br)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) return json({ error: `Nao consegui abrir a pagina (HTTP ${res.status}).` }, 400)
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('html') && !ctype.includes('text')) {
      return json({ error: 'O link nao aponta para uma pagina de texto/HTML.' }, 400)
    }
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 200) : ''
    const text = htmlToText(html).slice(0, 16000)
    if (!text) return json({ error: 'Nao consegui extrair texto desta pagina.' }, 400)
    return json({ text, title })
  } catch (err) {
    return json({ error: `Falha ao buscar o link: ${String(err)}` }, 500)
  }
})
