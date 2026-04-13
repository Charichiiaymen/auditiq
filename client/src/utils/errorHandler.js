import api from './api'
import { sanitizeErrorMessage } from './errorUtils'

// Set up axios interceptors for global error handling on the shared api instance
export const setupErrorHandling = () => {
  // Response interceptor for API calls
  api.interceptors.response.use(
    (response) => {
      return response
    },
    (error) => {
      // Sanitize error messages before logging to prevent information disclosure
      let sanitizedError = 'API Error'

      if (error.response) {
        // Server responded with error status
        sanitizedError = `API Error: ${error.response.status} - ${sanitizeErrorMessage(error.response.statusText)}`
      } else if (error.request) {
        // Network error (no response received)
        sanitizedError = 'API Error: Network error occurred'
      } else {
        // Something else happened
        sanitizedError = `API Error: ${sanitizeErrorMessage(error.message)}`
      }

      console.error(sanitizedError)

      // Return a rejected promise with the error
      return Promise.reject(error)
    }
  )
}

export default setupErrorHandling