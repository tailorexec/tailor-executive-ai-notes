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
  // Use the light version when the page/theme is dark (light logo on dark background),
  // and the dark version for the light theme. Previously this mapping was inverted.
  const src = theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'
  const h = size === 'lg' ? 60 : size === 'sm' ? 34 : 48

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <img src={src} alt="Tailor" style={{ height: h }} className="w-auto object-contain select-none" draggable={false} />
      {showTagline && (
        <span className="pl-3 border-l border-surface-border text-content-secondary font-semibold leading-tight text-xs uppercase tracking-wide">
          Executive
          <br />
          A.I Pro
        </span>
      )}
    </div>
  )
}
