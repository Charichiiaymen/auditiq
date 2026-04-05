import Navbar from '../components/Navbar'

function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <Navbar />
      <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
        <div className="max-w-2xl w-full bg-[#1e293b] rounded-2xl p-8 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">About AuditIQ</h1>

          <div className="space-y-6 text-slate-300">
            <p className="text-lg">
              AuditIQ is an AI-powered digital marketing audit tool that provides comprehensive analysis of your online presence.
            </p>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">How It Works</h2>
              <p>
                Our advanced AI algorithms scan your website and social media profiles to evaluate four key pillars of your digital marketing:
              </p>

              <ul className="list-disc pl-6 space-y-2">
                <li><span className="text-indigo-400 font-medium">SEO Health:</span> Analyzes your search engine optimization factors</li>
                <li><span className="text-indigo-400 font-medium">Technical Setup:</span> Checks your site's performance and accessibility</li>
                <li><span className="text-indigo-400 font-medium">Content Quality:</span> Evaluates your content effectiveness</li>
                <li><span className="text-indigo-400 font-medium">Social Presence:</span> Reviews your social media engagement</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Our Mission</h2>
              <p>
                We believe every business deserves to understand their digital footprint. AuditIQ democratizes marketing analytics
                by making professional-grade audit tools accessible to everyone, from solo entrepreneurs to large enterprises.
              </p>
            </div>

            <div className="pt-4">
              <p className="text-center text-slate-400">
                Ready to get your audit? Go to the <a href="/" className="text-indigo-400 hover:underline">home page</a> to start.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AboutPage