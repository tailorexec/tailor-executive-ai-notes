import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { logClientError } from '../lib/auditLog'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Hoje um erro de render em QUALQUER lugar do app derruba a arvore inteira e mostra uma tela
 * branca, sem nenhum jeito de voltar sem fechar/reabrir o app. Isto envolve tudo (main.tsx) e
 * mostra uma tela de recuperacao em vez disso.
 *
 * `getDerivedStateFromError` (sincrono, roda ANTES de `componentDidCatch`) e o que decide
 * mostrar o fallback -- a chamada de log em `componentDidCatch` nunca atrasa nem bloqueia essa
 * troca de tela.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 'critical' e reservado a logs gravados pelas proprias edge functions (server-to-server) --
    // o servidor rebaixaria isto pra 'error' de qualquer forma, entao ja registra certo aqui.
    logClientError({
      severity: 'error',
      category: 'system',
      source: 'client:render',
      message: error.message || 'Erro de renderizacao sem mensagem',
      detail: {
        stack: error.stack?.slice(0, 2000),
        componentStack: info.componentStack?.slice(0, 2000),
      },
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center bg-surface-bg">
        <h1 className="font-display text-xl font-bold mb-2">Algo deu errado</h1>
        <p className="text-content-secondary mb-6 max-w-xs">
          Encontramos um problema inesperado. Recarregar a página costuma resolver.
        </p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={18} />
          Recarregar
        </button>
      </div>
    )
  }
}
