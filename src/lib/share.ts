// Exportacao e compartilhamento de notas: WhatsApp, e-mail, PDF e Word.
// Usa recursos nativos do browser (sem dependencias pesadas).

import type { Note } from './types'
import { fmtDate, fmtDuration } from './format'

export function noteToPlainText(note: Note): string {
  const lines: string[] = []
  lines.push(note.title)
  lines.push(`${fmtDate(note.created_at)}${note.duration_seconds ? ` • ${fmtDuration(note.duration_seconds)}` : ''}`)
  lines.push('')
  if (note.summary) {
    lines.push('RESUMO')
    lines.push(note.summary)
    lines.push('')
  }
  if (note.detailed_summary) {
    lines.push('RESUMO DETALHADO')
    lines.push(note.detailed_summary)
    lines.push('')
  }
  if (note.action_items.length) {
    lines.push('ACTION ITEMS')
    note.action_items.forEach((a) => lines.push(`- [${a.done ? 'x' : ' '}] ${a.text}${a.owner ? ` (${a.owner})` : ''}`))
    lines.push('')
  }
  lines.push('— Gerado por Tailor Executive AI Notes')
  return lines.join('\n')
}

function noteToHtml(note: Note): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const nl2br = (s: string) => esc(s).replace(/\n/g, '<br/>')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#101010;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.5}
    h1{color:#941010;font-size:24px;margin-bottom:4px}
    h2{color:#941010;font-size:16px;margin-top:24px;text-transform:uppercase;letter-spacing:.04em}
    .meta{color:#878684;font-size:13px;margin-bottom:16px}
    li{margin:4px 0}
    .foot{margin-top:32px;color:#878684;font-size:12px;border-top:1px solid #E8E6E2;padding-top:12px}
  </style></head><body>
  <h1>${esc(note.title)}</h1>
  <div class="meta">${fmtDate(note.created_at)}${note.duration_seconds ? ` &bull; ${fmtDuration(note.duration_seconds)}` : ''}</div>
  ${note.summary ? `<h2>Resumo</h2><p>${nl2br(note.summary)}</p>` : ''}
  ${note.detailed_summary ? `<h2>Resumo detalhado</h2><p>${nl2br(note.detailed_summary)}</p>` : ''}
  ${
    note.action_items.length
      ? `<h2>Action Items</h2><ul>${note.action_items
          .map((a) => `<li>${a.done ? '&#10003; ' : ''}${esc(a.text)}${a.owner ? ` <em>(${esc(a.owner)})</em>` : ''}</li>`)
          .join('')}</ul>`
      : ''
  }
  ${note.transcript ? `<h2>Transcricao</h2><p>${nl2br(note.transcript)}</p>` : ''}
  <div class="foot">Gerado por Tailor Executive AI Notes</div>
  </body></html>`
}

export function shareWhatsApp(note: Note): void {
  const text = encodeURIComponent(noteToPlainText(note))
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

export function shareEmail(note: Note): void {
  const subject = encodeURIComponent(`Nota: ${note.title}`)
  const body = encodeURIComponent(noteToPlainText(note))
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'nota'

export function exportWord(note: Note): void {
  const html = noteToHtml(note)
  downloadBlob(new Blob([html], { type: 'application/msword' }), `${slug(note.title)}.doc`)
}

/** PDF via janela de impressao (usuario escolhe "Salvar como PDF"). */
export function exportPdf(note: Note): void {
  const html = noteToHtml(note)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export async function nativeShare(note: Note): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share({ title: note.title, text: noteToPlainText(note) })
    return true
  } catch {
    return false
  }
}

export async function copyToClipboard(note: Note): Promise<void> {
  await navigator.clipboard.writeText(noteToPlainText(note))
}

/** Baixa a transcricao como .txt para o usuario guardar onde quiser. */
export function exportTranscript(note: Note): void {
  const content = note.transcript?.trim() || 'Transcricao indisponivel.'
  downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${slug(note.title)}-transcricao.txt`)
}

export function slugify(s: string): string {
  return slug(s)
}

/** Exporta TODAS as notas do usuario em Markdown (pequeno, ideal p/ IA e Word). */
export function exportNotesMarkdown(notes: Note[], ownerName = ''): void {
  const parts: string[] = [`# Minhas notas — ANA by Tailor`, ownerName ? `_${ownerName}_` : '', '']
  for (const n of notes) {
    parts.push(`## ${n.title}`)
    parts.push(
      `_${fmtDate(n.created_at)}${n.duration_seconds ? ` · ${fmtDuration(n.duration_seconds)}` : ''}_`,
      '',
    )
    if (n.summary?.trim()) {
      parts.push('### Resumo', n.summary.trim(), '')
    }
    if (n.action_items?.length) {
      parts.push('### Action Items')
      n.action_items.forEach((a) => parts.push(`- [${a.done ? 'x' : ' '}] ${a.text}${a.owner ? ` (${a.owner})` : ''}`))
      parts.push('')
    }
    if (n.transcript?.trim()) {
      parts.push('### Transcricao', n.transcript.trim(), '')
    }
    parts.push('---', '')
  }
  const md = parts.join('\n')
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), 'minhas-notas-tailor.md')
}
