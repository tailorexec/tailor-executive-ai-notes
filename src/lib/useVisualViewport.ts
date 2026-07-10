import { useEffect, useState } from 'react'

export interface ViewportBox {
  top: number
  height: number
}

/**
 * Acompanha o *visual viewport* — a area realmente visivel, que encolhe quando o
 * teclado do celular abre. O layout viewport (o que `fixed inset-0` enxerga) NAO
 * encolhe, entao um bottom sheet ancorado nele fica embaixo do teclado.
 *
 * Retorna null quando nao ha nada a corrigir (desktop, ou API indisponivel).
 */
export function useVisualViewport(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null)

  useEffect(() => {
    if (!active) return
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined
    if (!vv) return

    const update = () => {
      // Sem teclado, o visual viewport ≈ a janela: nao mexemos em nada.
      const shrunk = window.innerHeight - vv.height > 80
      setBox(shrunk ? { top: vv.offsetTop, height: vv.height } : null)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setBox(null)
    }
  }, [active])

  return box
}
