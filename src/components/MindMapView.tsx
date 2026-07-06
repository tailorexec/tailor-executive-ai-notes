import { useEffect, useRef, useState } from 'react'
import { Download, FileDown, Maximize2, X } from 'lucide-react'
import type { Note } from '../lib/types'
import { useToast } from './Toast'

type MindMap = NonNullable<Note['mindmap']>

// Paleta de cores dos ramos (estilo mapa mental tradicional).
const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#0d9488']
const CENTRAL_COLOR = '#941010'
const BG = '#f8fafc'

// Dimensoes dos cards e espacamentos (em unidades do canvas interno).
const P = 32
const W_C = 216, H_C = 66
const W_B = 190, H_B = 58
const W_CH = 178, H_CH = 60
const COL_GAP = 94
const SLOT = 78

type NodeBox = { kind: 'central' | 'branch' | 'child'; text: string; x: number; y: number; w: number; h: number; color: string }
type Link = { x1: number; y1: number; x2: number; y2: number; color: string; dir: 'l' | 'r' }

function buildLayout(map: MindMap) {
  const branches = map.branches ?? []
  const right: { b: MindMap['branches'][number]; ci: number }[] = []
  const left: { b: MindMap['branches'][number]; ci: number }[] = []
  branches.forEach((b, i) => (i % 2 === 0 ? right : left).push({ b, ci: i }))

  const bandH = (b: MindMap['branches'][number]) => Math.max(1, b.children.length) * SLOT
  const rH = right.reduce((s, x) => s + bandH(x.b), 0)
  const lH = left.reduce((s, x) => s + bandH(x.b), 0)
  const totalH = Math.max(rH, lH, H_C + SLOT)

  const leftHasKids = left.some((x) => x.b.children.length > 0)
  const rightHasKids = right.some((x) => x.b.children.length > 0)
  const leftWidth = left.length ? COL_GAP + W_B + (leftHasKids ? COL_GAP + W_CH : 0) : 0
  const rightWidth = right.length ? COL_GAP + W_B + (rightHasKids ? COL_GAP + W_CH : 0) : 0

  const totalW = P + leftWidth + W_C + rightWidth + P
  const totalHeight = totalH + P * 2

  const cLeftX = P + leftWidth
  const cRightX = cLeftX + W_C
  const cCenterY = P + totalH / 2

  const nodes: NodeBox[] = [
    { kind: 'central', text: map.central, x: cLeftX, y: cCenterY - H_C / 2, w: W_C, h: H_C, color: CENTRAL_COLOR },
  ]
  const links: Link[] = []

  function placeSide(list: { b: MindMap['branches'][number]; ci: number }[], side: 'r' | 'l', sideSum: number) {
    let acc = P + (totalH - sideSum) / 2
    for (const { b, ci } of list) {
      const h = bandH(b)
      const bandTop = acc
      acc += h
      const branchY = bandTop + h / 2
      const color = PALETTE[ci % PALETTE.length]
      const branchX = side === 'r' ? cRightX + COL_GAP : cLeftX - COL_GAP - W_B
      nodes.push({ kind: 'branch', text: b.title, x: branchX, y: branchY - H_B / 2, w: W_B, h: H_B, color })

      links.push({
        x1: side === 'r' ? cRightX : cLeftX,
        y1: cCenterY,
        x2: side === 'r' ? branchX : branchX + W_B,
        y2: branchY,
        color,
        dir: side,
      })

      b.children.forEach((c, i) => {
        const childY = bandTop + i * SLOT + SLOT / 2
        const childX = side === 'r' ? branchX + W_B + COL_GAP : branchX - COL_GAP - W_CH
        nodes.push({ kind: 'child', text: c, x: childX, y: childY - H_CH / 2, w: W_CH, h: H_CH, color })
        links.push({
          x1: side === 'r' ? branchX + W_B : branchX,
          y1: branchY,
          x2: side === 'r' ? childX : childX + W_CH,
          y2: childY,
          color,
          dir: side,
        })
      })
    }
  }
  placeSide(right, 'r', rH)
  placeSide(left, 'l', lH)

  return { nodes, links, totalW, totalHeight }
}

