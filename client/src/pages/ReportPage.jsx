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

function PriorityMatrix({ issues }) {
  const filtered = issues.filter(i => i.severity !== 'Informational' && i.effort && i.impact)

  const effortX = { 'Quick Win': 20, 'Medium': 50, 'Complex': 80 }
  const impactY = { 'Low': 80, 'Medium': 50, 'High': 20 }
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
            const cx = 10 + (effortX[issue.effort] || 50)
            const cy = 5 + (impactY[issue.impact] || 50)
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
    setResult(JSON.parse(stored))
  }, [navigate])

  if (!result) return null

  const { seo, technical, content, social, issues = [], recommendations = [], pageSpeed, crawl } = result

  const overallScore = Math.round(
    seo.score * 0.4 +
    technical.score * 0.3 +
    content.score * 0.2 +
    social.score * 0.1
  )

  const actionableIssues = issues.filter(i => i.severity !== 'Informational')
  const criticalCount = actionableIssues.filter(i => i.severity === 'Critical').length
  const highCount = actionableIssues.filter(i => i.severity === 'High').length
  const quickWins = actionableIssues.filter(i => i.effort === 'Quick Win').length

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

async function handleExportPDF() {
    setExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const M = 16; const col = W - M * 2; let y = 20
      const rgb = (hex) => [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
      const tc = (hex) => { const [r,g,b] = rgb(hex); pdf.setTextColor(r,g,b) }
      const fc = (hex) => { const [r,g,b] = rgb(hex); pdf.setFillColor(r,g,b) }
      const dc = (hex) => { const [r,g,b] = rgb(hex); pdf.setDrawColor(r,g,b) }
      const darkBg = () => { fc('#0f172a'); dc('#0f172a'); pdf.rect(0,0,210,297,'FD') }
      const newPage = (needed = 20) => { if (y + needed > 278) { pdf.addPage(); darkBg(); y = 20 } }
      const sc = (s) => s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'
      const sl = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical'
      const sevColor = { Critical: '#f87171', High: '#fb923c', Medium: '#facc15', Low: '#4ade80', Informational: '#60a5fa' }
      const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 }

      // ── PAGE 1: COVER ─────────────────────────────────────────
      darkBg()

      // Top accent bar
      fc('#6366f1'); dc('#6366f1')
      pdf.rect(0, 0, 210, 8, 'FD')

      // Logo area
      y = 30
      pdf.setFontSize(32); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Audit', M, y)
      tc('#6366f1')
      pdf.text('IQ', M + pdf.getTextWidth('Audit'), y)

      pdf.setFontSize(11); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('AI-Powered Digital Marketing Audit', M, y + 9)
      y += 24

      // Divider
      dc('#334155'); pdf.setLineWidth(0.3); pdf.line(M, y, W-M, y); y += 12

      // Report info block
      fc('#1e293b'); dc('#334155')
      pdf.roundedRect(M, y, col, 36, 3, 3, 'FD')

      pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#64748b')
      pdf.text('WEBSITE AUDITED', M+6, y+8)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text(result.url, M+6, y+15)

      pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#64748b')
      pdf.text('REPORT DATE', M+6, y+24)
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text(new Date(result.timestamp).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), M+6, y+30)

      // Date on right
      tc('#64748b'); pdf.setFontSize(8)
      pdf.text('GENERATED BY', W-M-40, y+8)
      tc('#6366f1'); pdf.setFontSize(10); pdf.setFont('helvetica','bold')
      pdf.text('AuditIQ Platform', W-M-40, y+15)
      tc('#64748b'); pdf.setFontSize(8); pdf.setFont('helvetica','normal')
      pdf.text('auditiq-ezyd.vercel.app', W-M-40, y+24)

      y += 46

      // Overall score hero
      fc('#1e293b'); dc('#6366f1'); pdf.setLineWidth(0.8)
      pdf.roundedRect(M, y, col, 40, 3, 3, 'FD')
      pdf.setFontSize(10); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('OVERALL AUDIT SCORE', W/2, y+10, { align: 'center' })
      pdf.setFontSize(36); pdf.setFont('helvetica','bold')
      const [or,og,ob] = rgb(sc(overallScore)); pdf.setTextColor(or,og,ob)
      pdf.text(`${overallScore}`, W/2, y+28, { align: 'center' })
      pdf.setFontSize(12); tc('#94a3b8')
      pdf.text('/100', W/2 + 10, y+28)
      pdf.setFontSize(10); pdf.setFont('helvetica','normal')
      const [slr,slg,slb] = rgb(sc(overallScore)); pdf.setTextColor(slr,slg,slb)
      pdf.text(sl(overallScore), W/2, y+36, { align: 'center' })
      y += 50

      // 4 stat boxes
      const stats = [
        { label: 'ISSUES FOUND', value: issues.length, color: '#f87171' },
        { label: 'CRITICAL', value: criticalCount, color: '#f87171' },
        { label: 'QUICK WINS', value: quickWins, color: '#4ade80' },
        { label: 'PAGES CRAWLED', value: crawl?.pagesCrawled || 1, color: '#818cf8' },
      ]
      const statW = (col - 9) / 4
      stats.forEach((s, i) => {
        const x = M + i*(statW+3)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(x, y, statW, 22, 2, 2, 'FD')
        pdf.setFontSize(18); pdf.setFont('helvetica','bold')
        const [r,g,b] = rgb(s.color); pdf.setTextColor(r,g,b)
        pdf.text(`${s.value}`, x+statW/2, y+13, { align: 'center' })
        pdf.setFontSize(5.5); pdf.setFont('helvetica','normal'); tc('#64748b')
        pdf.text(s.label, x+statW/2, y+19, { align: 'center' })
      })
      y += 32

      // Pillar score cards
      const cardData = [
        { name: 'SEO Health', score: seo.score },
        { name: 'Technical', score: technical.score },
        { name: 'Content Quality', score: content.score },
        { name: 'Social Presence', score: social.score },
      ]
      const cW = (col-6)/4
      cardData.forEach((p, i) => {
        const x = M + i*(cW+2)
        fc('#1e293b'); dc('#334155')
        pdf.roundedRect(x, y, cW, 26, 2, 2, 'FD')
        pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
        pdf.text(p.name.toUpperCase(), x+cW/2, y+7, { align: 'center' })
        pdf.setFontSize(16); pdf.setFont('helvetica','bold')
        const [r,g,b] = rgb(sc(p.score)); pdf.setTextColor(r,g,b)
        pdf.text(`${p.score}`, x+cW/2, y+18, { align: 'center' })
        pdf.setFontSize(6); pdf.setFont('helvetica','normal')
        pdf.text(sl(p.score), x+cW/2, y+23, { align: 'center' })
      })
      y += 34

      // Score bars
      fc('#1e293b'); dc('#334155')
      pdf.roundedRect(M, y, col, cardData.length*13+6, 2, 2, 'FD')
      let bY = y+8
      const lW=28; const tW=col-lW-22; const tX=M+5+lW
      cardData.forEach(p => {
        pdf.setFontSize(7); pdf.setFont('helvetica','normal'); tc('#94a3b8')
        pdf.text(p.name, M+4, bY+3.5)
        fc('#0f172a'); dc('#0f172a'); pdf.rect(tX, bY, tW, 5, 'FD')
        if(p.score>0){
          const fw=(p.score/100)*tW
          const [r,g,b]=rgb(sc(p.score)); pdf.setFillColor(r,g,b); pdf.setDrawColor(r,g,b)
          pdf.rect(tX, bY, fw, 5, 'FD')
        }
        pdf.setFontSize(7); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text(`${p.score}/100`, tX+tW+3, bY+3.5)
        bY+=13
      })
      y += cardData.length*13+14

      // Footer page 1
      dc('#334155'); pdf.setLineWidth(0.3); pdf.line(M, 282, W-M, 282)
      tc('#475569'); pdf.setFontSize(7)
      pdf.text('AuditIQ — Confidential Audit Report', M, 287)
      pdf.text('Page 1', W-M, 287, { align: 'right' })

      // ── PAGE 2: PERFORMANCE + ISSUES ────────────────────────
      pdf.addPage(); darkBg()
      // accent bar
      fc('#6366f1'); dc('#6366f1'); pdf.rect(0,0,210,4,'FD')
      y = 16

      // Section header helper
      function sectionHeader(title) {
        newPage(16)
        fc('#1e293b'); dc('#334155')
        pdf.roundedRect(M, y, col, 10, 2, 2, 'FD')
        dc('#6366f1'); pdf.setLineWidth(0.5)
        pdf.line(M, y, M, y+10)
        pdf.setFontSize(10); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text(title, M+5, y+7)
        y += 16
      }

      // Page number helper
      let pageNum = 2
      function addPageFooter() {
        dc('#334155'); pdf.setLineWidth(0.3); pdf.line(M, 282, W-M, 282)
        tc('#475569'); pdf.setFontSize(7)
        pdf.text('AuditIQ — Confidential Audit Report', M, 287)
        pdf.text(`Page ${pageNum}`, W-M, 287, { align: 'right' })
        pageNum++
      }

      // Core Web Vitals
      if(pageSpeed) {
        sectionHeader('Core Web Vitals & Performance')

        // Lighthouse scores
        const lhScores = [
          { label: 'Performance', score: pageSpeed.performanceScore },
          { label: 'SEO', score: pageSpeed.seoScore },
          { label: 'Best Practices', score: pageSpeed.bestPracticesScore },
          { label: 'Accessibility', score: pageSpeed.accessibilityScore },
        ]
        const lW2 = (col-6)/4
        newPage(24)
        lhScores.forEach((s,i) => {
          const x = M+i*(lW2+2)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(x, y, lW2, 20, 2, 2, 'FD')
          pdf.setFontSize(14); pdf.setFont('helvetica','bold')
          const [r,g,b]=rgb(sc(s.score)); pdf.setTextColor(r,g,b)
          pdf.text(`${s.score}`, x+lW2/2, y+12, { align: 'center' })
          pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
          pdf.text(s.label.toUpperCase(), x+lW2/2, y+17, { align: 'center' })
        })
        y += 28

        // Vitals grid
        newPage(40)
        const vitals = Object.entries(pageSpeed.coreWebVitals)
        const vW2 = (col-4)/3
        vitals.forEach(([key,v],i) => {
          const row=Math.floor(i/3); const col2=i%3
          const x=M+col2*(vW2+2); const vy=y+row*22
          newPage(24)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(x, vy, vW2, 20, 2, 2, 'FD')
          const vc = v.status==='Good'?'#4ade80':v.status==='Needs Improvement'?'#facc15':'#f87171'
          pdf.setFontSize(10); pdf.setFont('helvetica','bold')
          const [r,g,b]=rgb(vc); pdf.setTextColor(r,g,b)
          pdf.text(v.value, x+vW2/2, vy+9, { align: 'center' })
          pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
          pdf.text(key, x+vW2/2, vy+13, { align: 'center' })
          pdf.setFontSize(6); const [r2,g2,b2]=rgb(vc); pdf.setTextColor(r2,g2,b2)
          pdf.text(v.status, x+vW2/2, vy+17, { align: 'center' })
        })
        y += Math.ceil(vitals.length/3)*22+6

        // Opportunities
        if(pageSpeed.opportunities?.length > 0) {
          newPage(20)
          pdf.setFontSize(8); pdf.setFont('helvetica','bold'); tc('#ffffff')
          pdf.text('Optimization Opportunities', M, y); y+=6
          pageSpeed.opportunities.forEach(o => {
            newPage(10)
            fc('#1e293b'); dc('#334155')
            pdf.roundedRect(M, y, col, 9, 1, 1, 'FD')
            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); tc('#ffffff')
            pdf.text(o.title, M+3, y+5.5, { maxWidth: col-30 })
            if(o.displayValue) { tc('#64748b'); pdf.text(o.displayValue, W-M-3, y+5.5, { align: 'right' }) }
            y+=11
          })
          y+=4
        }
      }

      addPageFooter()

      // ── ISSUES SECTION ─────────────────────────────────────
      pdf.addPage(); darkBg()
      fc('#6366f1'); dc('#6366f1'); pdf.rect(0,0,210,4,'FD')
      y = 16
      pageNum++

      sectionHeader(`Issues Audit — ${issues.length} Issues Found`)

      // Issues summary table header
      newPage(12)
      fc('#334155'); dc('#334155')
      pdf.rect(M, y, col, 8, 'FD')
      pdf.setFontSize(7); pdf.setFont('helvetica','bold'); tc('#94a3b8')
      pdf.text('SEVERITY', M+3, y+5.5)
      pdf.text('PILLAR', M+28, y+5.5)
      pdf.text('ISSUE', M+50, y+5.5)
      pdf.text('EFFORT', W-M-20, y+5.5, { align: 'right' })
      y+=10

      const sortedIssues = [...issues].sort((a,b) => (severityOrder[a.severity]||0)-(severityOrder[b.severity]||0))
      sortedIssues.forEach(issue => {
        const descLines = pdf.splitTextToSize(issue.detail || '', col-8)
        const fixLines = pdf.splitTextToSize(issue.fix || '', col-8)
        const h = 8 + descLines.length*4 + fixLines.length*4 + 6
        newPage(h+4)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, h, 2, 2, 'FD')

        // Severity color bar
        const sc2 = sevColor[issue.severity] || '#94a3b8'
        const [r,g,b]=rgb(sc2); pdf.setFillColor(r,g,b); pdf.setDrawColor(r,g,b)
        pdf.rect(M, y, 2, h, 'F')

        // Header row
        pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(r,g,b)
        pdf.text(issue.severity, M+4, y+6)
        tc('#64748b'); pdf.setFont('helvetica','normal')
        pdf.text(`${issue.pillar}`, M+26, y+6)
        tc('#ffffff'); pdf.setFont('helvetica','bold'); pdf.setFontSize(8)
        pdf.text(issue.title, M+46, y+6, { maxWidth: col-70 })
        tc('#64748b'); pdf.setFontSize(7); pdf.setFont('helvetica','normal')
        pdf.text(issue.effort||'', W-M-3, y+6, { align: 'right' })

        // Detail
        tc('#94a3b8'); pdf.setFontSize(7); pdf.setFont('helvetica','normal')
        pdf.text(descLines, M+4, y+12)

        // Fix
        const fixY = y+12+descLines.length*4+2
        tc('#818cf8'); pdf.setFont('helvetica','italic')
        pdf.text('Fix: ', M+4, fixY)
        tc('#6366f1'); pdf.setFont('helvetica','normal')
        pdf.text(fixLines, M+4+pdf.getTextWidth('Fix: '), fixY)

        y += h+4
      })

      addPageFooter()

      // ── PAGE: KEYWORDS + PRIORITY MATRIX ───────────────────
      pdf.addPage(); darkBg()
      fc('#6366f1'); dc('#6366f1'); pdf.rect(0,0,210,4,'FD')
      y = 16
      pageNum++

      // Keywords
      if(seo.topKeywords?.length > 0) {
        sectionHeader('Keyword Analysis')
        newPage(16)

        // Keyword placement check
        const placements = [
          { label: 'In Title', val: seo.keywordInTitle },
          { label: 'In H1', val: seo.keywordInH1 },
          { label: 'In Meta', val: seo.keywordInMeta },
          { label: 'In URL', val: seo.keywordInURL },
        ]
        const pW = (col-6)/4
        placements.forEach((p,i) => {
          const x=M+i*(pW+2)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(x, y, pW, 14, 2, 2, 'FD')
          pdf.setFontSize(10); pdf.setFont('helvetica','bold')
          const color = p.val?'#4ade80':'#f87171'
          const [r,g,b]=rgb(color); pdf.setTextColor(r,g,b)
          pdf.text(p.val ? 'YES' : 'NO', x+pW/2, y+8, { align: 'center' })
          pdf.setFontSize(6); pdf.setFont('helvetica','normal'); tc('#64748b')
          pdf.text(p.label, x+pW/2, y+12, { align: 'center' })
        })
        y+=20

        pdf.setFontSize(7); tc('#64748b')
        pdf.text(`Primary keyword: "${seo.primaryKeyword}"`, M, y); y+=6

        // Keyword bars
        fc('#1e293b'); dc('#334155')
        pdf.roundedRect(M, y, col, seo.topKeywords.length*12+6, 2, 2, 'FD')
        let kY=y+8
        seo.topKeywords.forEach(kw => {
          pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#ffffff')
          pdf.text(kw.word, M+4, kY)
          fc('#0f172a'); dc('#0f172a'); pdf.rect(M+34, kY-4, 90, 5, 'FD')
          const kfw=Math.min((kw.density/5)*90,90)
          pdf.setFillColor(99,102,241); pdf.setDrawColor(99,102,241)
          pdf.rect(M+34, kY-4, kfw, 5, 'FD')
          tc('#64748b'); pdf.setFontSize(7)
          pdf.text(`${kw.density}%  x${kw.count}`, M+128, kY)
          kY+=12
        })
        y+=seo.topKeywords.length*12+14
      }

      // Priority Matrix as table
      newPage(20)
      sectionHeader('Priority Matrix')

      const matrixIssues = [...issues]
        .filter(i => i.severity !== 'Informational')
        .sort((a,b) => (severityOrder[a.severity]||0)-(severityOrder[b.severity]||0))

      // Table header
      newPage(10)
      fc('#334155'); dc('#334155')
      pdf.rect(M, y, col, 8, 'FD')
      pdf.setFontSize(7); pdf.setFont('helvetica','bold'); tc('#94a3b8')
      pdf.text('ISSUE', M+3, y+5.5)
      pdf.text('SEVERITY', W-M-50, y+5.5)
      pdf.text('IMPACT', W-M-30, y+5.5)
      pdf.text('EFFORT', W-M-10, y+5.5, { align: 'right' })
      y+=10

      matrixIssues.forEach(issue => {
        newPage(10)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, 9, 1, 1, 'FD')
        const sc3 = sevColor[issue.severity] || '#94a3b8'
        const [r,g,b]=rgb(sc3); pdf.setTextColor(r,g,b)
        pdf.setFontSize(6); pdf.setFont('helvetica','bold')
        pdf.text(issue.severity, W-M-50, y+5.5)
        tc('#ffffff'); pdf.setFont('helvetica','normal'); pdf.setFontSize(7)
        pdf.text(issue.title, M+3, y+5.5, { maxWidth: col-70 })
        tc('#64748b'); pdf.setFontSize(6)
        pdf.text(issue.impact||'', W-M-30, y+5.5)
        pdf.text(issue.effort||'', W-M-10, y+5.5, { align: 'right' })
        y+=11
      })

      addPageFooter()

      // ── PAGE: CRAWL + RECOMMENDATIONS ──────────────────────
      pdf.addPage(); darkBg()
      fc('#6366f1'); dc('#6366f1'); pdf.rect(0,0,210,4,'FD')
      y = 16
      pageNum++

      // Pages crawled
      if(crawl?.pages?.length > 0) {
        sectionHeader(`Pages Crawled (${crawl.pagesCrawled})`)
        crawl.pages.forEach(page => {
          newPage(28)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(M, y, col, 26, 2, 2, 'FD')
          tc('#6366f1'); pdf.setFontSize(7); pdf.setFont('helvetica','normal')
          pdf.text(page.url, M+4, y+6, { maxWidth: col-8 })
          const cols2 = [
            { label: 'TITLE', val: page.title || 'Missing', ok: !!page.title },
            { label: 'META DESC', val: page.hasMetaDescription?'Present':'Missing', ok: page.hasMetaDescription },
            { label: 'H1', val: page.hasH1?`${page.h1Count} found`:'Missing', ok: page.hasH1&&page.h1Count===1 },
            { label: 'SCHEMA', val: page.hasSchema?'Present':'Missing', ok: page.hasSchema },
          ]
          const colW2 = col/4
          cols2.forEach((c,i) => {
            const x=M+i*colW2
            pdf.setFontSize(5.5); pdf.setFont('helvetica','normal'); tc('#64748b')
            pdf.text(c.label, x+4, y+14)
            pdf.setFontSize(7); pdf.setFont('helvetica','bold')
            const [r,g,b]=rgb(c.ok?'#4ade80':'#f87171'); pdf.setTextColor(r,g,b)
            pdf.text(c.val, x+4, y+20)
          })
          y+=30
        })

        if(crawl.crossPageIssues?.length > 0) {
          newPage(16)
          pdf.setFontSize(8); pdf.setFont('helvetica','bold'); tc('#facc15')
          pdf.text('Cross-Page Issues', M, y); y+=6
          crawl.crossPageIssues.forEach(issue => {
            newPage(12)
            fc('#1e293b'); dc('#facc15'); pdf.setLineWidth(0.3)
            pdf.roundedRect(M, y, col, 10, 2, 2, 'FD')
            tc('#ffffff'); pdf.setFontSize(7); pdf.setFont('helvetica','bold')
            pdf.text(issue.title, M+4, y+6.5)
            y+=12
          })
          y+=4
        }
      }

      // AI Recommendations
      sectionHeader('AI Recommendations')
      const pColors = { High: '#f87171', Medium: '#facc15', Low: '#4ade80' }
      recommendations.forEach(rec => {
        const lines = pdf.splitTextToSize(rec.description, col-8)
        const h = 8+6+lines.length*4+4
        newPage(h+4)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, h, 2, 2, 'FD')
        const rc = pColors[rec.priority]||'#94a3b8'
        const [r,g,b]=rgb(rc); pdf.setTextColor(r,g,b)
        pdf.setFontSize(7); pdf.setFont('helvetica','bold')
        pdf.text(rec.priority, M+4, y+6)
        tc('#64748b'); pdf.setFont('helvetica','normal')
        pdf.text(`· ${rec.pillar}`, M+4+pdf.getTextWidth(rec.priority)+2, y+6)
        tc('#ffffff'); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
        pdf.text(rec.title, M+4, y+13)
        tc('#94a3b8'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal')
        pdf.text(lines, M+4, y+19)
        y+=h+4
      })

      addPageFooter()

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
              </Card>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}