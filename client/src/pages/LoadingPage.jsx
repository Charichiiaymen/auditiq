import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { sanitizeErrorMessage, getUserFriendlyErrorMessage, sanitizeUserData } from '../utils/errorUtils'

const steps = [
  'Fetching website content...',
  'Analyzing SEO signals...',
  'Evaluating content quality...',
  'Checking technical setup...',
  'Generating AI recommendations...',
]

function LoadingPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const pending = localStorage.getItem('auditPending')
    if (!pending) {
      navigate('/')
      return
    }

    const { url, instagram, facebook } = JSON.parse(pending)

    // Step animation
    let step = 0
    const interval = setInterval(() => {
      step += 1
      if (step < steps.length - 1) setCurrentStep(step)
    }, 4000)

    // Run audit
    axios.post('https://auditiq-five.vercel.app/api/audit', { url, instagram, facebook })
      .then((response) => {
        clearInterval(interval)
        setCurrentStep(steps.length - 1)
        localStorage.removeItem('auditPending')
        // Sanitize data before storing in localStorage
        const sanitizedData = sanitizeUserData(response.data)
        localStorage.setItem('auditResult', JSON.stringify(sanitizedData))
        setTimeout(() => navigate('/report'), 800)
      })
      .catch((err) => {
        clearInterval(interval)
        // Redirect to error page with detailed error details
        let errorMessage = 'Audit failed. Please try again.'
        let errorStatus = 'Audit Failed'

        // Handle different types of errors
        if (err.response) {
          // Server responded with error status
          const status = err.response.status
          errorStatus = `Audit Failed (${status})`

          // Use user-friendly error messages for common HTTP status codes
          errorMessage = getUserFriendlyErrorMessage(status, err.response.data?.error)

          // Sanitize any backend error messages
          errorMessage = sanitizeErrorMessage(errorMessage)
        } else if (err.request) {
          // Network error (no response received)
          errorMessage = 'Network error. Please check your internet connection and try again.'
          errorStatus = 'Connection Failed'
        } else {
          // Something else happened
          errorMessage = err.message || 'An unexpected error occurred. Please try again.'
          errorStatus = 'Unexpected Error'
          // Sanitize any error messages
          errorMessage = sanitizeErrorMessage(errorMessage)
        }

        navigate('/error', {
          state: {
            message: errorMessage,
            status: errorStatus
          }
        })
      })

    return () => clearInterval(interval)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin"></div>
        <h2 className="text-white text-xl font-semibold">Analyzing your digital presence...</h2>
        <div className="w-full flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500 ${i <= currentStep ? 'bg-indigo-400' : 'bg-slate-600'}`}></div>
              <span className={`text-sm transition-colors duration-500 ${i <= currentStep ? 'text-white' : 'text-slate-500'}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export default LoadingPage