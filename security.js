/**
 * Security Middleware for Headless-web
 * Implements SSRF protection and URL validation
 */

const { URL } = require('url');
const dns = require('dns').promises;

/**
 * Check if an IP address is in a private range
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if IP is private/blocked
 */
function isPrivateIP(ip) {
  // Remove IPv6 brackets if present
  ip = ip.replace(/^\[|\]$/g, '');

  // IPv4 private ranges
  const ipv4Patterns = [
    /^127\./,                    // 127.0.0.0/8 (localhost)
    /^10\./,                     // 10.0.0.0/8 (private)
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 (private)
    /^192\.168\./,               // 192.168.0.0/16 (private)
    /^169\.254\./,               // 169.254.0.0/16 (link-local, includes metadata)
    /^0\./,                      // 0.0.0.0/8 (reserved)
    /^224\./,                    // 224.0.0.0/4 (multicast)
    /^240\./,                    // 240.0.0.0/4 (reserved)
    /^255\.255\.255\.255$/       // broadcast
  ];

  // Check IPv4 patterns
  for (const pattern of ipv4Patterns) {
    if (pattern.test(ip)) {
      return true;
    }
  }

  // IPv6 localhost and link-local
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return true;
  }

  return false;
}

/**
 * Validate and check URL for SSRF vulnerabilities
 * @param {string} urlString - URL to validate
 * @returns {Promise<{valid: boolean, error?: string, url?: URL}>}
 */
async function validateURL(urlString) {
  try {
    // Parse URL
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        valid: false,
        error: 'Only HTTP and HTTPS protocols are allowed'
      };
    }

    // Check for obvious private IPs in hostname
    if (isPrivateIP(url.hostname)) {
      return {
        valid: false,
        error: 'Access to private IP addresses is not allowed'
      };
    }

    // Check for localhost variations
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '0:0:0:0:0:0:0:1'
    ];

    if (localhostPatterns.some(pattern => url.hostname.toLowerCase() === pattern)) {
      return {
        valid: false,
        error: 'Access to localhost is not allowed'
      };
    }

    // Resolve hostname to IP and check again
    try {
      const addresses = await dns.resolve(url.hostname);
      for (const address of addresses) {
        if (isPrivateIP(address)) {
          return {
            valid: false,
            error: 'Hostname resolves to a private IP address'
          };
        }
      }
    } catch (dnsError) {
      // If DNS resolution fails, we block it for safety
      // In production, keep error messages generic to avoid information disclosure
      const isDevelopment = process.env.NODE_ENV === 'development';
      return {
        valid: false,
        error: isDevelopment 
          ? `Unable to resolve hostname: ${dnsError.message}`
          : 'Unable to resolve hostname'
      };
    }

    return {
      valid: true,
      url: url
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Express middleware to validate URLs in requests
 */
function ssrfProtectionMiddleware(req, res, next) {
  const url = req.query.url || req.body.url;

  if (!url) {
    // No URL to validate, continue
    return next();
  }

  validateURL(url)
    .then(result => {
      if (!result.valid) {
        return res.status(400).json({
          error: 'URL validation failed',
          message: result.error
        });
      }
      // Store validated URL for downstream use
      req.validatedURL = result.url;
      next();
    })
    .catch(error => {
      console.error('SSRF validation error:', error);
      res.status(500).json({
        error: 'URL validation error',
        message: 'An error occurred while validating the URL'
      });
    });
}

module.exports = {
  isPrivateIP,
  validateURL,
  ssrfProtectionMiddleware
};
