import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoadingPage from './pages/LoadingPage'
import ReportPage from './pages/ReportPage'
import AboutPage from './pages/AboutPage'
import ErrorPage from './pages/ErrorPage'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0f172a] text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/error" element={<ErrorPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
export default App