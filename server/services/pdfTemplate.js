/**
 * PDF Template Builder — produces self-contained HTML for Puppeteer page.pdf()
 * All styles are inline (no external assets). Tailwind oklch values mapped to HEX.
 */

function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function scoreColor(s) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'
}

function scoreLabel(s) {
  return s >= 75 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical'
}

const severityColor = {
  Critical: '#f87171',
  High: '#fb923c',
  Medium: '#facc15',
  Low: '#4ade80',
  Informational: '#60a5fa',
}

const priorityColor = {
  High: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  Medium: { bg: 'rgba(234,179,8,0.15)', text: '#facc15', border: 'rgba(234,179,8,0.3)' },
  Low: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
}

const effortColor = {
  'Quick Win': { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  Medium: { bg: 'rgba(234,179,8,0.15)', text: '#facc15' },
  Complex: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  Informational: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
}

function scoreRingSvg(score, size = 80) {
  const radius = size / 2 - 6
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = scoreColor(score)
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="animation:none!important">
    <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="#1e293b" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${color}" stroke-width="6"
      stroke-dasharray="${filled} ${circumference - filled}" stroke-linecap="round"
      transform="rotate(-90 ${size/2} ${size/2})" style="animation:none!important"/>
    <text x="${size/2}" y="${size/2+5}" text-anchor="middle" fill="${color}" font-size="${size<70?13:18}" font-weight="bold">${score}</text>
  </svg>`
}

function priorityMatrixSvg(issues) {
  const effortX = { 'Quick Win': 20, Medium: 50, Complex: 80 }
  const impactY = { Low: 80, Medium: 50, High: 20 }
  const sevDotColor = { Critical: '#f87171', High: '#fb923c', Medium: '#facc15', Low: '#4ade80' }

  const filtered = issues.filter(i => i.severity !== 'Informational' && (i.effort || i.effortScore) && (i.impact || i.impactScore))

  const getEffortPos = (issue) => {
    if (issue.effortScore !== undefined) return Math.max(10, Math.min(90, issue.effortScore * 10))
    return effortX[issue.effort] || 50
  }
  const getImpactPos = (issue) => {
    if (issue.impactScore !== undefined) return 100 - Math.max(10, Math.min(90, issue.impactScore * 10))
    return impactY[issue.impact] || 50
  }

  const quadrants = [
    { x: 10, y: 5, w: 50, h: 50, fill: 'rgba(99,102,241,0.08)' },
    { x: 60, y: 5, w: 50, h: 50, fill: 'rgba(251,146,60,0.05)' },
    { x: 10, y: 55, w: 50, h: 50, fill: 'rgba(74,222,128,0.05)' },
    { x: 60, y: 55, w: 50, h: 50, fill: 'rgba(100,116,139,0.05)' },
  ]

  let dots = ''
  filtered.forEach((issue, i) => {
    const effortPos = getEffortPos(issue)
    const cx = 10 + (effortPos * 0.8)
    const impactPos = getImpactPos(issue)
    const cy = 5 + (impactPos * 0.95)
    const jx = ((i * 7) % 14) - 7
    const jy = ((i * 11) % 14) - 7
    const color = sevDotColor[issue.severity] || '#94a3b8'
    dots += `<circle cx="${cx + jx*0.3}" cy="${cy + jy*0.3}" r="2.5" fill="${color}" fill-opacity="0.85" stroke="#0f172a" stroke-width="0.5" style="animation:none!important"/>`
  })

  return `<svg viewBox="0 0 120 100" style="width:100%;animation:none!important" preserveAspectRatio="xMidYMid meet">
    ${quadrants.map(q => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${q.fill}"/>`).join('')}
    <line x1="60" y1="5" x2="60" y2="105" stroke="#334155" stroke-width="0.3" stroke-dasharray="1,1"/>
    <line x1="10" y1="55" x2="110" y2="55" stroke="#334155" stroke-width="0.3" stroke-dasharray="1,1"/>
    <line x1="10" y1="5" x2="10" y2="105" stroke="#475569" stroke-width="0.4"/>
    <line x1="10" y1="105" x2="110" y2="105" stroke="#475569" stroke-width="0.4"/>
    <text x="60" y="113" text-anchor="middle" fill="#64748b" font-size="4">Effort →</text>
    <text x="2" y="55" text-anchor="middle" fill="#64748b" font-size="3.5" transform="rotate(-90 2 55)">Impact ↑</text>
    ${['Quick Win','Medium','Complex'].map((l,i) => `<text x="${10+(i+0.5)*33.3}" y="109" text-anchor="middle" fill="#475569" font-size="3">${l}</text>`).join('')}
    ${['High','Medium','Low'].map((l,i) => `<text x="9.5" y="${5+(i+0.5)*33.3+1}" text-anchor="end" fill="#475569" font-size="2.8">${l}</text>`).join('')}
    <text x="35" y="14" text-anchor="middle" fill="#818cf8" font-size="3" font-weight="bold">⚡ Quick Wins</text>
    <text x="85" y="14" text-anchor="middle" fill="#fb923c" font-size="3" font-weight="bold">🎯 Strategic</text>
    <text x="35" y="64" text-anchor="middle" fill="#4ade80" font-size="3" font-weight="bold">📋 Nice to Have</text>
    <text x="85" y="64" text-anchor="middle" fill="#475569" font-size="3" font-weight="bold">⏸ Defer</text>
    ${dots}
  </svg>`
}

const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm 16mm; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .accent-bar { height: 8mm; background: #6366f1; margin: -20mm -16mm 0 -16mm; width: calc(100% + 32mm); }
  .accent-bar-sm { height: 4mm; background: #6366f1; margin: -20mm -16mm 0 -16mm; width: calc(100% + 32mm); }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .section-title .bar { width: 4px; height: 20px; background: #6366f1; border-radius: 4px; flex-shrink: 0; }
  .section-title h2 { color: #fff; font-size: 18px; font-weight: 700; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .text-slate400 { color: #94a3b8; }
  .text-slate500 { color: #64748b; }
  .text-xs { font-size: 12px; }
  .text-sm { font-size: 14px; }
  .text-lg { font-size: 18px; }
  .text-2xl { font-size: 24px; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .footer { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; border-top: 1px solid #334155; padding-top: 4mm; display: flex; justify-content: space-between; }
  .footer span { color: #475569; font-size: 10px; }
  svg * { animation: none !important; transition: none !important; }
  .score-bar-track { background: #0f172a; border-radius: 9999px; height: 10px; overflow: hidden; flex: 1; }
  .score-bar-fill { height: 10px; border-radius: 9999px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .issue-card { border-radius: 12px; border: 1px solid; padding: 16px; margin-bottom: 8px; }
  .color-bar { width: 4px; border-radius: 4px; flex-shrink: 0; }
`

function coverPage(data) {
  const { url, timestamp, overallScore, issues = [], crawl, seo, technical, content, social, pageSpeed } = data
  const safeCrawl = crawl || {}
  const criticalCount = issues.filter(i => i.severity === 'Critical').length
  const quickWins = issues.filter(i => i.severity !== 'Informational' && (i.effort === 'Quick Win' || (i.effortScore !== undefined && i.effortScore <= 3))).length
  const pagesCrawled = safeCrawl.pagesCrawled || 1
  const dateStr = new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const pillars = [
    { name: 'SEO Health', score: seo.score },
    { name: 'Technical', score: technical.score },
    { name: 'Content Quality', score: content.score },
    { name: 'Social Presence', score: social.score },
  ]
  if (pageSpeed && pageSpeed.performanceScore !== undefined) {
    pillars.push({ name: 'Performance', score: pageSpeed.performanceScore })
  }

  const pillarCards = pillars.map(p => `
    <div class="card" style="text-align:center;padding:12px 8px">
      ${scoreRingSvg(p.score, 70)}
      <div class="text-xs text-slate400" style="margin-top:8px">${esc(p.name)}</div>
      <div class="text-xs font-semibold" style="color:${scoreColor(p.score)}">${scoreLabel(p.score)}</div>
    </div>`).join('')

  const scoreBars = pillars.map(p => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <span class="text-sm text-slate400" style="width:110px;flex-shrink:0">${esc(p.name)}</span>
      <div class="score-bar-track" style="flex:1">
        <div class="score-bar-fill" style="width:${p.score}%;background:${scoreColor(p.score)}"></div>
      </div>
      <span class="text-sm font-bold" style="width:60px;text-align:right;flex-shrink:0">${p.score}/100</span>
    </div>`).join('')

  const colCount = pillars.length > 4 ? pillars.length : 4

  return `<div class="page">
  <div class="accent-bar"></div>

  <div style="margin-top:24px">
    <span style="font-size:32px;font-weight:700;color:#fff">Audit</span><span style="font-size:32px;font-weight:700;color:#6366f1">IQ</span>
  </div>
  <div class="text-xs text-slate400" style="margin-top:4px">AI-Powered Digital Marketing Audit</div>

  <div style="border-top:1px solid #334155;margin:20px 0"></div>

  <div class="card" style="padding:20px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div class="text-xs text-slate500" style="margin-bottom:4px">WEBSITE AUDITED</div>
      <div class="text-sm font-bold" style="word-break:break-all">${esc(url)}</div>
      <div class="text-xs text-slate500" style="margin-top:10px">REPORT DATE</div>
      <div class="text-xs text-slate400">${esc(dateStr)}</div>
    </div>
    <div style="text-align:right">
      <div class="text-xs text-slate500" style="margin-bottom:4px">GENERATED BY</div>
      <div class="text-sm font-bold" style="color:#6366f1">AuditIQ Platform</div>
      <div class="text-xs text-slate500" style="margin-top:4px">auditiq.app</div>
    </div>
  </div>

  <div class="card" style="text-align:center;padding:24px;border-color:#6366f1">
    <div class="text-xs text-slate400" style="margin-bottom:8px">OVERALL AUDIT SCORE</div>
    ${scoreRingSvg(overallScore, 90)}
    <div class="text-sm font-semibold" style="color:${scoreColor(overallScore)};margin-top:8px">${scoreLabel(overallScore)}</div>
  </div>

  <div class="grid-4" style="margin-top:12px">
    <div class="card" style="text-align:center;padding:12px">
      <div class="text-2xl font-bold" style="color:#f87171">${issues.length}</div>
      <div class="text-xs text-slate500" style="margin-top:4px">ISSUES FOUND</div>
    </div>
    <div class="card" style="text-align:center;padding:12px">
      <div class="text-2xl font-bold" style="color:#f87171">${criticalCount}</div>
      <div class="text-xs text-slate500" style="margin-top:4px">CRITICAL</div>
    </div>
    <div class="card" style="text-align:center;padding:12px">
      <div class="text-2xl font-bold" style="color:#4ade80">${quickWins}</div>
      <div class="text-xs text-slate500" style="margin-top:4px">QUICK WINS</div>
    </div>
    <div class="card" style="text-align:center;padding:12px">
      <div class="text-2xl font-bold" style="color:#818cf8">${pagesCrawled}</div>
      <div class="text-xs text-slate500" style="margin-top:4px">PAGES CRAWLED</div>
    </div>
  </div>

  <div class="section-title" style="margin-top:20px">
    <div class="bar"></div><h2>Score Breakdown</h2>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${colCount},1fr);gap:12px">
    ${pillarCards}
  </div>
  <div class="card" style="margin-top:12px;padding:20px">
    ${scoreBars}
  </div>

  <div class="footer"><span>AuditIQ — Confidential Audit Report</span><span>Page 1</span></div>
</div>`
}

function vitalsPage(data) {
  const { pageSpeed } = data
  if (!pageSpeed || !pageSpeed.coreWebVitals) return ''

  const lhScores = [
    { label: 'Performance', score: pageSpeed.performanceScore },
    { label: 'SEO', score: pageSpeed.seoScore },
    { label: 'Best Practices', score: pageSpeed.bestPracticesScore },
    { label: 'Accessibility', score: pageSpeed.accessibilityScore },
  ]

  const lhCards = lhScores.map(s => `
    <div class="card" style="text-align:center;padding:12px">
      ${scoreRingSvg(s.score, 60)}
      <div class="text-xs text-slate400" style="margin-top:6px">${esc(s.label)}</div>
    </div>`).join('')

  const vitalStatus = { Good: '#4ade80', 'Needs Improvement': '#facc15', Poor: '#f87171' }
  const vitals = Object.entries(pageSpeed.coreWebVitals).map(([key, v]) => `
    <div class="card" style="padding:12px">
      <div class="text-xs text-slate500" style="margin-bottom:4px">${esc(key)}</div>
      <div class="text-lg font-bold">${esc(v.value)}</div>
      <div class="text-xs font-semibold" style="color:${vitalStatus[v.status] || '#94a3b8'};margin-top:4px">${esc(v.status)}</div>
      <div class="text-xs text-slate400" style="margin-top:4px;line-height:1.5">${esc(v.description)}</div>
    </div>`).join('')

  let opportunities = ''
  if (pageSpeed.opportunities?.length > 0) {
    opportunities = `
    <div class="card" style="padding:16px;margin-top:12px">
      <div class="text-sm font-bold mb-4">Optimization Opportunities</div>
      ${pageSpeed.opportunities.map(o => {
        const imp = o.impact === 'High'
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.5)">
          <div>
            <div class="text-sm">${esc(o.title)}</div>
            ${o.displayValue ? `<div class="text-xs text-slate500" style="margin-top:2px">${esc(o.displayValue)}</div>` : ''}
          </div>
          <span class="badge" style="background:${imp?'rgba(239,68,68,0.15)':'rgba(234,179,8,0.15)'};color:${imp?'#f87171':'#facc15'};border:1px solid ${imp?'rgba(239,68,68,0.3)':'rgba(234,179,8,0.3)'}">${esc(o.impact)}</span>
        </div>`
      }).join('')}
    </div>`
  }

  return `<div class="page">
  <div class="accent-bar-sm"></div>
  <div class="section-title" style="margin-top:16px">
    <div class="bar"></div><h2>Core Web Vitals &amp; Performance</h2>
  </div>
  <div class="grid-4 mb-4">${lhCards}</div>
  <div class="grid-3 mb-4">${vitals}</div>
  ${opportunities}
  <div class="footer"><span>AuditIQ — Confidential Audit Report</span><span>Page 2</span></div>
</div>`
}

function issuesPage(data) {
  const { issues = [] } = data
  if (!issues.length) return ''

  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 }
  const sorted = [...issues].sort((a, b) => (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0))

  const issueCards = sorted.map(issue => {
    const sc = severityColor[issue.severity] || '#94a3b8'
    const bgMap = {
      Critical: 'rgba(239,68,68,0.06)',
      High: 'rgba(251,146,60,0.06)',
      Medium: 'rgba(234,179,8,0.06)',
      Low: 'rgba(34,197,94,0.06)',
      Informational: 'rgba(59,130,246,0.06)',
    }
    const borderMap = {
      Critical: 'rgba(239,68,68,0.2)',
      High: 'rgba(251,146,60,0.2)',
      Medium: 'rgba(234,179,8,0.2)',
      Low: 'rgba(34,197,94,0.2)',
      Informational: 'rgba(59,130,246,0.2)',
    }
    const ec = effortColor[issue.effort] || {}
    return `
    <div class="issue-card" style="background:${bgMap[issue.severity]||'rgba(30,41,59,1)'};border-color:${borderMap[issue.severity]||'#334155'};display:flex;gap:12px">
      <div class="color-bar" style="background:${sc}"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <span class="badge" style="background:${bgMap[issue.severity]};color:${sc};border:1px solid ${borderMap[issue.severity]}">${esc(issue.severity)}</span>
          <span class="text-xs text-slate500">${esc(issue.pillar)}</span>
          ${issue.effort ? `<span class="badge" style="background:${ec.bg||'transparent'};color:${ec.text||'#94a3b8'}">${esc(issue.effort)}</span>` : ''}
          ${issue.effortScore !== undefined ? `<span class="badge" style="background:rgba(234,179,8,0.15);color:#facc15">Effort: ${issue.effortScore}/10</span>` : ''}
          ${issue.impact ? `<span class="text-xs text-slate500">Impact: ${esc(issue.impact)}</span>` : ''}
          ${issue.impactScore !== undefined ? `<span class="text-xs text-slate500">Impact: ${issue.impactScore}/10</span>` : ''}
        </div>
        <div class="text-sm font-bold mb-2">${esc(issue.title)}</div>
        <div class="text-xs text-slate400" style="line-height:1.6;margin-bottom:8px">${esc(issue.detail)}</div>
        <div class="text-xs" style="line-height:1.6"><span style="color:#818cf8">Fix:</span> <span style="color:#a5b4fc">${esc(issue.fix)}</span></div>
        ${issue.affectedPages?.length ? `<div style="margin-top:8px"><div class="text-xs text-slate500" style="margin-bottom:4px">Affected pages:</div>${issue.affectedPages.map(u => `<div class="text-xs text-slate400" style="word-break:break-all">${esc(u)}</div>`).join('')}</div>` : ''}
      </div>
    </div>`
  }).join('')

  return `<div class="page">
  <div class="accent-bar-sm"></div>
  <div class="section-title" style="margin-top:16px">
    <div class="bar"></div><h2>Issues Audit — ${issues.length} Issues Found</h2>
  </div>
  ${issueCards}
  <div class="footer"><span>AuditIQ — Confidential Audit Report</span><span>Page 3</span></div>
</div>`
}

function keywordsPage(data) {
  const { seo, issues = [] } = data
  let html = `<div class="page"><div class="accent-bar-sm"></div>`

  // Keywords section
  if (seo.topKeywords?.length > 0) {
    const placements = [
      { label: 'In Page Title', value: seo.keywordInTitle },
      { label: 'In H1 Tag', value: seo.keywordInH1 },
      { label: 'In Meta Description', value: seo.keywordInMeta },
      { label: 'In URL', value: seo.keywordInURL },
    ]
    const placementHtml = placements.map(p => `
      <div class="card" style="text-align:center;padding:12px">
        <div class="text-lg font-bold" style="color:${p.value ? '#4ade80' : '#f87171'}">${p.value ? '✓ Yes' : '✗ No'}</div>
        <div class="text-xs text-slate500" style="margin-top:4px">${esc(p.label)}</div>
      </div>`).join('')

    const kwBars = seo.topKeywords.map(kw => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <span class="text-sm" style="width:96px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(kw.word)}</span>
        <div class="score-bar-track" style="flex:1">
          <div class="score-bar-fill" style="width:${Math.min((kw.density / 10) * 100, 100)}%;background:#6366f1"></div>
        </div>
        <span class="text-xs text-slate500" style="width:80px;text-align:right;flex-shrink:0">${kw.density}% · ×${kw.count}</span>
      </div>`).join('')

    html += `
    <div class="section-title" style="margin-top:16px">
      <div class="bar"></div><h2>Keyword Analysis</h2>
    </div>
    <div class="grid-2 mb-4">
      <div class="card" style="padding:20px">
        <div class="text-xs text-slate400 mb-4">Top Keywords by Frequency</div>
        ${kwBars}
      </div>
      <div class="card" style="padding:20px">
        <div class="text-xs text-slate400 mb-4">Primary Keyword Placement</div>
        <div class="text-sm font-semibold mb-4" style="color:#818cf8">"${esc(seo.primaryKeyword)}"</div>
        <div class="grid-2">${placementHtml}</div>
      </div>
    </div>`
  }

  // Priority Matrix
  if (issues.length > 0) {
    const legendItems = Object.entries(severityColor).map(([label, color]) =>
      `<div style="display:flex;align-items:center;gap:6px"><div style="width:10px;height:10px;border-radius:50%;background:${color}"></div><span class="text-xs text-slate400">${label}</span></div>`
    ).join('')

    html += `
    <div class="section-title" style="margin-top:16px">
      <div class="bar"></div><h2>Priority Matrix — Impact vs Effort</h2>
    </div>
    <div class="card" style="padding:20px">
      <div class="text-xs text-slate400 mb-4">Each dot represents an issue. Top-left = highest priority fixes.</div>
      <div style="position:relative;width:100%;padding-bottom:60%">
        <div style="position:absolute;inset:0;width:100%;height:100%">
          ${priorityMatrixSvg(issues)}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">${legendItems}</div>
    </div>`
  }

  html += `<div class="footer"><span>AuditIQ — Confidential Audit Report</span><span>Page 4</span></div></div>`
  return html
}

function crawlRecommendationsPage(data) {
  const { crawl, recommendations = [] } = data
  const safeCrawl = crawl || {}
  let html = `<div class="page"><div class="accent-bar-sm"></div>`

  // Pages crawled
  if (safeCrawl.pages?.length > 0) {
    const pageCards = safeCrawl.pages.map(p => {
      const cols = [
        { label: 'Title', value: p.title || 'Missing', ok: !!p.title },
        { label: 'Meta Desc', value: p.hasMetaDescription ? 'Present' : 'Missing', ok: p.hasMetaDescription },
        { label: 'H1', value: p.hasH1 ? `${p.h1Count} found` : 'Missing', ok: p.hasH1 && p.h1Count === 1 },
        { label: 'Schema', value: p.hasSchema ? 'Present' : 'Missing', ok: p.hasSchema },
      ]
      return `<div class="card" style="padding:12px">
        <div class="text-xs mb-2" style="color:#818cf8;word-break:break-all">${esc(p.url)}</div>
        <div class="grid-4">
          ${cols.map(c => `<div><div class="text-xs text-slate500">${esc(c.label)}</div><div class="text-xs font-semibold" style="margin-top:2px;color:${c.ok?'#4ade80':'#f87171'}">${esc(c.value)}</div></div>`).join('')}
        </div>
        ${p.title ? `<div class="text-xs text-slate500" style="margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"${esc(p.title)}"</div>` : ''}
      </div>`
    }).join('')

    html += `
    <div class="section-title" style="margin-top:16px">
      <div class="bar"></div><h2>Pages Crawled (${safeCrawl.pagesCrawled || 0})</h2>
    </div>
    ${pageCards}`

    if (safeCrawl.crossPageIssues?.length > 0) {
      html += `
      <div class="card" style="border-color:rgba(234,179,8,0.3);padding:16px;margin-top:12px">
        <div class="text-sm font-semibold mb-4" style="color:#facc15">Cross-Page Issues</div>
        ${safeCrawl.crossPageIssues.map(issue => `
          <div style="border-bottom:1px solid rgba(51,65,85,0.5);padding:8px 0">
            <div class="text-sm">${esc(issue.title)}</div>
            ${issue.detail ? `<div class="text-xs text-slate400" style="margin-top:2px">${esc(issue.detail)}</div>` : ''}
          </div>`).join('')}
      </div>`
    }
  }

  // AI Recommendations
  if (recommendations.length > 0) {
    html += `
    <div class="section-title" style="margin-top:20px">
      <div class="bar"></div><h2>AI Recommendations</h2>
    </div>
    ${recommendations.map(rec => {
      const pc = priorityColor[rec.priority] || { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
      return `<div class="card" style="padding:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span class="badge" style="background:${pc.bg};color:${pc.text};border:1px solid ${pc.border}">${esc(rec.priority)}</span>
          <span class="badge" style="background:rgba(51,65,85,0.5);color:#94a3b8">${esc(rec.pillar)}</span>
        </div>
        <div class="text-sm font-bold mb-2">${esc(rec.title)}</div>
        <div class="text-xs text-slate400" style="line-height:1.6">${esc(rec.description)}</div>
      </div>`
    }).join('')}`
  }

  html += `<div class="footer"><span>AuditIQ — Confidential Audit Report</span><span>Page 5</span></div></div>`
  return html
}

function buildPdfHtml(data) {
  const safe = {
    url: data.url || '',
    timestamp: data.timestamp || new Date().toISOString(),
    overallScore: data.overallScore || 0,
    seo: { score: 0, topKeywords: [], primaryKeyword: '', keywordInTitle: false, keywordInH1: false, keywordInMeta: false, keywordInURL: false, ...data.seo },
    technical: { score: 0, ...data.technical },
    content: { score: 0, ...data.content },
    social: { score: 0, ...data.social },
    issues: data.issues || [],
    recommendations: data.recommendations || [],
    crawl: data.crawl || null,
    pageSpeed: data.pageSpeed || null,
  }

  let pages = coverPage(safe)
  const vp = vitalsPage(safe)
  if (vp) pages += vp
  pages += issuesPage(safe)
  pages += keywordsPage(safe)
  pages += crawlRecommendationsPage(safe)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${BASE_STYLES}</style>
</head>
<body>
${pages}
</body>
</html>`
}

module.exports = { buildPdfHtml }