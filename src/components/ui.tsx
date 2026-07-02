import { Loader2, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { initials } from '../lib/format'

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />
}

export function Avatar({
  first,
  last,
  size = 40,
  url,
}: {
  first: string
  last: string
  size?: number
  url?: string | null
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`${first} ${last}`}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="grid place-items-center rounded-full bg-brand-500/15 text-brand-500 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(first, last)}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="text-content-muted mb-4">{icon}</div>}
      <h3 className="font-display font-semibold text-lg text-content-primary">{title}</h3>
      {subtitle && <p className="text-content-secondary mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Bottom sheet on mobile, centered dialog on wider screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl shadow-float animate-slide-up safe-bottom">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="font-display font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full bg-surface-elevated text-content-secondary hover:text-content-primary"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>
  )
}

export function Chip({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
        active
          ? 'bg-brand-500 border-brand-500 text-white'
          : 'bg-surface-elevated border-surface-border text-content-secondary hover:text-content-primary'
      }`}
    >
      {children}
    </button>
  )
}
