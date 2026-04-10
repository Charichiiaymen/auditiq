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
    if (!pending) { navigate('/'); return }
    const { url, instagram, facebook } = JSON.parse(pending)

    let step = 0
    const interval = setInterval(() => {
      step += 1
      if (step < steps.length - 1) setCurrentStep(step)
    }, 3000)

    async function runAudit() {
      try {
        // STEP 1: Fast audit — scraping, issues, AI (under 10s)
        setCurrentStep(0)
        const fastResponse = await axios.post(
          'https://auditiq-five.vercel.app/api/audit',
          { url, instagram, facebook },
          { timeout: 60000 }
        )
        const fastResult = fastResponse.data
        setCurrentStep(3)

        // STEP 2: PageSpeed — called from browser, no timeout limit
        setCurrentStep(4)
        let pageSpeedData = null
        try {
          const params = new URLSearchParams({
            url,
            key: import.meta.env.VITE_PAGESPEED_KEY,
            strategy: 'mobile'
          })
          params.append('category', 'performance')
          params.append('category', 'seo')
          params.append('category', 'best-practices')
          params.append('category', 'accessibility')

          const psRes = await axios.get(
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
            { timeout: 60000 }
          )
          const d = psRes.data
          const cats = d.lighthouseResult?.categories || {}
          const aud = d.lighthouseResult?.audits || {}

          const vital = (id, desc) => ({
            value: aud[id]?.displayValue || 'N/A',
            score: aud[id]?.score || 0,
            status: (aud[id]?.score || 0) >= 0.9 ? 'Good' : (aud[id]?.score || 0) >= 0.5 ? 'Needs Improvement' : 'Poor',
            description: desc
          })

          const oppIds = ['render-blocking-resources','unused-css-rules','unused-javascript','uses-optimized-images','uses-webp-images','uses-text-compression']
          const opportunities = oppIds
            .filter(id => aud[id] && aud[id].score !== null && aud[id].score < 0.9)
            .map(id => ({ id, title: aud[id].title, displayValue: aud[id].displayValue || '', score: aud[id].score, impact: aud[id].score < 0.5 ? 'High' : 'Medium' }))
            .slice(0, 6)

          pageSpeedData = {
            performanceScore: Math.round((cats.performance?.score || 0) * 100),
            seoScore: Math.round((cats.seo?.score || 0) * 100),
            bestPracticesScore: Math.round((cats['best-practices']?.score || 0) * 100),
            accessibilityScore: Math.round((cats.accessibility?.score || 0) * 100),
            coreWebVitals: {
              LCP: vital('largest-contentful-paint', 'Largest Contentful Paint — measures loading performance'),
              FCP: vital('first-contentful-paint', 'First Contentful Paint — time until first content appears'),
              CLS: vital('cumulative-layout-shift', 'Cumulative Layout Shift — measures visual stability'),
              TBT: vital('total-blocking-time', 'Total Blocking Time — measures interactivity'),
              TTFB: vital('server-response-time', 'Time to First Byte — measures server response speed'),
              SpeedIndex: vital('speed-index', 'Speed Index — how quickly content is visually displayed'),
            },
            opportunities,
            diagnostics: [],
            fetchedAt: new Date().toISOString()
          }
        } catch (psErr) {
          console.error('PageSpeed error:', psErr.message)
        }

        clearInterval(interval)
        setCurrentStep(steps.length - 1)

        const finalResult = { ...fastResult, pageSpeed: pageSpeedData }
        localStorage.removeItem('auditPending')
        localStorage.setItem('auditResult', JSON.stringify(finalResult))
        setTimeout(() => navigate('/report'), 800)

      } catch (err) {
        clearInterval(interval)
        setError(err?.response?.data?.error || 'Audit failed. Please try again.')
      }
    }

    runAudit()
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