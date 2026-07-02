/** Icone da ANA: robo feminino (marias-chiquinhas, cilios e sorriso). Estilo lucide. */
export function AnaIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* antena */}
      <path d="M12 3.6v2" />
      <circle cx="12" cy="2.7" r="1.05" />
      {/* cabeca */}
      <rect x="6" y="5.6" width="12" height="11" rx="3.5" />
      {/* marias-chiquinhas (feminino) */}
      <circle cx="4.3" cy="11.4" r="1.7" />
      <circle cx="19.7" cy="11.4" r="1.7" />
      {/* olhos */}
      <circle cx="9.5" cy="10.9" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.9" r="1.05" fill="currentColor" stroke="none" />
      {/* cilios */}
      <path d="M8.1 9.4l.7.5M15.9 9.4l-.7.5" />
      {/* sorriso */}
      <path d="M9.7 13.5c1.1 1 3.5 1 4.6 0" />
      {/* pernas */}
      <path d="M9.5 16.6v1.8M14.5 16.6v1.8" />
    </svg>
  )
}
