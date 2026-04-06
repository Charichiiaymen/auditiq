// Utility functions for error handling and sanitization

/**
 * Sanitize error messages to prevent information disclosure
 * @param {string} message - The error message to sanitize
 * @returns {string} - Sanitized error message
 */
export const sanitizeErrorMessage = (message) => {
  if (!message) return 'An unexpected error occurred.'

  // Remove any potentially sensitive information
  // This is a basic sanitization - in production, you might want more sophisticated filtering
  const sanitized = message
    .replace(/token=[\w-]+/gi, 'token=[REDACTED]') // Remove tokens
    .replace(/password[=\s]*[^\s&]+/gi, 'password=[REDACTED]') // Remove passwords
    .replace(/key[=\s]*[^\s&]+/gi, 'key=[REDACTED]') // Remove keys
    .replace(/secret[=\s]*[^\s&]+/gi, 'secret=[REDACTED]') // Remove secrets

  // Limit message length to prevent overflow issues
  return sanitized.length > 200 ? sanitized.substring(0, 200) + '...' : sanitized
}

/**
 * Create a user-friendly error message based on HTTP status code
 * @param {number} status - HTTP status code
 * @param {string} defaultMessage - Default message if no specific mapping exists
 * @returns {string} - User-friendly error message
 */
export const getUserFriendlyErrorMessage = (status, defaultMessage) => {
  const errorMessages = {
    400: 'Invalid request. Please check your inputs and try again.',
    401: 'Authentication failed. Please try again.',
    403: 'Access denied. You do not have permission to perform this action.',
    404: 'Resource not found. Please try again later.',
    408: 'Request timeout. Please check your internet connection and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Internal server error. Our team has been notified.',
    502: 'Service temporarily unavailable. Please try again later.',
    503: 'Service temporarily unavailable. Please try again later.',
    504: 'Service timeout. Please try again later.'
  }

  return errorMessages[status] || defaultMessage || 'An unexpected error occurred. Please try again.'
}

/**
 * Sanitize user inputs before storing in localStorage
 * @param {Object} data - User input data to sanitize
 * @returns {Object} - Sanitized data
 */
export const sanitizeUserData = (data) => {
  if (!data) return {}

  // Create a copy to avoid mutating the original object
  const sanitized = { ...data }

  // Basic sanitization - remove potentially harmful characters
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      // Remove script tags and other potentially harmful content
      sanitized[key] = sanitized[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
    }
  })

  return sanitized
}

export default {
  sanitizeErrorMessage,
  getUserFriendlyErrorMessage,
  sanitizeUserData
}