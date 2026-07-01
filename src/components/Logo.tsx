import { useTheme } from '../theme/ThemeProvider'

/** Logo oficial Tailor (troca conforme o tema) + subtitulo opcional. */
export function Logo({
  className = '',
  showTagline = false,
  size = 'md',
}: {
  className?: string
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const { theme } = useTheme()
  const src = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'
  const h = size === 'lg' ? 46 : size === 'sm' ? 26 : 34

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <img src={src} alt="Tailor" style={{ height: h }} className="w-auto object-contain select-none" draggable={false} />
      {showTagline && (
        <span className="pl-3 border-l border-surface-border text-content-secondary font-medium leading-tight text-[11px] uppercase tracking-wide">
          Executive
          <br />
          A.I Note Pro
        </span>
      )}
    </div>
  )
}
