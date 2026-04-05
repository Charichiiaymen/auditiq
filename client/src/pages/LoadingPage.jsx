import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

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
  const [error, setError] = useState('')

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
        localStorage.setItem('auditResult', JSON.stringify(response.data))
        setTimeout(() => navigate('/report'), 800)
      })
      .catch((err) => {
        clearInterval(interval)
        setError(err?.response?.data?.error || 'Audit failed. Please try again.')
      })

    return () => clearInterval(interval)
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 gap-6">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

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