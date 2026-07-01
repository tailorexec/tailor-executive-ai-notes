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
  // Alturas responsivas (a logo e larga ~6.5:1, entao menor no mobile para nao estourar).
  const cls =
    size === 'lg'
      ? 'h-8 sm:h-11 lg:h-14'
      : size === 'sm'
        ? 'h-7'
        : 'h-8 md:h-9'

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
