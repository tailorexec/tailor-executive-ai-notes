// Efeito elegante de "brilho" vermelho translucido ao clicar em qualquer botao.
// Cria um glow radial na posicao do clique e o remove ao terminar a animacao.
// Aplicado globalmente (uma unica vez) para nao precisar alterar cada botao.

export function initButtonShine(): void {
  if (typeof document === 'undefined') return

  document.addEventListener(
    'pointerdown',
    (e) => {
      const pe = e as PointerEvent
      const target = (pe.target as HTMLElement | null)?.closest(
        'button, .btn, [role="button"]',
      ) as HTMLElement | null
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true')
        return

      const glow = document.createElement('span')
      glow.className = 'btn-shine'
      glow.style.left = `${pe.clientX}px`
      glow.style.top = `${pe.clientY}px`
      document.body.appendChild(glow)

      const anim = glow.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.25)', opacity: 0.55 },
          { transform: 'translate(-50%, -50%) scale(1.35)', opacity: 0 },
        ],
        { duration: 620, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      )
      anim.onfinish = () => glow.remove()
      anim.oncancel = () => glow.remove()
    },
    true,
  )
}
