import { useNavigate, useLocation } from 'react-router-dom'
import { sanitizeErrorMessage } from '../utils/errorUtils'

function ErrorPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Get error message from location state or use default
  const rawErrorMessage = location.state?.message || 'An unexpected error occurred.'
  const errorStatus = location.state?.status || 'Error'

  // Sanitize error message to prevent information disclosure
  const errorMessage = sanitizeErrorMessage(rawErrorMessage)

  const handleRetry = () => {
    navigate('/')
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{errorStatus}</h1>
          <p className="text-slate-300 mb-6">{errorMessage}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleGoHome}
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

export default ErrorPage