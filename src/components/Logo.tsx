// Tailor wordmark recreated: "TA<pin>LOR", where the "i" is the brand's
// red pin/needle mark. Text uses currentColor so it adapts to light/dark.

export function LogoMark({ size = 28 }: { size?: number }) {
  // The red pin: a ring on top with a tapered needle below.
  return (
    <svg width={size} height={size * 1.9} viewBox="0 0 20 38" fill="none" aria-hidden>
      <circle cx="10" cy="8" r="7" stroke="#F10C27" strokeWidth="3" fill="none" />
      <path d="M10 13 L14 22 L10 38 L6 22 Z" fill="#F10C27" />
    </svg>
  )
}

export function Logo({
  className = '',
  showTagline = false,
  size = 'md',
}: {
  className?: string
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const text = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  const pin = size === 'lg' ? 16 : size === 'sm' ? 9 : 11
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className={`font-display font-bold tracking-[0.06em] leading-none ${text} text-content-primary flex items-end`}>
        <span>TA</span>
        <span className="mx-[0.06em] -translate-y-[0.06em]">
          <LogoMark size={pin} />
        </span>
        <span>LOR</span>
      </div>
      {showTagline && (
        <span className="mt-1.5 text-content-muted font-medium leading-none tracking-wide text-[0.62em] uppercase">
          Executive A.I Note Pro
        </span>
      )}
    </div>
  )
}
