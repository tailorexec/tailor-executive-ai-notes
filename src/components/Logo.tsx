import { useTheme } from '../theme/ThemeProvider'

type LogoPart = 'full' | 'ana' | 'anaonly' | 'tailor'

/** Logo oficial ANA by Tailor (troca cor conforme o tema). Pode exibir a marca
 *  completa ou apenas as partes "ANA" ou "by Tailor" (mesma arte, so recortada). */
export function Logo({
  className = '',
  size = 'md',
  part = 'full',
  heightClass,
  onLightSurface = false,
}: {
  className?: string
  /** mantido por compatibilidade; nao usado (a logo ja traz o subtitulo) */
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
  part?: LogoPart
  /** sobrescreve a altura padrao do tamanho (ex.: 'h-11 md:h-12') */
  heightClass?: string
  /** A arte e escolhida pelo TEMA. Mas no modo escuro as superficies (cards, sidebar)
   *  sao CLARAS — ali a arte branca sumiria. Force a versao de texto escuro. */
  onLightSurface?: boolean
}) {
  const { theme } = useTheme()
  const suffix = !onLightSurface && theme === 'dark' ? 'dark' : 'light'
  // *-light = texto preto (tema claro); *-dark = texto branco (tema escuro).
  const base =
    part === 'ana'
      ? 'logo-ana'
      : part === 'anaonly'
        ? 'logo-anaonly'
        : part === 'tailor'
          ? 'logo-tailor'
          : 'logo'
  const src = `/${base}-${suffix}.png`

  const preset =
    size === 'lg'
      ? 'h-10 sm:h-12 lg:h-14'
      : size === 'sm'
        ? 'h-9'
        : 'h-9 md:h-10'
  const cls = heightClass ?? preset

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={src}
        alt={part === 'tailor' ? 'by Tailor' : 'ANA by Tailor'}
        className={`w-auto object-contain select-none ${cls}`}
        draggable={false}
      />
    </div>
  )
}
