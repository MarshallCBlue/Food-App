import { Component } from 'react'
import { colors } from '../theme'

// Without this, any error thrown while rendering unmounts the whole app
// and leaves a blank white screen with nothing in the URL bar to tell you
// why. This catches that and shows the actual error instead.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Fridge Magnet crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={styles.page}>
          <h1 style={styles.heading}>Something went wrong</h1>
          <p style={styles.body}>
            Fridge Magnet hit an error it didn't expect. The details below are
            safe to share if you're asking for help.
          </p>
          <pre style={styles.pre}>{String(this.state.error?.message || this.state.error)}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    color: colors.text,
    background: colors.background,
  },
  heading: {
    fontSize: '1.5rem',
    margin: 0,
  },
  body: {
    color: colors.mutedText,
    margin: 0,
    maxWidth: '26rem',
  },
  pre: {
    maxWidth: '26rem',
    padding: '1rem',
    borderRadius: '0.5rem',
    background: colors.card,
    color: colors.danger,
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap',
    textAlign: 'left',
  },
}
