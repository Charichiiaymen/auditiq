import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'

function HomePage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAudit() {
    setError('')
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      setError('Please enter a valid URL starting with http:// or https://')
      return
    }
    setLoading(true)
    try {
      const response = await axios.post('http://localhost:5000/api/audit', {
        url,
        instagram,
        facebook,
      })
      localStorage.setItem('auditResult', JSON.stringify(response.data))
      navigate('/report')
    } catch (err) {
      setError(err?.response?.data?.error || 'Audit failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <Navbar />
      <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            AI-Powered <span className="text-indigo-400">Digital Marketing Audit</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Enter your website URL and get a full audit of your SEO, content, technical setup, and social presence in seconds.
          </p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-8 w-full max-w-lg shadow-xl border border-slate-700">
          <div className="flex flex-col gap-4">

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Website URL <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Instagram Handle <span className="text-slate-500 font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="@yourbrand"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Facebook Page URL <span className="text-slate-500 font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="https://facebook.com/yourpage"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <button
              onClick={handleAudit}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Running Audit...' : 'Run Audit'}
            </button>

            <p className="text-center text-slate-500 text-xs">Audit takes 15–30 seconds</p>
          </div>
        </div>

        <div className="mt-16 w-full max-w-2xl">
          <h2 className="text-center text-white font-semibold text-lg mb-8">How It Works</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { n: '1', text: 'Enter your website URL' },
              { n: '2', text: 'AI scans SEO, content and technical setup' },
              { n: '3', text: 'Receive a scored report across 4 pillars' },
              { n: '4', text: 'Download your audit report as a PDF' },
            ].map((step) => (
              <div key={step.n} className="bg-[#1e293b] rounded-xl p-4 flex flex-col items-center text-center border border-slate-700">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm mb-3">
                  {step.n}
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
export default HomePage