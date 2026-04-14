import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

const steps = [
  'Scanning website & scoring...',
  'Analyzing SEO & technical signals...',
  'Crawling pages & checking performance...',
  'Generating AI recommendations...',
  'Finalizing report...',
]

// ─── Deep merge utility ────────────────────────────────────────────────────────
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

// ─── Retry wrapper for network requests ────────────────────────────────────────
async function fetchWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = !err.response || (err.response.status >= 500 && err.response.status < 600)
      if (!isRetryable || attempt === maxRetries) throw err
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

// ─── PageSpeed Issue Injection (mirrors backend injectPageSpeedIssues) ───────
function generatePageSpeedIssues(coreWebVitals) {
  if (!coreWebVitals) return []
  const issues = []

  const vitals = coreWebVitals

  if (vitals.LCP) {
    const s = vitals.LCP.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'Critical', impact: 'High', pillar: 'Performance', code: 'LCP_POOR', title: `Critical LCP Issue: ${vitals.LCP.value}`, detail: `Largest Contentful Paint (LCP) measures loading performance. Your LCP is poor (${vitals.LCP.value}), meaning your page loads slowly.`, fix: 'Optimize largest images, preload critical resources, defer non-critical JavaScript, optimize CSS delivery.', effort: 'Complex', impactScore: 9, effortScore: 8 })
    } else if (s < 0.9) {
      issues.push({ severity: 'High', impact: 'Medium', pillar: 'Performance', code: 'LCP_NI', title: `LCP Needs Improvement: ${vitals.LCP.value}`, detail: `LCP needs improvement (${vitals.LCP.value}). This could negatively impact user experience and search rankings.`, fix: 'Consider image optimization, CSS optimization, and reducing server response times.', effort: 'Medium', impactScore: 7, effortScore: 6 })
    }
  }

  if (vitals.CLS) {
    const s = vitals.CLS.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'Critical', impact: 'High', pillar: 'Performance', code: 'CLS_POOR', title: `Critical CLS Issue: ${vitals.CLS.value}`, detail: `Cumulative Layout Shift (CLS) measures visual stability. Your CLS is poor (${vitals.CLS.value}), causing elements to shift unexpectedly during page load.`, fix: 'Reserve space for ads, images, and embeds. Avoid inserting content above existing content. Use transform animations.', effort: 'Medium', impactScore: 8, effortScore: 7 })
    } else if (s < 0.9) {
      issues.push({ severity: 'High', impact: 'Medium', pillar: 'Performance', code: 'CLS_NI', title: `CLS Needs Improvement: ${vitals.CLS.value}`, detail: `CLS needs improvement (${vitals.CLS.value}). Minor layout shifts can still impact user experience.`, fix: 'Specify dimensions for media elements and ensure web fonts load efficiently.', effort: 'Medium', impactScore: 6, effortScore: 5 })
    }
  }

  if (vitals.TBT) {
    const s = vitals.TBT.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'Critical', impact: 'High', pillar: 'Performance', code: 'TBT_POOR', title: `Critical TBT Issue: ${vitals.TBT.value}`, detail: `Total Blocking Time (TBT) measures interactivity. Your TBT is poor (${vitals.TBT.value}), meaning your page is unresponsive during load.`, fix: 'Break up long tasks, optimize JavaScript execution time, and reduce DOM size.', effort: 'Complex', impactScore: 8, effortScore: 7 })
    } else if (s < 0.9) {
      issues.push({ severity: 'High', impact: 'Medium', pillar: 'Performance', code: 'TBT_NI', title: `TBT Needs Improvement: ${vitals.TBT.value}`, detail: `TBT needs improvement (${vitals.TBT.value}). Some delays in page responsiveness may frustrate users.`, fix: 'Minimize JavaScript payloads and optimize parsing.', effort: 'Medium', impactScore: 6, effortScore: 6 })
    }
  }

  if (vitals.FID) {
    const s = vitals.FID.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'High', impact: 'High', pillar: 'Performance', code: 'FID_POOR', title: `FID Issue: ${vitals.FID.value}`, detail: `First Input Delay (FID) measures real-world interactivity. Your FID is poor (${vitals.FID.value}), meaning users experience delays when interacting with your page.`, fix: 'Reduce JavaScript execution time and break up long tasks.', effort: 'Medium', impactScore: 7, effortScore: 6 })
    }
  }

  if (vitals.FCP) {
    const s = vitals.FCP.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'Critical', impact: 'High', pillar: 'Performance', code: 'FCP_POOR', title: `Critical FCP Issue: ${vitals.FCP.value}`, detail: `First Contentful Paint (FCP) measures when the first content appears. Your FCP is poor (${vitals.FCP.value}), meaning users stare at a blank screen for too long.`, fix: 'Reduce server response times, eliminate render-blocking resources, and optimize critical CSS.', effort: 'Medium', impactScore: 8, effortScore: 6 })
    } else if (s < 0.9) {
      issues.push({ severity: 'Medium', impact: 'Medium', pillar: 'Performance', code: 'FCP_NI', title: `FCP Needs Improvement: ${vitals.FCP.value}`, detail: `FCP needs improvement (${vitals.FCP.value}). Users may notice a delay before content appears.`, fix: 'Inline critical CSS, defer non-essential scripts, and optimize server response times.', effort: 'Quick Win', impactScore: 5, effortScore: 4 })
    }
  }

  if (vitals.TTFB) {
    const s = vitals.TTFB.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'High', impact: 'High', pillar: 'Performance', code: 'TTFB_POOR', title: `Slow Server Response: ${vitals.TTFB.value}`, detail: `Time to First Byte (TTFB) measures server response speed. Your TTFB is poor (${vitals.TTFB.value}), meaning the server takes too long to start sending data.`, fix: 'Use a CDN, optimize database queries, upgrade hosting, or implement server-side caching.', effort: 'Medium', impactScore: 8, effortScore: 5 })
    } else if (s < 0.9) {
      issues.push({ severity: 'Medium', impact: 'Medium', pillar: 'Performance', code: 'TTFB_NI', title: `TTFB Needs Improvement: ${vitals.TTFB.value}`, detail: `TTFB needs improvement (${vitals.TTFB.value}). Server response could be faster.`, fix: 'Enable server caching, use a CDN, and optimize backend processing.', effort: 'Quick Win', impactScore: 5, effortScore: 3 })
    }
  }

  if (vitals.SpeedIndex) {
    const s = vitals.SpeedIndex.score || 0
    if (s < 0.5) {
      issues.push({ severity: 'High', impact: 'Medium', pillar: 'Performance', code: 'SPEED_INDEX_POOR', title: `Speed Index Issue: ${vitals.SpeedIndex.value}`, detail: `Speed Index measures how quickly content is visually displayed. Your Speed Index is poor (${vitals.SpeedIndex.value}), indicating slow visual loading.`, fix: 'Optimize images, reduce render-blocking resources, and improve server response times.', effort: 'Medium', impactScore: 6, effortScore: 6 })
    }
  }

  return issues
}

