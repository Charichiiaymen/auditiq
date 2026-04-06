import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Navbar from '../components/Navbar'
import jsPDF from 'jspdf'
import { sanitizeUserData } from '../utils/errorUtils'

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
    // Sanitize data when retrieving from localStorage
    const parsedData = JSON.parse(stored)
    const sanitizedData = sanitizeUserData(parsedData)
    setResult(sanitizedData)
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
      const scoreColor = (s) => s >= 75 ? '#4ade80' : s >= 50 ? '#facc15' : '#f87171'
      const scoreLabel = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical'

      darkBg()

      pdf.setFontSize(24); pdf.setFont('helvetica','bold'); tc('#6366f1')
      pdf.text('AuditIQ', M, y)
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('AI-Powered Digital Marketing Audit Report', M, y+7)
      y += 16

      pdf.setFontSize(8); tc('#64748b')
      pdf.text(`URL: ${result.url}`, M, y); y += 5
      pdf.text(`Date: ${new Date(result.timestamp).toLocaleString()}`, M, y); y += 8

      dc('#334155'); pdf.setLineWidth(0.3); pdf.line(M, y, W-M, y); y += 8

      fc('#1e293b'); dc('#334155')
      pdf.roundedRect(M, y, col, 22, 2, 2, 'FD')
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); tc('#94a3b8')
      pdf.text('Overall Score', W/2, y+6, { align: 'center' })
      pdf.setFontSize(22); pdf.setFont('helvetica','bold'); tc('#6366f1')
      pdf.text(`${overallScore}/100`, W/2, y+18, { align: 'center' })
      y += 30

      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Score Breakdown', M, y); y += 6

      const cardW = (col - 5) / 2
      const cardData = [
        { name: 'SEO Health', score: result.seo.score },
        { name: 'Technical', score: result.technical.score },
        { name: 'Content Quality', score: result.content.score },
        { name: 'Social Presence', score: result.social.score },
      ]

      for (let row = 0; row < 2; row++) {
        newPage(24)
        for (let col2 = 0; col2 < 2; col2++) {
          const p = cardData[row * 2 + col2]
          const x = M + col2 * (cardW + 5)
          fc('#1e293b'); dc('#334155')
          pdf.roundedRect(x, y, cardW, 20, 2, 2, 'FD')
          pdf.setFontSize(7); pdf.setFont('helvetica','normal'); tc('#94a3b8')
          pdf.text(p.name, x+4, y+6)
          pdf.setFontSize(15); pdf.setFont('helvetica','bold'); tc('#ffffff')
          pdf.text(`${p.score}`, x+4, y+15)
          pdf.setFontSize(7)
          const [r,g,b] = rgb(scoreColor(p.score)); pdf.setTextColor(r,g,b)
          pdf.text(scoreLabel(p.score), x+cardW-3, y+15, { align: 'right' })
        }
        y += 24
      }

      y += 4
      newPage(80)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Score Overview', M, y); y += 6

      const barCardH = cardData.length * 15 + 10
      fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
      pdf.rect(M, y, col, barCardH, 'FD')

      const labelW = 30
      const scoreW = 18
      const trackW = col - labelW - scoreW - 10
      const trackX = M + 5 + labelW
      let barY = y + 9

      cardData.forEach((p) => {
        pdf.setFontSize(8); pdf.setFont('helvetica','normal'); tc('#94a3b8')
        pdf.text(p.name, M+4, barY+4)
        fc('#0f172a'); dc('#0f172a')
        pdf.rect(trackX, barY, trackW, 5, 'FD')
        if (p.score > 0) {
          const fw = (p.score / 100) * trackW
          const [r,g,b] = rgb(scoreColor(p.score))
          pdf.setFillColor(r,g,b); pdf.setDrawColor(r,g,b)
          pdf.rect(trackX, barY, fw, 5, 'FD')
        }
        pdf.setFontSize(8); pdf.setFont('helvetica','bold'); tc('#ffffff')
        pdf.text(`${p.score}/100`, trackX+trackW+3, barY+4)
        barY += 15
      })

      y += barCardH + 8

      newPage(20)
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); tc('#ffffff')
      pdf.text('Recommendations', M, y); y += 7

      const priorityColors = { High: '#f87171', Medium: '#facc15', Low: '#4ade80' }

      result.recommendations.forEach((rec) => {
        const lines = pdf.splitTextToSize(rec.description, col - 8)
        const recH = 8 + 7 + lines.length * 4.5 + 5
        newPage(recH + 4)
        fc('#1e293b'); dc('#334155'); pdf.setLineWidth(0.3)
        pdf.roundedRect(M, y, col, recH, 2, 2, 'FD')
        const [pr,pg,pb] = rgb(priorityColors[rec.priority] || '#94a3b8')
        pdf.setTextColor(pr,pg,pb)
        pdf.setFontSize(7); pdf.setFont('helvetica','bold')
        pdf.text(rec.priority, M+4, y+6)
        tc('#64748b'); pdf.setFont('helvetica','normal')
        pdf.text(`· ${rec.pillar}`, M+4+pdf.getTextWidth(rec.priority)+2, y+6)
        tc('#ffffff'); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
        pdf.text(rec.title, M+4, y+13)
        tc('#94a3b8'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal')
        pdf.text(lines, M+4, y+19)
        y += recH + 4
      })

      newPage(12); y += 4
      dc('#334155'); pdf.line(M, y, W-M, y); y += 5
      tc('#475569'); pdf.setFontSize(7)
      pdf.text('Generated by AuditIQ — AI-Powered Digital Marketing Audit', W/2, y, { align: 'center' })

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