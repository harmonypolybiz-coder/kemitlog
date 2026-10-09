import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ui/States'

interface Props {
  children: ReactNode
}

interface State {
  error: unknown
  hasError: boolean
}

/** Intercepte les erreurs de rendu pour afficher un message plutôt qu'un écran blanc. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined, hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[KEMITLOG] Erreur de rendu', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState title="Cette page a rencontré un problème" error={this.state.error} />
    }
    return this.props.children
  }
}