// ─── Adjust scores with PageSpeed data (deep merge + delta scoring) ───────────
function adjustResultWithPageSpeed(fastResult, pageSpeedData, pageSpeedWarning = null) {
  if (!pageSpeedData && !pageSpeedWarning) return fastResult

  const result = pageSpeedData
    ? deepMerge(fastResult, { pageSpeed: pageSpeedData })
    : { ...fastResult }

  if (pageSpeedWarning) {
    result._pageSpeedWarning = pageSpeedWarning
  }

  if (!pageSpeedData) return result

  const vitals = pageSpeedData.coreWebVitals || {}

  // 1. Delta-based tech score adjustment (not full recalc)
  let techDelta = 0
  const lcpScore = vitals.LCP?.score || 0
  if (lcpScore >= 0.9) techDelta += 10
  else if (lcpScore >= 0.5) techDelta += 5
  const siScore = vitals.SpeedIndex?.score || 0
  if (siScore >= 0.9) techDelta += 10
  else if (siScore >= 0.5) techDelta += 5
  const newTechScore = Math.min((result.technical?.score || 0) + techDelta, 100)
  result.technical = { ...(result.technical || {}), score: newTechScore }

  // 2. Delta-based overallScore adjustment
  const oldTech = fastResult.technical?.score || 0
  const overallDelta = Math.round((newTechScore - oldTech) * 0.4)
  let newOverall = (fastResult.overallScore || 0) + overallDelta

  // 3. Apply Performance Gateway: cap at 50 if performance < 40
  if (pageSpeedData.performanceScore < 40) {
    newOverall = Math.min(newOverall, 50)
  }
  result.overallScore = Math.max(0, Math.min(100, newOverall))

  // 4. Inject PageSpeed issues
  const psIssues = generatePageSpeedIssues(vitals)
  result.issues = [...(result.issues || []), ...psIssues]

  return result
}

function LoadingPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const pending = localStorage.getItem('auditPending')
    if (!pending) { navigate('/'); return }

    let parsed
    try {
      parsed = JSON.parse(pending)
    } catch {
      localStorage.removeItem('auditPending')
      navigate('/')
      return
    }
    const { url, instagram, facebook } = parsed

    async function runAudit() {
      try {
        // ── PHASE 1: Fast audit (scrape + score + issues) ──────────────────────
        setCurrentStep(0)
        const fastResponse = await fetchWithRetry(() =>
          api.post('/api/audit/fast', { url, instagram, facebook }, { signal: controller.signal })
        )
        if (cancelled) return
        const fastResult = fastResponse.data
        setCurrentStep(1)

        // ── PHASE 2: Deep audit (crawl + AI recommendations) in parallel with PageSpeed ──
        // Kick off both in parallel since they're independent
        setCurrentStep(2)

        const [deepResult, pageSpeedResult] = await Promise.allSettled([
          fetchWithRetry(() =>
            api.post('/api/audit/deep', {
              url,
              instagram,
              facebook,
              fastResult,
            }, { signal: controller.signal })
          ).then(r => ({ data: r.data })),

          // PageSpeed — call our backend (API key stays server-side)
          fetchWithRetry(() =>
            api.post('/api/audit/pagespeed', { url }, { signal: controller.signal })
          ).then(r => r.data).catch(err => {
            if (cancelled) return null
            return { _error: err?.response?.data?.error || err.message || 'Unknown error' }
          }),
        ])

        if (cancelled) return
        setCurrentStep(3)

        // Unpack deep result
        let deepData = null
        let deepWarning = null
        if (deepResult.status === 'fulfilled' && deepResult.value?.data) {
          deepData = deepResult.value.data
        } else if (deepResult.status === 'rejected') {
          const deepErr = deepResult.reason
          if (deepErr?.name === 'AbortError' || deepErr?.code === 'ERR_CANCELED') return
          console.error('Deep audit error:', deepErr?.response?.data?.error || deepErr?.message)
          deepWarning = 'AI recommendations and crawl data unavailable. The rest of the audit is still valid.'
        }

        // Unpack PageSpeed result
        let pageSpeedData = null
        let pageSpeedWarning = null
        if (pageSpeedResult.status === 'fulfilled') {
          const psVal = pageSpeedResult.value
          if (psVal?._error) {
            pageSpeedWarning = `PageSpeed data unavailable: ${psVal._error}. The rest of the audit is still valid.`
          } else if (psVal?.pageSpeed) {
            pageSpeedData = psVal.pageSpeed
          } else if (psVal?.warning) {
            pageSpeedWarning = psVal.warning
          }
        }

        setCurrentStep(4)

        // Merge all results
        let finalResult = { ...fastResult }

        // Deep merge crawl + recommendations
        if (deepData) {
          finalResult.recommendations = deepData.recommendations || fastResult.recommendations || []
          finalResult.crawl = deepData.crawl || fastResult.crawl || null
          finalResult.issues = deepData.crawl?.crossPageIssues
            ? [...(fastResult.issues || []), ...deepData.crawl.crossPageIssues]
            : fastResult.issues || []
        } else if (deepWarning) {
          finalResult._deepWarning = deepWarning
          finalResult.recommendations = finalResult.recommendations || []
          finalResult.crawl = finalResult.crawl || null
        }

        // Merge PageSpeed data and adjust scores + inject issues
        finalResult = adjustResultWithPageSpeed(finalResult, pageSpeedData, pageSpeedWarning)

        localStorage.removeItem('auditPending')
        localStorage.setItem('auditResult', JSON.stringify(finalResult))
        setTimeout(() => { if (!cancelled) navigate('/report') }, 800)

      } catch (err) {
        if (cancelled) return
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
        setError(err?.response?.data?.error || 'Audit failed. Please try again.')
      }
    }

    runAudit()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-5xl mb-4">!</div>
          <h2 className="text-white text-xl font-semibold mb-2">Audit Failed</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
            Try Again
          </button>
        </div>
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