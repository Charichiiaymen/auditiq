import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:7860' : 'https://auditiq-five.vercel.app'),
  timeout: 60000,
})

export default api