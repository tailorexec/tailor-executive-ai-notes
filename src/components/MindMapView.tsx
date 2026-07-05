import type { Note } from '../lib/types'

/** Render do mapa mental (no central + ramos). Usado na pagina /nota/:id/mapa-mental. */
export function MindMapView({ map }: { map: NonNullable<Note['mindmap']> }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="px-5 py-3 rounded-2xl bg-brand-500 text-white font-display font-bold text-lg shadow-float text-center">
          {map.central}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {map.branches.map((b, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-accent/10 text-accent font-semibold border-b border-surface-border">
              {b.title}
            </div>
            <ul className="p-4 space-y-2">
              {b.children.map((c, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span className="text-sm">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
