/**
 * Configuration Constants for Headless-web
 */

module.exports = {
  // User Agent for HTTP requests
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Request timeouts
  REQUEST_TIMEOUT: 15000, // 15 seconds
  
  // Redirect limits
  MAX_REDIRECTS: 5,
  
  // Text-only mode limits
  MAX_LINKS_TO_SHOW: 100,
  
  // Logging
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  }
};
