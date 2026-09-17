import { Component } from 'react'
import Icon from './Icon'

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
        <main className="fm-centre">
          <Icon name="alert" className="fm-centre__mark" />
          <h1 className="fm-centre__title">Something went wrong</h1>
          <p className="fm-centre__sub">
            Fridge Magnet hit an error it did not expect. Reloading usually clears it. The details
            below are safe to share if you are asking for help.
          </p>
          <div className="fm-centre__card" style={{ maxWidth: '26rem' }}>
            <p className="fm-mono" style={{ color: 'var(--fm-signal)', whiteSpace: 'pre-wrap' }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button type="button" className="fm-btn fm-btn--block" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
