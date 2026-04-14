import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../utils/api'

const priorityColor = {
  High: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Low: 'bg-green-500/20 text-green-400 border border-green-500/30',
}

const severityConfig = {
  Critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-500' },
  High: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-500' },
  Medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-500' },
  Low: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', dot: 'bg-green-500' },
  Informational: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', dot: 'bg-blue-500' },
}

const effortConfig = {
  'Quick Win': 'bg-emerald-500/20 text-emerald-400',
  'Medium': 'bg-yellow-500/20 text-yellow-400',
  'Complex': 'bg-red-500/20 text-red-400',
  'Informational': 'bg-blue-500/20 text-blue-400',
}

const vitalStatus = {
  Good: 'text-green-400',
  'Needs Improvement': 'text-yellow-400',
  Poor: 'text-red-400',
}

function ScoreRing({ score, size = 80 }) {
  const radius = size / 2 - 6
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = score >= 75 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize={size < 70 ? 13 : 18} fontWeight="bold">{score}</text>
    </svg>
  )
}

function Section({ title, children }) {
  return (
    <div className="w-full">
      <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block"></span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-[#1e293b] rounded-xl border border-slate-700 ${className}`}>
      {children}
    </div>
  )
}

function PriorityMatrix({ issues }) {
  const filtered = issues.filter(i => i.severity !== 'Informational' && (i.effort || i.effortScore) && (i.impact || i.impactScore))

  // Map effort categories to X positions (0-100 scale)
  const effortX = { 'Quick Win': 20, 'Medium': 50, 'Complex': 80 }

  // Map impact categories to Y positions (0-100 scale)
  const impactY = { 'Low': 80, 'Medium': 50, 'High': 20 }

  // Map numeric scores to positions
  const getEffortPosition = (issue) => {
    if (issue.effortScore !== undefined) {
      // Normalize 0-10 scale to 0-100 scale
      return Math.max(10, Math.min(90, issue.effortScore * 10))
    }
    return effortX[issue.effort] || 50
  }

  const getImpactPosition = (issue) => {
    if (issue.impactScore !== undefined) {
      // Normalize 0-10 scale to 0-100 scale (inverted because Y=0 is top)
      return 100 - Math.max(10, Math.min(90, issue.impactScore * 10))
    }
    return impactY[issue.impact] || 50
  }

  const severityColor = {
    Critical: '#f87171',
    High: '#fb923c',
    Medium: '#facc15',
    Low: '#4ade80',
  }

  const quadrants = [
    { x: 0, y: 0, w: 50, h: 50, label: 'High Impact\nEasy Wins', color: 'rgba(99,102,241,0.08)', labelColor: '#818cf8' },
    { x: 50, y: 0, w: 50, h: 50, label: 'High Impact\nHard Wins', color: 'rgba(251,146,60,0.05)', labelColor: '#fb923c' },
    { x: 0, y: 50, w: 50, h: 50, label: 'Low Impact\nEasy Wins', color: 'rgba(74,222,128,0.05)', labelColor: '#4ade80' },
    { x: 50, y: 50, w: 50, h: 50, label: 'Low Impact\nHard Wins', color: 'rgba(100,116,139,0.05)', labelColor: '#475569' },
  ]

  return (
    <Card className="p-5">
      <p className="text-slate-400 text-xs mb-4">Each dot represents an issue. Top-left = highest priority fixes.</p>
      <div className="relative w-full" style={{ paddingBottom: '60%' }}>
        <svg viewBox="0 0 120 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Quadrant backgrounds */}
          {quadrants.map((q, i) => (
            <rect key={i} x={q.x + 10} y={q.y + 5} width={q.w} height={q.h} fill={q.color} />
          ))}

          {/* Grid lines */}
          <line x1="60" y1="5" x2="60" y2="105" stroke="#334155" strokeWidth="0.3" strokeDasharray="1,1" />
          <line x1="10" y1="55" x2="110" y2="55" stroke="#334155" strokeWidth="0.3" strokeDasharray="1,1" />

          {/* Axes */}
          <line x1="10" y1="5" x2="10" y2="105" stroke="#475569" strokeWidth="0.4" />
          <line x1="10" y1="105" x2="110" y2="105" stroke="#475569" strokeWidth="0.4" />

          {/* Axis Labels */}
          <text x="60" y="113" textAnchor="middle" fill="#64748b" fontSize="4">Effort →</text>
          <text x="2" y="55" textAnchor="middle" fill="#64748b" fontSize="3.5" transform="rotate(-90 2 55)">Impact ↑</text>

          {/* X axis ticks */}
          {['Quick Win', 'Medium', 'Complex'].map((label, i) => (
            <text key={label} x={10 + (i+0.5)*33.3} y="109" textAnchor="middle" fill="#475569" fontSize="3">{label}</text>
          ))}

          {/* Y axis ticks */}
          {['High', 'Medium', 'Low'].map((label, i) => (
            <text key={label} x="9.5" y={5 + (i+0.5)*33.3 + 1} textAnchor="end" fill="#475569" fontSize="2.8">{label}</text>
          ))}

          {/* Quadrant labels */}
          <text x="35" y="14" textAnchor="middle" fill="#818cf8" fontSize="3" fontWeight="bold">⚡ Quick Wins</text>
          <text x="85" y="14" textAnchor="middle" fill="#fb923c" fontSize="3" fontWeight="bold">🎯 Strategic</text>
          <text x="35" y="64" textAnchor="middle" fill="#4ade80" fontSize="3" fontWeight="bold">📋 Nice to Have</text>
          <text x="85" y="64" textAnchor="middle" fill="#475569" fontSize="3" fontWeight="bold">⏸ Defer</text>

          {/* Issue dots */}
          {filtered.map((issue, i) => {
            // Calculate X position (effort axis: left = easy, right = hard)
            const effortPos = getEffortPosition(issue)
            const cx = 10 + (effortPos * 0.8) // Scale to fit within 10-90 range

            // Calculate Y position (impact axis: top = high, bottom = low)
            const impactPos = getImpactPosition(issue)
            const cy = 5 + (impactPos * 0.95) // Scale to fit within 5-100 range

            const jitterX = ((i * 7) % 14) - 7
            const jitterY = ((i * 11) % 14) - 7
            const color = severityColor[issue.severity] || '#94a3b8'
            return (
              <g key={i}>
                <circle
                  cx={cx + jitterX * 0.3}
                  cy={cy + jitterY * 0.3}
                  r="2.5"
                  fill={color}
                  fillOpacity="0.85"
                  stroke="#0f172a"
                  strokeWidth="0.5"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const el = document.getElementById(`issue-${i}`)
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(severityColor).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-slate-400 text-xs">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function ReportPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedIssue, setExpandedIssue] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('auditResult')
    if (!stored) { navigate('/'); return }
    try {
      setResult(JSON.parse(stored))
    } catch {
      localStorage.removeItem('auditResult')
      navigate('/')
      return
    }
  }, [navigate])

  if (!result) return null

  // ─── Safe result normalizer ────────────────────────────────────────────────
  const safeResult = {
    seo: { score: 0, ...result.seo },
    technical: { score: 0, ...result.technical },
    content: { score: 0, ...result.content },
    social: { score: 0, ...result.social },
    issues: result.issues || [],
    recommendations: result.recommendations || [],
    overallScore: result.overallScore || 0,
    crawl: result.crawl || null,
    pageSpeed: result.pageSpeed || null,
    _pageSpeedWarning: result._pageSpeedWarning || null,
    _deepWarning: result._deepWarning || null,
  }

  const { seo, technical, content, social, issues = [], recommendations = [], pageSpeed, crawl, overallScore } = safeResult
  const pageSpeedWarning = safeResult._pageSpeedWarning
  const deepWarning = safeResult._deepWarning

  const actionableIssues = issues.filter(i => i.severity !== 'Informational')
  const criticalCount = actionableIssues.filter(i => i.severity === 'Critical').length
  const highCount = actionableIssues.filter(i => i.severity === 'High').length
  const quickWins = actionableIssues.filter(i =>
    i.effort === 'Quick Win' ||
    (i.effortScore !== undefined && i.effortScore <= 3)
  ).length

  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 }
  const filters = ['All', 'Critical', 'High', 'Medium', 'Low', 'Informational']
  const filteredIssues = (activeFilter === 'All' ? issues : issues.filter(i => i.severity === activeFilter))
    .sort((a, b) => (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0))

  const pillars = [
    { name: 'Technical', score: technical.score, weight: '40%' },
    { name: 'SEO Health', score: seo.score, weight: '30%' },
    { name: 'Content', score: content.score, weight: '20%' },
    { name: 'Social', score: social.score, weight: '10%' },
  ]

  // Add Performance score if available
  if (pageSpeed && pageSpeed.performanceScore !== undefined) {
    pillars.push({ name: 'Performance', score: pageSpeed.performanceScore });
  }

  const scoreColor = (s) => s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'
  const scoreLabel = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical'
  const scoreCls = (s) => s >= 75 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

async function handleExportPDF() {
    setExporting(true)
    try {
      const res = await api.post('/api/generate-pdf', result, {
        responseType: 'blob',
        timeout: 120000,
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'AuditIQ-Report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <Navbar />
      <div className="flex flex-col items-center px-4 py-10 w-full max-w-5xl mx-auto gap-10">

        {/* Header */}
        <div className="w-full flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-white text-2xl font-bold">Audit Report</h1>
            <p className="text-indigo-400 text-sm mt-1 font-medium">{result.url}</p>
            <p className="text-slate-500 text-xs mt-0.5">{new Date(result.timestamp).toLocaleString()}</p>
          </div>
          <button onClick={handleExportPDF} disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm self-start">
            {exporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>

        {/* Executive Summary */}
        <Section title="Executive Summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Overall Score */}
            <Card className="p-6 flex items-center gap-6">
              <ScoreRing score={overallScore} size={90} />
              <div>
                <p className="text-slate-400 text-xs mb-1">Overall Score</p>
                <p className={`text-lg font-bold ${scoreCls(overallScore)}`}>{scoreLabel(overallScore)}</p>
                <p className="text-slate-500 text-xs mt-1">{actionableIssues.length} actionable issues detected</p>
              </div>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Critical Issues', value: criticalCount, color: 'text-red-400' },
                { label: 'High Priority', value: highCount, color: 'text-orange-400' },
                { label: 'Quick Wins', value: quickWins, color: 'text-green-400' },
                { label: 'Pages Crawled', value: crawl?.pagesCrawled || 1, color: 'text-indigo-400' },
              ].map((s) => (
                <Card key={s.label} className="p-4 flex flex-col items-center justify-center text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-xs mt-1">{s.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </Section>

        {/* Pillar Scores */}
        <Section title="Score Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {pillars.map((p) => (
              <Card key={p.name} className="p-5 flex flex-col items-center gap-2">
                <ScoreRing score={p.score} size={70} />
                <p className="text-slate-400 text-xs text-center">{p.name}</p>
                <p className={`text-xs font-semibold ${scoreCls(p.score)}`}>{scoreLabel(p.score)}</p>
                <p className="text-slate-600 text-xs">{p.weight} weight</p>
              </Card>
            ))}
          </div>

          {/* Score Bars */}
          <Card className="p-5 mt-4 flex flex-col gap-4">
            {pillars.map((p) => (
              <div key={p.name} className="flex items-center gap-4">
                <span className="text-slate-400 text-sm w-32 shrink-0">{p.name} <span className="text-slate-600">({p.weight})</span></span>
                <div className="flex-1 bg-[#0f172a] rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${p.score}%`, backgroundColor: scoreColor(p.score) }} />
                </div>
                <span className="text-white text-sm font-semibold w-14 text-right shrink-0">{p.score}/100</span>
              </div>
            ))}
          </Card>
        </Section>

        {/* Social Presence Verification */}
        {(social.instagramProvided || social.facebookProvided || (social.socialLinksOnPage?.length > 0)) && (
          <Section title="Social Presence Verification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Instagram Verification */}
              {social.instagramProvided && (
                <Card className="p-5">
                  <p className="text-slate-400 text-xs mb-3">Instagram</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold ${social.instagramOnPage ? 'text-green-400' : 'text-red-400'}`}>
                      {social.instagramOnPage ? 'Verified on page' : 'Not found on page'}
                    </span>
                  </div>
                  {social.instagramLinkFound && (
                    <p className="text-slate-500 text-xs truncate">{social.instagramLinkFound}</p>
                  )}
                </Card>
              )}
              {/* Facebook Verification */}
              {social.facebookProvided && (
                <Card className="p-5">
                  <p className="text-slate-400 text-xs mb-3">Facebook</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold ${social.facebookOnPage ? 'text-green-400' : 'text-red-400'}`}>
                      {social.facebookOnPage ? 'Verified on page' : 'Not found on page'}
                    </span>
                  </div>
                  {social.facebookLinkFound && (
                    <p className="text-slate-500 text-xs truncate">{social.facebookLinkFound}</p>
                  )}
                </Card>
              )}
            </div>
            {/* All Social Links Found */}
            {social.socialLinksOnPage?.length > 0 && (
              <Card className="p-5 mt-4">
                <p className="text-slate-400 text-xs mb-3">Social Links Detected on Page</p>
                <div className="flex flex-wrap gap-2">
                  {social.socialLinksOnPage.map((link, i) => (
                    <span key={i} className="bg-slate-700/50 text-slate-300 text-xs px-3 py-1.5 rounded-full">
                      {link.platform}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </Section>
        )}

        {/* Warning Banners */}
        {pageSpeedWarning && (
          <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <span className="text-yellow-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-yellow-400 text-sm font-semibold">PageSpeed Data Unavailable</p>
              <p className="text-slate-400 text-xs mt-1">{pageSpeedWarning}</p>
            </div>
          </div>
        )}
        {deepWarning && (
          <div className="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
            <span className="text-orange-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-orange-400 text-sm font-semibold">Recommendations Unavailable</p>
              <p className="text-slate-400 text-xs mt-1">{deepWarning}</p>
            </div>
          </div>
        )}

        {/* Core Web Vitals */}
        {pageSpeed && pageSpeed.coreWebVitals && (
          <Section title="Core Web Vitals & Performance">
            {/* Lighthouse Scores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Performance', score: pageSpeed.performanceScore },
                { label: 'SEO', score: pageSpeed.seoScore },
                { label: 'Best Practices', score: pageSpeed.bestPracticesScore },
                { label: 'Accessibility', score: pageSpeed.accessibilityScore },
              ].map((s) => (
                <Card key={s.label} className="p-4 flex flex-col items-center gap-2">
                  <ScoreRing score={s.score} size={60} />
                  <p className="text-slate-400 text-xs text-center">{s.label}</p>
                </Card>
              ))}
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(pageSpeed.coreWebVitals).map(([key, v]) => (
                <Card key={key} className="p-4">
                  <p className="text-slate-500 text-xs mb-1">{key}</p>
                  <p className="text-white text-lg font-bold">{v.value}</p>
                  <p className={`text-xs font-semibold mt-1 ${vitalStatus[v.status]}`}>{v.status}</p>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">{v.description}</p>
                </Card>
              ))}
            </div>

            {/* Opportunities */}
            {pageSpeed.opportunities?.length > 0 && (
              <Card className="p-5 mt-4">
                <p className="text-white font-semibold text-sm mb-3">Optimization Opportunities</p>
                <div className="flex flex-col gap-2">
                  {pageSpeed.opportunities.map((o) => (
                    <div key={o.id} className="flex items-start justify-between gap-4 py-2 border-b border-slate-700/50 last:border-0">
                      <div>
                        <p className="text-white text-sm">{o.title}</p>
                        {o.displayValue && <p className="text-slate-500 text-xs mt-0.5">{o.displayValue}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${o.impact === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {o.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </Section>
        )}

        {/* Issues Audit */}
        <Section title={`Issues Audit (${issues.length} found)`}>
          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap mb-4">
            {filters.map((f) => {
              const count = f === 'All' ? issues.length : issues.filter(i => i.severity === f).length
              return (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                  {f} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            {filteredIssues.map((issue, i) => {
              const cfg = severityConfig[issue.severity] || severityConfig.Informational
              const isExpanded = expandedIssue === i
              return (
                <div key={i} id={`issue-${i}`} className={`rounded-xl border p-4 cursor-pointer transition-all ${cfg.bg}`}
                  onClick={() => setExpandedIssue(isExpanded ? null : i)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold ${cfg.color}`}>{issue.severity}</span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs text-slate-500">{issue.pillar}</span>
                          {issue.effort && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${effortConfig[issue.effort] || ''}`}>
                              {issue.effort}
                            </span>
                          )}
                          {issue.effortScore !== undefined && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${effortConfig.Medium || ''}`}>
                              Effort: {issue.effortScore}/10
                            </span>
                          )}
                          {issue.impact && (
                            <span className="text-xs text-slate-600">Impact: {issue.impact}</span>
                          )}
                          {issue.impactScore !== undefined && (
                            <span className="text-xs text-slate-600">Impact: {issue.impactScore}/10</span>
                          )}
                        </div>
                        <p className="text-white text-sm font-medium">{issue.title}</p>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-5 flex flex-col gap-3">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Why it matters</p>
                        <p className="text-slate-300 text-sm leading-relaxed">{issue.detail}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">How to fix it</p>
                        <p className="text-indigo-300 text-sm leading-relaxed">{issue.fix}</p>
                      </div>
                      {issue.affectedPages?.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Affected pages</p>
                          {issue.affectedPages.map((url, j) => (
                            <p key={j} className="text-slate-400 text-xs">{url}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* Keyword Analysis */}
        {seo.topKeywords?.length > 0 && (
          <Section title="Keyword Analysis">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5">
                <p className="text-slate-400 text-xs mb-4">Top Keywords by Frequency</p>
                <div className="flex flex-col gap-3">
                  {seo.topKeywords.map((kw, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-white text-sm w-24 shrink-0">{kw.word}</span>
                      <div className="flex-1 bg-[#0f172a] rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.min((kw.density / 10) * 100, 100)}%` }} />
                      </div>
                      <span className="text-slate-500 text-xs w-20 text-right shrink-0">{kw.density}% · ×{kw.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-slate-400 text-xs mb-4">Primary Keyword Placement</p>
                <p className="text-indigo-400 font-semibold text-sm mb-4">"{seo.primaryKeyword}"</p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'In Page Title', value: seo.keywordInTitle },
                    { label: 'In H1 Tag', value: seo.keywordInH1 },
                    { label: 'In Meta Description', value: seo.keywordInMeta },
                    { label: 'In URL', value: seo.keywordInURL },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                      <span className="text-slate-400 text-sm">{item.label}</span>
                      <span className={`text-sm font-semibold ${item.value ? 'text-green-400' : 'text-red-400'}`}>
                        {item.value ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>
        )}

        {/* Pages Crawled */}
        {crawl && crawl.pages?.length > 0 && (
          <Section title={`Pages Crawled (${crawl.pagesCrawled})`}>
            <div className="flex flex-col gap-3">
              {crawl.pages.map((page, i) => (
                <Card key={i} className="p-4">
                  <p className="text-indigo-400 text-xs mb-2 truncate">{page.url}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Title', value: page.title || 'Missing', ok: !!page.title },
                      { label: 'Meta Desc', value: page.hasMetaDescription ? 'Present' : 'Missing', ok: page.hasMetaDescription },
                      { label: 'H1', value: page.hasH1 ? `${page.h1Count} found` : 'Missing', ok: page.hasH1 && page.h1Count === 1 },
                      { label: 'Schema', value: page.hasSchema ? 'Present' : 'Missing', ok: page.hasSchema },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-slate-500 text-xs">{item.label}</p>
                        <p className={`text-xs font-semibold mt-0.5 ${item.ok ? 'text-green-400' : 'text-red-400'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {page.title && <p className="text-slate-600 text-xs mt-2 truncate">"{page.title}"</p>}
                </Card>
              ))}

              {crawl.crossPageIssues?.length > 0 && (
                <Card className="p-4 border-yellow-500/30">
                  <p className="text-yellow-400 text-sm font-semibold mb-3">Cross-Page Issues</p>
                  <div className="flex flex-col gap-2">
                    {crawl.crossPageIssues.map((issue, i) => (
                      <div key={i} className="border-b border-slate-700/50 last:border-0 pb-2 last:pb-0">
                        <p className="text-white text-sm">{issue.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{issue.detail}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </Section>
        )}

        {/* Priority Matrix */}
        {issues.length > 0 && (
          <Section title="Priority Matrix — Impact vs Effort">
            <PriorityMatrix issues={issues} />
          </Section>
        )}

        {/* AI Recommendations */}
        <Section title="AI Recommendations">
          <div className="flex flex-col gap-3">
            {recommendations.map((rec, i) => (
              <Card key={i} className="p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[rec.priority]}`}>{rec.priority}</span>
                  <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{rec.pillar}</span>
                </div>
                <p className="text-white font-semibold text-sm">{rec.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{rec.description}</p>
                {rec.reasoningTrace && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Reasoning Trace</p>
                    <p className="text-slate-400 text-xs leading-relaxed font-mono">{rec.reasoningTrace}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}