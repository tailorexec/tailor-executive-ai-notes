/** Selo pequeno ao lado de um item de menu (ex.: "Indisponível", "Pro"). */
export function NavTag({ variant, children }: { variant: 'muted' | 'accent'; children: React.ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none ${
        variant === 'accent'
          ? 'bg-accent/15 text-accent'
          : 'bg-surface-elevated text-content-muted border border-surface-border'
      }`}
    >
      {children}
    </span>
  )
}
