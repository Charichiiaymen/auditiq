import { useEffect, useState } from 'react'

const steps = [
  'Fetching website content...',
  'Analyzing SEO signals...',
  'Evaluating content quality...',
  'Checking technical setup...',
  'Generating AI recommendations...',
]

function LoadingPage() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin"></div>
        <h2 className="text-white text-xl font-semibold">Analyzing your digital presence...</h2>
        <div className="w-full flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i <= currentStep ? 'bg-indigo-400' : 'bg-slate-600'}`}></div>
              <span className={`text-sm ${i <= currentStep ? 'text-white' : 'text-slate-500'}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export default LoadingPage