import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import type { Note } from '../lib/types'

type MindMap = NonNullable<Note['mindmap']>

// Paleta de cores dos ramos (estilo mapa mental tradicional).
const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#0d9488']
const CENTRAL_COLOR = '#941010'

// Dimensoes dos cards e espacamentos (em unidades do canvas interno).
const P = 32
const W_C = 216, H_C = 64
const W_B = 190, H_B = 56
const W_CH = 176, H_CH = 58
const COL_GAP = 92
const SLOT = 76

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

      // Ligacao central -> ramo
      links.push({
        x1: side === 'r' ? cRightX : cLeftX,
        y1: cCenterY,
        x2: side === 'r' ? branchX : branchX + W_B,
        y2: branchY,
        color,
        dir: side,
      })

      // Filhos
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

function clampStyle(lines: number): CSSProperties {
  return { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
}

/** Mapa mental tradicional: no central, ramos para os dois lados e filhos, ligados por curvas/setas. */
export function MindMapView({ map }: { map: MindMap }) {
  const { nodes, links, totalW, totalHeight } = buildLayout(map)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  function fit() {
    const el = wrapRef.current
    if (!el) return
    const z = Math.min(1, (el.clientWidth - 8) / totalW)
    setZoom(z > 0.2 ? z : 1)
  }

  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalW])

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={() => setZoom((z) => Math.max(0.25, z * 0.85))} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Diminuir zoom">
          <Minus size={16} />
        </button>
        <span className="text-xs text-content-muted tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2, z * 1.15))} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Aumentar zoom">
          <Plus size={16} />
        </button>
        <button onClick={fit} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Ajustar a tela">
          <Maximize2 size={16} />
        </button>
      </div>

      <div
        ref={wrapRef}
        className="overflow-auto rounded-2xl border border-surface-border bg-surface-elevated/40"
        style={{ maxHeight: '70vh' }}
      >
        <div style={{ width: totalW * zoom, height: totalHeight * zoom }}>
          <div style={{ width: totalW, height: totalHeight, position: 'relative', transformOrigin: 'top left', transform: `scale(${zoom})` }}>
            <svg width={totalW} height={totalHeight} className="absolute inset-0 pointer-events-none">
              {links.map((l, i) => (
                <g key={i}>
                  <path d={linkPath(l)} fill="none" stroke={l.color} strokeWidth={2.5} strokeOpacity={0.7} strokeLinecap="round" />
                  {l.dir === 'r' ? (
                    <polygon points={`${l.x2},${l.y2} ${l.x2 - 9},${l.y2 - 5} ${l.x2 - 9},${l.y2 + 5}`} fill={l.color} fillOpacity={0.85} />
                  ) : (
                    <polygon points={`${l.x2},${l.y2} ${l.x2 + 9},${l.y2 - 5} ${l.x2 + 9},${l.y2 + 5}`} fill={l.color} fillOpacity={0.85} />
                  )}
                </g>
              ))}
            </svg>

            {nodes.map((n, i) => {
              if (n.kind === 'central') {
                return (
                  <div
                    key={i}
                    className="absolute grid place-items-center text-center px-3 rounded-2xl text-white font-display font-bold shadow-float"
                    style={{ left: n.x, top: n.y, width: n.w, height: n.h, background: n.color }}
                  >
                    <span className="text-sm leading-tight" style={clampStyle(2)}>{n.text}</span>
                  </div>
                )
              }
              if (n.kind === 'branch') {
                return (
                  <div
                    key={i}
                    className="absolute grid place-items-center text-center px-3 rounded-xl text-white font-semibold shadow-hover"
                    style={{ left: n.x, top: n.y, width: n.w, height: n.h, background: n.color }}
                  >
                    <span className="text-[13px] leading-tight" style={clampStyle(2)}>{n.text}</span>
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  className="absolute grid items-center px-3 rounded-xl bg-surface-card border border-surface-border text-content-primary shadow-sm"
                  style={{ left: n.x, top: n.y, width: n.w, height: n.h, borderLeftWidth: 4, borderLeftColor: n.color }}
                >
                  <span className="text-xs leading-snug" style={clampStyle(3)}>{n.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-content-muted mt-2">Use os botoes de zoom e arraste para navegar pelo mapa.</p>
    </div>
  )
}
