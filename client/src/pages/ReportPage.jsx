import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import jsPDF from 'jspdf'

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

export default function ReportPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedIssue, setExpandedIssue] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('auditResult')
    if (!stored) { navigate('/'); return }
    setResult(JSON.parse(stored))
  }, [navigate])

  if (!result) return null

  const { seo, technical, content, social, issues = [], recommendations = [], pageSpeed, crawl } = result

  const overallScore = Math.round((seo.score + technical.score + content.score + social.score) / 4)

  const criticalCount = issues.filter(i => i.severity === 'Critical').length
  const highCount = issues.filter(i => i.severity === 'High').length
  const quickWins = issues.filter(i => i.effort === 'Quick Win').length

  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 }
  const filters = ['All', 'Critical', 'High', 'Medium', 'Low', 'Informational']
  const filteredIssues = (activeFilter === 'All' ? issues : issues.filter(i => i.severity === activeFilter))
    .sort((a, b) => (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0))

  const pillars = [
    { name: 'SEO Health', score: seo.score },
    { name: 'Technical', score: technical.score },
    { name: 'Content', score: content.score },
    { name: 'Social', score: social.score },
  ]

  const scoreColor = (s) => s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'
  const scoreLabel = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical'
  const scoreCls = (s) => s >= 75 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

  // ── PDF Export ─────────────────────────────────────────────
  async function handleExportPDF() {
    setExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const M = 16
      const col = W - M * 2
      let y = 20

      const rgb = (hex) => [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
      const tc = (hex) => { const [r,g,b] = rgb(hex); pdf.setTextColor(r,g,b) }
      const fc = (hex) => { const [r,g,b] = rgb(hex); pdf.setFillColor(r,g,b) }
      const dc = (hex) => { const [r,g,b] = rgb(hex); pdf.setDrawColor(r,g,b) }
      const darkBg = () => { fc('#0f172a'); dc('#0f172a'); pdf.rect(0,0,210,297,'FD') }
      const newPage = (needed = 20) => {
        if (y + needed > 278) { pdf.addPage(); darkBg(); y = 20 }
      }
      const sc = (s) => s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'

      darkBg()

      // Cover
      pdf.setFontSize(28); pdf.setFont('helvetica','bold'); tc('#6366f1')
      pdf.text('AuditIQ', M, y)
      pdf.setFontSize(11); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('AI-Powered Digital Marketing Audit Report', M, y+9)
      y += 18
      pdf.setFontSize(8); tc('#64748b')
      pdf.text(`URL: ${result.url}`, M, y); y += 5
      pdf.text(`Date: ${new Date(result.timestamp).toLocaleString()}`, M, y); y += 8
      dc('#334155'); pdf.setLineWidth(0.3); pdf.line(M, y, W-M, y); y += 8

      // Overall Score
      fc('#1e293b'); dc('#334155')
      pdf.roundedRect(M, y, col, 24, 2, 2, 'FD')
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('Overall Score', W/2, y+7, { align: 'center' })
      pdf.setFontSize(24); pdf.setFont('helvetica','bold')
      const [or,og,ob] = rgb(sc(overallScore)); pdf.setTextColor(or,og,ob)
      pdf.text(`${overallScore}/100`, W/2, y+19, { align: 'center' })
      y += 32

      // Summary stats
      const stats = [
        { label: 'Critical Issues', value: criticalCount, color: '#f87171' },
        { label: 'High Priority', value: highCount, color: '#fb923c' },
        { label: 'Quick Wins', value: quickWins, color: '#4ade80' },
        { label: 'Pages Crawled', value: crawl?.pagesCrawled || 1, color: '#818cf8' },
      ]
      const statW = (col - 9) / 4
      stats.forEach((s, i) => {
        const x = M + i * (statW + 3)
        fc('#1e293b'); dc('#334155')
        pdf.roundedRect(x, y, statW, 18, 2, 2, 'FD')
        pdf.setFontSize(14); pdf.setFont('helvetica','bold')
        const [r,g,b] = rgb(s.color); pdf.setTextColor(r,g,b)
        pdf.text(`${s.value}`, x + statW/2, y+10, { align: 'center' })
        pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
        pdf.text(s.label, x + statW/2, y+15, { align: 'center' })
      })
      y += 26

      // Pillar scores
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Score Breakdown', M, y); y += 6
      const cardW = (col - 5) / 2
      const cardData = [
        { name: 'SEO Health', score: seo.score },
        { name: 'Technical', score: technical.score },
        { name: 'Content Quality', score: content.score },
        { name: 'Social Presence', score: social.score },
      ]
      for (let row = 0; row < 2; row++) {
        newPage(24)
        for (let c2 = 0; c2 < 2; c2++) {
          const p = cardData[row*2+c2]
          const x = M + c2*(cardW+5)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(x, y, cardW, 20, 2, 2, 'FD')
          pdf.setFontSize(7); pdf.setFont('helvetica','normal'); tc('#94a3b8')
          pdf.text(p.name, x+4, y+6)
          pdf.setFontSize(15); pdf.setFont('helvetica','bold'); tc('#ffffff')
          pdf.text(`${p.score}`, x+4, y+15)
          pdf.setFontSize(7)
          const [r,g,b] = rgb(sc(p.score)); pdf.setTextColor(r,g,b)
          pdf.text(scoreLabel(p.score), x+cardW-3, y+15, { align: 'right' })
        }
        y += 24
      }
      y += 4

      // Score bars
      newPage(70)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Score Overview', M, y); y += 6
      const barCardH = cardData.length * 15 + 10
      fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
      pdf.rect(M, y, col, barCardH, 'FD')
      const lW = 30; const sW = 18; const tW = col - lW - sW - 10; const tX = M+5+lW
      let bY = y+9
      cardData.forEach((p) => {
        pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#94a3b8')
        pdf.text(p.name, M+4, bY+4)
        fc('#0f172a'); dc('#0f172a'); pdf.rect(tX, bY, tW, 5, 'FD')
        if (p.score > 0) {
          const fw = (p.score/100)*tW
          const [r,g,b] = rgb(sc(p.score)); pdf.setFillColor(r,g,b); pdf.setDrawColor(r,g,b)
          pdf.rect(tX, bY, fw, 5, 'FD')
        }
        pdf.setFontSize(8); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text(`${p.score}/100`, tX+tW+3, bY+4)
        bY += 15
      })
      y += barCardH + 8

      // PageSpeed
      if (pageSpeed) {
        newPage(60)
        pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text('Core Web Vitals', M, y); y += 6
        fc('#1e293b'); dc('#334155')
        pdf.rect(M, y, col, 50, 'FD')
        const vitals = Object.entries(pageSpeed.coreWebVitals)
        const vW = col / 3
        vitals.slice(0,6).forEach(([key, v], i) => {
          const row = Math.floor(i/3); const col2 = i%3
          const vx = M + col2*vW + vW/2
          const vy = y + 10 + row*24
          const vc = v.status === 'Good' ? '#4ade80' : v.status === 'Needs Improvement' ? '#facc15' : '#f87171'
          pdf.setFontSize(8); pdf.setFont('helvetica','bold')
          const [r,g,b] = rgb(vc); pdf.setTextColor(r,g,b)
          pdf.text(v.value, vx, vy, { align: 'center' })
          pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
          pdf.text(key, vx, vy+5, { align: 'center' })
          pdf.setFontSize(6); tc(vc)
          pdf.text(v.status, vx, vy+9, { align: 'center' })
        })
        y += 58
      }

      // Issues
      newPage(20)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text(`Issues Found (${issues.length})`, M, y); y += 7
      const sevColors = { Critical: '#f87171', High: '#fb923c', Medium: '#facc15', Low: '#4ade80', Informational: '#60a5fa' }
      const topIssues = [...issues].sort((a,b) => (severityOrder[a.severity]||0)-(severityOrder[b.severity]||0)).slice(0,12)
      topIssues.forEach((issue) => {
        const lines = pdf.splitTextToSize(issue.fix, col-8)
        const h = 7 + 6 + lines.length * 4 + 5
        newPage(h+4)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, h, 2, 2, 'FD')
        const sc2 = sevColors[issue.severity] || '#94a3b8'
        const [r,g,b] = rgb(sc2); pdf.setTextColor(r,g,b)
        pdf.setFontSize(7); pdf.setFont('helvetica','bold')
        pdf.text(issue.severity, M+4, y+6)
        tc('#64748b'); pdf.setFont('helvetica','normal')
        pdf.text(`· ${issue.pillar} · ${issue.effort}`, M+4+pdf.getTextWidth(issue.severity)+2, y+6)
        tc('#ffffff'); pdf.setFontSize(8); pdf.setFont('helvetica','bold')
        pdf.text(issue.title, M+4, y+12)
        tc('#94a3b8'); pdf.setFontSize(7); pdf.setFont('helvetica','normal')
        pdf.text(lines, M+4, y+18)
        y += h+4
      })

      // Keywords
      if (seo.topKeywords?.length > 0) {
        newPage(60)
        pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text('Keyword Analysis', M, y); y += 6
        fc('#1e293b'); dc('#334155')
        pdf.rect(M, y, col, seo.topKeywords.length*12+8, 'FD')
        let kY = y+8
        seo.topKeywords.forEach((kw) => {
          pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#ffffff')
          pdf.text(kw.word, M+4, kY)
          fc('#0f172a'); dc('#0f172a')
          pdf.rect(M+30, kY-4, 80, 5, 'FD')
          const kfw = Math.min((kw.density/5)*80, 80)
          pdf.setFillColor(99,102,241); pdf.setDrawColor(99,102,241)
          pdf.rect(M+30, kY-4, kfw, 5, 'FD')
          tc('#64748b'); pdf.setFontSize(7)
          pdf.text(`${kw.density}%  ×${kw.count}`, M+114, kY)
          kY += 12
        })
        y += seo.topKeywords.length*12+16
      }

      // Recommendations
      newPage(20)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('AI Recommendations', M, y); y += 7
      const pColors = { High: '#f87171', Medium: '#facc15', Low: '#4ade80' }
      recommendations.forEach((rec) => {
        const lines = pdf.splitTextToSize(rec.description, col-8)
        const h = 8+6+lines.length*4+5
        newPage(h+4)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, h, 2, 2, 'FD')
        const [r,g,b] = rgb(pColors[rec.priority]||'#94a3b8'); pdf.setTextColor(r,g,b)
        pdf.setFontSize(7); pdf.setFont('helvetica','bold')
        pdf.text(rec.priority, M+4, y+6)
        tc('#64748b'); pdf.setFont('helvetica','normal')
        pdf.text(`· ${rec.pillar}`, M+4+pdf.getTextWidth(rec.priority)+2, y+6)
        tc('#ffffff'); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
        pdf.text(rec.title, M+4, y+13)
        tc('#94a3b8'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal')
        pdf.text(lines, M+4, y+19)
        y += h+4
      })

      // Footer
      newPage(12); y+=4
      dc('#334155'); pdf.line(M,y,W-M,y); y+=5
      tc('#475569'); pdf.setFontSize(7)
      pdf.text('Generated by AuditIQ — AI-Powered Digital Marketing Audit', W/2, y, { align: 'center' })

      pdf.save('AuditIQ-Report.pdf')
    } catch(err) {
      console.error('PDF export failed:', err)
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
                <p className="text-slate-500 text-xs mt-1">{issues.length} issues detected</p>
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
              </Card>
            ))}
          </div>

          {/* Score Bars */}
          <Card className="p-5 mt-4 flex flex-col gap-4">
            {pillars.map((p) => (
              <div key={p.name} className="flex items-center gap-4">
                <span className="text-slate-400 text-sm w-28 shrink-0">{p.name}</span>
                <div className="flex-1 bg-[#0f172a] rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${p.score}%`, backgroundColor: scoreColor(p.score) }} />
                </div>
                <span className="text-white text-sm font-semibold w-14 text-right shrink-0">{p.score}/100</span>
              </div>
            ))}
          </Card>
        </Section>

        {/* Core Web Vitals */}
        {pageSpeed && (
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
                <div key={i} className={`rounded-xl border p-4 cursor-pointer transition-all ${cfg.bg}`}
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
                          {issue.impact && (
                            <span className="text-xs text-slate-600">Impact: {issue.impact}</span>
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
              </Card>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}