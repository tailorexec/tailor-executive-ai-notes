// Extracao de conteudo para o modo "arquivo" (PDF/DOCX/TXT) e "link".
// PDF/DOCX sao extraidos no NAVEGADOR (pdfjs/mammoth, carregados sob demanda).
// Link e extraido no SERVIDOR (edge function extract-link) para evitar CORS.

import { config } from './config'
import { supabase } from './supabase'

/** Extrai o texto de um PDF no navegador. */
export async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  let out = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** Extrai o texto de um DOCX no navegador. */
export async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const res = await mammoth.extractRawText({ arrayBuffer })
  return (res.value || '').trim()
}

/** Extrai o texto de um arquivo (pdf/docx/txt/md/csv). */
export async function extractFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return extractPdf(file)
  if (name.endsWith('.docx')) return extractDocx(file)
  if (name.endsWith('.doc')) {
    throw new Error('Formato .doc antigo nao suportado — salve como .docx ou PDF.')
  }
  return (await file.text()).trim()
}

/** Extrai o texto principal de uma pagina web (via edge function, sem CORS). */
export async function extractLink(url: string): Promise<string> {
  if (config.mockMode || !supabase) {
    return `Conteudo do link: ${url}\n\n(A extracao real do conteudo requer o backend configurado.)`
  }
  const { data, error } = await supabase.functions.invoke('extract-link', { body: { url } })
  if (error) throw new Error(error.message || 'Falha ao extrair o link.')
  const d = data as { text?: string; error?: string }
  if (d.error) throw new Error(d.error)
  return (d.text || '').trim()
}
