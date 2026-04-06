const axios = require('axios')

async function getPageSpeedData(url) {
  const apiKey = process.env.PAGESPEED_API_KEY
  if (!apiKey) {
    console.log('No PAGESPEED_API_KEY set — skipping PageSpeed analysis')
    return null
  }

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=seo&category=best-practices&category=accessibility`

    const response = await axios.get(apiUrl, { timeout: 30000 })
    const data = response.data

    const categories = data.lighthouseResult?.categories || {}
    const audits = data.lighthouseResult?.audits || {}

    // ── Category Scores ──────────────────────────────────────
    const performanceScore = Math.round((categories.performance?.score || 0) * 100)
    const seoScore = Math.round((categories.seo?.score || 0) * 100)
    const bestPracticesScore = Math.round((categories['best-practices']?.score || 0) * 100)
    const accessibilityScore = Math.round((categories.accessibility?.score || 0) * 100)

    // ── Core Web Vitals ───────────────────────────────────────
    const lcp = audits['largest-contentful-paint']
    const fid = audits['max-potential-fid']
    const cls = audits['cumulative-layout-shift']
    const fcp = audits['first-contentful-paint']
    const ttfb = audits['server-response-time']
    const tbt = audits['total-blocking-time']
    const speedIndex = audits['speed-index']

    const coreWebVitals = {
      LCP: {
        value: lcp?.displayValue || 'N/A',
        score: lcp?.score || 0,
        status: lcp?.score >= 0.9 ? 'Good' : lcp?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'Largest Contentful Paint — measures loading performance'
      },
      FCP: {
        value: fcp?.displayValue || 'N/A',
        score: fcp?.score || 0,
        status: fcp?.score >= 0.9 ? 'Good' : fcp?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'First Contentful Paint — time until first content appears'
      },
      CLS: {
        value: cls?.displayValue || 'N/A',
        score: cls?.score || 0,
        status: cls?.score >= 0.9 ? 'Good' : cls?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'Cumulative Layout Shift — measures visual stability'
      },
      TBT: {
        value: tbt?.displayValue || 'N/A',
        score: tbt?.score || 0,
        status: tbt?.score >= 0.9 ? 'Good' : tbt?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'Total Blocking Time — measures interactivity'
      },
      TTFB: {
        value: ttfb?.displayValue || 'N/A',
        score: ttfb?.score || 0,
        status: ttfb?.score >= 0.9 ? 'Good' : ttfb?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'Time to First Byte — measures server response speed'
      },
      SpeedIndex: {
        value: speedIndex?.displayValue || 'N/A',
        score: speedIndex?.score || 0,
        status: speedIndex?.score >= 0.9 ? 'Good' : speedIndex?.score >= 0.5 ? 'Needs Improvement' : 'Poor',
        description: 'Speed Index — how quickly content is visually displayed'
      },
    }

    // ── Opportunities ─────────────────────────────────────────
    const opportunities = []
    const opportunityIds = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'uses-text-compression',
      'uses-responsive-images',
      'efficient-animated-content',
      'uses-rel-preconnect',
      'font-display',
    ]

    opportunityIds.forEach(id => {
      const audit = audits[id]
      if (audit && audit.score !== null && audit.score < 0.9) {
        opportunities.push({
          id,
          title: audit.title,
          description: audit.description,
          displayValue: audit.displayValue || '',
          score: audit.score,
          impact: audit.score < 0.5 ? 'High' : 'Medium',
        })
      }
    })

    // ── Diagnostics ───────────────────────────────────────────
    const diagnostics = []
    const diagnosticIds = [
      'dom-size',
      'critical-request-chains',
      'user-timings',
      'bootup-time',
      'mainthread-work-breakdown',
      'uses-long-cache-ttl',
      'total-byte-weight',
    ]

    diagnosticIds.forEach(id => {
      const audit = audits[id]
      if (audit && audit.score !== null && audit.score < 0.9) {
        diagnostics.push({
          id,
          title: audit.title,
          displayValue: audit.displayValue || '',
          score: audit.score,
        })
      }
    })

    return {
      performanceScore,
      seoScore,
      bestPracticesScore,
      accessibilityScore,
      coreWebVitals,
      opportunities: opportunities.slice(0, 6),
      diagnostics: diagnostics.slice(0, 5),
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('PageSpeed API error:', err.message)
    return null
  }
}

module.exports = { getPageSpeedData }