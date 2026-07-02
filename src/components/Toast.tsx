import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type Variant = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  variant: Variant
}

const Ctx = createContext<((message: string, variant?: Variant) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const toast = useCallback((message: string, variant: Variant = 'success') => {
    const id = ++seq.current
    setItems((cur) => [...cur, { id, message, variant }])
    window.setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const dismiss = (id: number) => setItems((cur) => cur.filter((t) => t.id !== id))

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="fixed inset-x-0 bottom-28 md:bottom-8 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 max-w-sm w-full sm:w-auto bg-surface-card border border-surface-border shadow-float rounded-2xl px-4 py-3 animate-slide-up"
          >
            <span
              className={
                t.variant === 'error'
                  ? 'text-brand-500'
                  : t.variant === 'info'
                    ? 'text-content-secondary'
                    : 'text-emerald-500'
              }
            >
              {t.variant === 'error' ? (
                <AlertCircle size={18} />
              ) : t.variant === 'info' ? (
                <Info size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
            </span>
            <span className="flex-1 text-sm font-medium">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-content-muted hover:text-content-primary shrink-0"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): (message: string, variant?: Variant) => void {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