function linkPath(l: Link) {
  const dx = (l.x2 - l.x1) / 2
  return `M${l.x1},${l.y1} C${l.x1 + dx},${l.y1} ${l.x2 - dx},${l.y2} ${l.x2},${l.y2}`
}

function arrow(l: Link) {
  return l.dir === 'r'
    ? `${l.x2},${l.y2} ${l.x2 - 9},${l.y2 - 5} ${l.x2 - 9},${l.y2 + 5}`
    : `${l.x2},${l.y2} ${l.x2 + 9},${l.y2 - 5} ${l.x2 + 9},${l.y2 + 5}`
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w
    if (trial.length <= maxChars) cur = trial
    else {
      if (cur) lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  for (let i = 0; i < lines.length; i++) if (lines[i].length > maxChars) lines[i] = lines[i].slice(0, maxChars)
  const full = words.join(' ')
  if (lines.join(' ').length < full.length && lines.length) {
    let last = lines[lines.length - 1]
    if (last.length > maxChars - 1) last = last.slice(0, maxChars - 1)
    lines[lines.length - 1] = last.replace(/[\s.,;:]+$/, '') + '…'
  }
  return lines.length ? lines : ['']
}

function Card({ n }: { n: NodeBox }) {
  const isChild = n.kind === 'child'
  const fs = n.kind === 'central' ? 15 : n.kind === 'branch' ? 13.5 : 12
  const maxChars = n.kind === 'central' ? 22 : n.kind === 'branch' ? 24 : 26
  const maxLines = isChild ? 3 : 2
  const lines = wrapLines(n.text, maxChars, maxLines)
  const lh = fs * 1.2
  const rx = n.kind === 'central' ? 16 : n.kind === 'branch' ? 12 : 10
  const cy = n.y + n.h / 2
  const startY = cy - ((lines.length - 1) * lh) / 2
  const tx = isChild ? n.x + 14 : n.x + n.w / 2
  const anchor = isChild ? 'start' : 'middle'
  return (
    <g>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={rx}
        fill={isChild ? '#ffffff' : n.color}
        stroke={isChild ? n.color : 'none'}
        strokeWidth={isChild ? 2 : 0}
      />
      {lines.map((ln, i) => (
        <text
          key={i}
          x={tx}
          y={startY + i * lh}
          fill={isChild ? '#1e293b' : '#ffffff'}
          fontSize={fs}
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight={isChild ? 500 : 700}
          textAnchor={anchor}
          dominantBaseline="central"
        >
          {ln}
        </text>
      ))}
    </g>
  )
}

/** Mapa mental tradicional (SVG): no central, ramos para os dois lados e filhos ligados por curvas/setas. */
export function MindMapView({ map, title }: { map: MindMap; title?: string }) {
  const { nodes, links, totalW, totalHeight } = buildLayout(map)
  const svgRef = useRef<SVGSVGElement>(null)
  const toast = useToast()
  const [fs, setFs] = useState(false)

  function fileBase() {
    const b = (title || 'mapa-mental')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40)
    return b || 'mapa-mental'
  }

  async function renderCanvas(scale = 2): Promise<HTMLCanvasElement> {
    const svg = svgRef.current
    if (!svg) throw new Error('svg')
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(totalW))
    clone.setAttribute('height', String(totalHeight))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const str = new XMLSerializer().serializeToString(clone)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str)
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('img'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(totalW * scale)
    canvas.height = Math.round(totalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ctx')
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  async function downloadPng() {
    try {
      const canvas = await renderCanvas(2)
      await new Promise<void>((res) =>
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileBase() + '.png'
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }
          res()
        }, 'image/png'),
      )
    } catch {
      toast('Nao foi possivel gerar a imagem.', 'error')
    }
  }

  async function downloadPdf() {
    try {
      const canvas = await renderCanvas(2)
      const jpeg = canvas.toDataURL('image/jpeg', 0.92)
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: totalW >= totalHeight ? 'l' : 'p', unit: 'pt', format: [totalW, totalHeight] })
      pdf.addImage(jpeg, 'JPEG', 0, 0, totalW, totalHeight)
      pdf.save(fileBase() + '.pdf')
    } catch {
      toast('Nao foi possivel gerar o PDF.', 'error')
    }
  }

  async function enterFs() {
    setFs(true)
    try {
      await document.documentElement.requestFullscreen?.()
    } catch {
      /* iOS / nao suportado: usamos overlay proprio */
    }
    try {
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')
    } catch {
      /* orientacao nao pode ser travada (ex.: desktop) */
    }
  }

  async function exitFs() {
    try {
      ;(screen.orientation as unknown as { unlock?: () => void })?.unlock?.()
    } catch {
      /* ignore */
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* ignore */
    }
    setFs(false)
  }

  // Fecha o overlay se o usuario sair do fullscreen nativo (ex.: ESC).
  useEffect(() => {
    function onChange() {
      if (!document.fullscreenElement) setFs((v) => (v ? false : v))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const svgEl = (attachRef: boolean) => (
    <svg
      ref={attachRef ? svgRef : undefined}
      viewBox={`0 0 ${totalW} ${totalHeight}`}
      width="100%"
      style={{ height: 'auto', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={totalW} height={totalHeight} fill={BG} />
      {links.map((l, i) => (
        <g key={i}>
          <path d={linkPath(l)} fill="none" stroke={l.color} strokeWidth={2.5} strokeOpacity={0.75} strokeLinecap="round" />
          <polygon points={arrow(l)} fill={l.color} />
        </g>
      ))}
      {nodes.map((n, i) => (
        <Card key={i} n={n} />
      ))}
    </svg>
  )

  const toolbarBtn = 'grid place-items-center h-9 w-9 rounded-lg bg-surface-elevated border border-surface-border text-content-secondary hover:text-content-primary'

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={downloadPng} className={toolbarBtn} aria-label="Baixar imagem" title="Baixar imagem (PNG)">
          <Download size={17} />
        </button>
        <button onClick={downloadPdf} className={toolbarBtn} aria-label="Baixar PDF" title="Baixar PDF">
          <FileDown size={17} />
        </button>
        <button onClick={enterFs} className={toolbarBtn} aria-label="Tela cheia" title="Tela cheia (landscape)">
          <Maximize2 size={17} />
        </button>
      </div>

      <div className="rounded-2xl border border-surface-border overflow-hidden">{svgEl(true)}</div>
      <p className="text-xs text-content-muted mt-2">Use dois dedos para dar zoom no mapa.</p>

      {fs && (
        <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: BG }}>
          <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-black/10">
            <span className="text-sm font-medium text-slate-700 truncate">{title || 'Mapa mental'}</span>
            <div className="flex items-center gap-2">
              <button onClick={downloadPng} className="grid place-items-center h-9 w-9 rounded-lg bg-white border border-black/10 text-slate-700" aria-label="Baixar imagem">
                <Download size={17} />
              </button>
              <button onClick={downloadPdf} className="grid place-items-center h-9 w-9 rounded-lg bg-white border border-black/10 text-slate-700" aria-label="Baixar PDF">
                <FileDown size={17} />
              </button>
              <button onClick={exitFs} className="grid place-items-center h-9 w-9 rounded-lg bg-white border border-black/10 text-slate-700" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto grid place-items-center p-2">
            <div className="w-full">{svgEl(false)}</div>
          </div>
          <p className="text-[11px] text-slate-500 text-center py-1 shrink-0">Gire o aparelho para landscape • use dois dedos para dar zoom</p>
        </div>
      )}
    </div>
  )
}
