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
      .then(async (response) => {
        clearInterval(interval)
        setCurrentStep(steps.length - 1)

        // Fetch PageSpeed directly from frontend to bypass Vercel timeout
        let pageSpeedData = null
        try {
          const params = new URLSearchParams({ url, key: 'AIzaSyBAoO47Z2NWi5CCC5acxXp8gn4rcyjs1VQ', strategy: 'mobile' })
          params.append('category', 'performance')
          params.append('category', 'seo')
          params.append('category', 'best-practices')
          params.append('category', 'accessibility')
          const psResponse = await axios.get(
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
            { timeout: 60000 }
          )
          const data = psResponse.data
          const categories = data.lighthouseResult?.categories || {}
          const audits = data.lighthouseResult?.audits || {}
          const getVital = (id, desc) => ({
            value: audits[id]?.displayValue || 'N/A',
            score: audits[id]?.score || 0,
            status: audits[id]?.score >= 0.9 ? 'Good' : audits[id]?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
            description: desc
          })
          const opportunities = []
          const oppIds = ['render-blocking-resources','unused-css-rules','unused-javascript','uses-optimized-images','uses-webp-images','uses-text-compression','uses-responsive-images','efficient-animated-content','uses-rel-preconnect','font-display']
          oppIds.forEach(id => {
            const a = audits[id]
            if (a && a.score !== null && a.score < 0.9) {
              opportunities.push({ id, title: a.title, displayValue: a.displayValue || '', score: a.score, impact: a.score < 0.5 ? 'High' : 'Medium' })
            }
          })
          pageSpeedData = {
            performanceScore: Math.round((categories.performance?.score || 0) * 100),
            seoScore: Math.round((categories.seo?.score || 0) * 100),
            bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),
            accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
            coreWebVitals: {
              LCP: getVital('largest-contentful-paint', 'Largest Contentful Paint — measures loading performance'),
              FCP: getVital('first-contentful-paint', 'First Contentful Paint — time until first content appears'),
              CLS: getVital('cumulative-layout-shift', 'Cumulative Layout Shift — measures visual stability'),
              TBT: getVital('total-blocking-time', 'Total Blocking Time — measures interactivity'),
              TTFB: getVital('server-response-time', 'Time to First Byte — measures server response speed'),
              SpeedIndex: getVital('speed-index', 'Speed Index — how quickly content is visually displayed'),
            },
            opportunities: opportunities.slice(0, 6),
            diagnostics: [],
            fetchedAt: new Date().toISOString(),
          }
        } catch (psErr) {
          console.error('PageSpeed fetch failed:', psErr.message)
        }

        const result = { ...response.data, pageSpeed: pageSpeedData }
        localStorage.removeItem('auditPending')
        // Sanitize data before storing in localStorage
        const sanitizedData = sanitizeUserData(result)
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