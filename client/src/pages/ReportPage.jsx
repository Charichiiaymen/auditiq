import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Navbar from '../components/Navbar'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const priorityColor = {
  High: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Low: 'bg-green-500/20 text-green-400 border border-green-500/30',
}

const statusLabel = (score) => {
  if (score >= 75) return { text: 'Good', cls: 'text-green-400' }
  if (score >= 50) return { text: 'Needs Improvement', cls: 'text-yellow-400' }
  return { text: 'Critical', cls: 'text-red-400' }
}

function ReportPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('auditResult')
    if (!stored) {
      navigate('/')
      return
    }
    setResult(JSON.parse(stored))
  }, [navigate])

  if (!result) return null

  const overallScore = Math.round(
    (result.seo.score + result.technical.score + result.content.score + result.social.score) / 4
  )

  const radarData = [
    { pillar: 'SEO', score: result.seo.score },
    { pillar: 'Technical', score: result.technical.score },
    { pillar: 'Content', score: result.content.score },
    { pillar: 'Social', score: result.social.score },
  ]

  const pillars = [
    { name: 'SEO Health', score: result.seo.score },
    { name: 'Technical', score: result.technical.score },
    { name: 'Content Quality', score: result.content.score },
    { name: 'Social Presence', score: result.social.score },
  ]

  async function handleExportPDF() {
    setExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const margin = 16
      const col = W - margin * 2
      let y = 20

      // ── Helper functions ──────────────────────────────────────
      function setColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setTextColor(r, g, b)
      }
      function setFill(hex) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setFillColor(r, g, b)
      }
      function setDraw(hex) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setDrawColor(r, g, b)
      }
      function newPageIfNeeded(needed = 20) {
        if (y + needed > 280) {
          pdf.addPage()
          setFill('#0f172a')
          setDraw('#0f172a')
          pdf.rect(0, 0, 210, 297, 'FD')
          y = 20
        }
      }

      // ── Background ────────────────────────────────────────────
      setFill('#0f172a')
      pdf.rect(0, 0, 210, 297, 'F')

      // ── Header ────────────────────────────────────────────────
      pdf.setFontSize(22)
      pdf.setFont('helvetica', 'bold')
      setColor('#818cf8')
      pdf.text('AuditIQ', margin, y)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      setColor('#94a3b8')
      pdf.text('Digital Marketing Audit Report', margin, y + 7)
      y += 18

      // URL + timestamp
      pdf.setFontSize(9)
      setColor('#64748b')
      pdf.text(`URL: ${result.url}`, margin, y)
      pdf.text(`Date: ${new Date(result.timestamp).toLocaleString()}`, margin, y + 5)
      y += 14

      // ── Divider ───────────────────────────────────────────────
      setDraw('#334155')
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, W - margin, y)
      y += 8

      // ── Overall Score ─────────────────────────────────────────
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      setColor('#ffffff')
      pdf.text('Overall Score', margin, y)
      y += 7
      setFill('#1e293b')
      setDraw('#334155')
      pdf.roundedRect(margin, y, col, 18, 2, 2, 'FD')
      pdf.setFontSize(20)
      setColor('#818cf8')
      pdf.text(`${overallScore}/100`, W / 2, y + 12, { align: 'center' })
      y += 26

      // ── Pillar Scores ─────────────────────────────────────────
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      setColor('#ffffff')
      pdf.text('Score Breakdown', margin, y)
      y += 6

      const cardW = (col - 6) / 2
      const pillarRows = [
        [{ name: 'SEO Health', score: result.seo.score }, { name: 'Technical', score: result.technical.score }],
        [{ name: 'Content Quality', score: result.content.score }, { name: 'Social Presence', score: result.social.score }],
      ]

      function statusColor(score) {
        if (score >= 75) return '#4ade80'
        if (score >= 50) return '#facc15'
        return '#f87171'
      }
      function statusText(score) {
        if (score >= 75) return 'Good'
        if (score >= 50) return 'Needs Improvement'
        return 'Critical'
      }

      pillarRows.forEach((row) => {
        newPageIfNeeded(24)
        row.forEach((p, i) => {
          const x = margin + i * (cardW + 6)
          setFill('#1e293b')
          setDraw('#334155')
          pdf.roundedRect(x, y, cardW, 20, 2, 2, 'FD')
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'bold')
          setColor('#94a3b8')
          pdf.text(p.name, x + 3, y + 6)
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          setColor('#ffffff')
          pdf.text(`${p.score}/100`, x + 3, y + 13)
          setColor(statusColor(p.score))
          pdf.setFontSize(7)
          pdf.text(statusText(p.score), x + cardW - 3, y + 13, { align: 'right' })
        })
        y += 26
      })

      // ── Score Overview Bars ───────────────────────────────────
      newPageIfNeeded(80)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text('Score Overview', margin, y)
      y += 7

      const cardH2 = pillars.length * 16 + 10
      pdf.setFillColor(30, 41, 59)
      pdf.setDrawColor(51, 65, 85)
      pdf.setLineWidth(0.3)
      pdf.rect(margin, y, col, cardH2, 'FD')

      let barY2 = y + 10

      pillars.forEach((p) => {
        const labelW2 = 32
        const scoreW2 = 18
        const trackW2 = col - labelW2 - scoreW2 - 12
        const trackX2 = margin + 4 + labelW2

        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(148, 163, 184)
        pdf.text(p.name, margin + 4, barY2 + 4.5)

        pdf.setFillColor(15, 23, 42)
        pdf.setDrawColor(15, 23, 42)
        pdf.rect(trackX2, barY2, trackW2, 6, 'FD')

        if (p.score > 0) {
          const fillW2 = (p.score / 100) * trackW2
          const c = p.score >= 75 ? [74, 222, 128] : p.score >= 50 ? [250, 204, 21] : [248, 113, 113]
          pdf.setFillColor(c[0], c[1], c[2])
          pdf.setDrawColor(c[0], c[1], c[2])
          pdf.rect(trackX2, barY2, fillW2, 6, 'FD')
        }

        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text(`${p.score}/100`, trackX2 + trackW2 + 3, barY2 + 4.5)

        barY2 += 16
      })

      y += cardH2 + 8

      // ── Recommendations ────────────────────────────────────────
      newPageIfNeeded(20)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      setColor('#ffffff')
      pdf.text('Recommendations', margin, y)
      y += 8

      result.recommendations.forEach((rec, i) => {
        newPageIfNeeded(30)
        setFill('#1e293b')
        setDraw('#334155')
        pdf.roundedRect(margin, y, col, 26, 2, 2, 'FD')

        // Priority badge
        const priorityColors = { High: '#f87171', Medium: '#facc15', Low: '#4ade80' }
        setColor(priorityColors[rec.priority])
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'bold')
        const priorityX = margin + 3
        pdf.text(rec.priority, priorityX, y + 6)

        // Pillar badge
        setColor('#94a3b8')
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        const pillarX = priorityX + pdf.getTextWidth(rec.priority) + 4
        pdf.text(rec.pillar, pillarX, y + 6)

        // Title
        setColor('#ffffff')
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.text(rec.title, margin + 3, y + 14)

        // Description
        setColor('#94a3b8')
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        const descLines = pdf.splitTextToSize(rec.description, col - 6)
        pdf.text(descLines, margin + 3, y + 20)

        y += 32
      })

      pdf.save('AuditIQ-Report.pdf')
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <Navbar />
      <div id="report-content" className="flex flex-col items-center px-4 py-10 w-full max-w-4xl mx-auto gap-8">

        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-white text-2xl font-bold">Audit Report</h1>
            <p className="text-slate-400 text-sm mt-1">{result.url}</p>
            <p className="text-slate-500 text-xs mt-0.5">{new Date(result.timestamp).toLocaleString()}</p>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm self-start sm:self-auto"
          >
            {exporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-8 w-full flex flex-col items-center border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Overall Score</p>
          <div className="text-7xl font-bold text-indigo-400">{overallScore}</div>
          <div className="text-slate-400 text-sm mt-1">out of 100</div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          {pillars.map((p) => {
            const s = statusLabel(p.score)
            return (
              <div key={p.name} className="bg-[#1e293b] rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">{p.name}</p>
                <p className="text-white text-3xl font-bold">{p.score}<span className="text-slate-500 text-sm font-normal">/100</span></p>
                <p className={`text-xs mt-1 font-medium ${s.cls}`}>{s.text}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-6 w-full border border-slate-700">
          <h2 className="text-white font-semibold mb-4">Score Overview</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="pillar" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-6 w-full border border-slate-700">
          <h2 className="text-white font-semibold mb-4">Score Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="pb-2 font-medium">Pillar</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pillars.map((p) => {
                const s = statusLabel(p.score)
                return (
                  <tr key={p.name} className="border-b border-slate-700/50 last:border-0">
                    <td className="py-3 text-white">{p.name}</td>
                    <td className="py-3 text-white font-semibold">{p.score}/100</td>
                    <td className={`py-3 font-medium ${s.cls}`}>{s.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="w-full">
          <h2 className="text-white font-semibold text-lg mb-4">Recommendations</h2>
          <div className="flex flex-col gap-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-[#1e293b] rounded-xl p-5 border border-slate-700 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[rec.priority]}`}>{rec.priority}</span>
                  <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{rec.pillar}</span>
                </div>
                <p className="text-white font-medium text-sm">{rec.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
export default ReportPage