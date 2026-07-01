import { useTheme } from '../theme/ThemeProvider'

/** Logo oficial ANA by Tailor (troca conforme o tema). Altura responsiva. */
export function Logo({
  className = '',
  size = 'md',
}: {
  className?: string
  /** mantido por compatibilidade; nao usado (a logo ja traz o subtitulo) */
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const { theme } = useTheme()
  // logo-light.png = texto preto (tema claro); logo-dark.png = texto branco (tema escuro).
  const src = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'
  // Alturas responsivas.
  const cls =
    size === 'lg'
      ? 'h-10 sm:h-12 lg:h-14'
      : size === 'sm'
        ? 'h-9'
        : 'h-9 md:h-10'

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={src}
        alt="ANA by Tailor"
        className={`w-auto object-contain select-none ${cls}`}
        draggable={false}
      />
    </div>
  )
}
