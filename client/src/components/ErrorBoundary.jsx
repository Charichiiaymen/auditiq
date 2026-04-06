import { Component } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('Uncaught error:', error, errorInfo)
  }

  handleRetry = () => {
    // Reset the error state and try to recover
    this.setState({ hasError: false })
    // Reload the page to ensure a clean state
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center gap-8 w-full max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-slate-300 mb-6">An unexpected error occurred. We're sorry for the inconvenience.</p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </div>

            <div className="mt-8 text-center text-xs text-slate-500">
              <p>If this problem persists, please contact support.</p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper component to use hooks
function ErrorBoundary(props) {
  return <ErrorBoundaryClass {...props} />
}

export default ErrorBoundary