import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="w-full px-8 py-4 flex items-center justify-between border-b border-slate-700">
      <Link to="/" className="text-xl font-bold text-indigo-400 tracking-tight">
        Audit<span className="text-white">IQ</span>
      </Link>
      <div className="flex gap-6">
        <Link to="/" className="text-slate-300 hover:text-white text-sm transition-colors">Home</Link>
        <Link to="/about" className="text-slate-300 hover:text-white text-sm transition-colors">About</Link>
      </div>
    </nav>
  )
}
export default Navbar