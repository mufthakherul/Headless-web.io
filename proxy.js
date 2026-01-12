/**
 * Proxy Module for Fast Mode
 * Handles HTTP fetching and HTML/CSS rewriting
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const logger = require('./logger');
const { USER_AGENT, REQUEST_TIMEOUT, MAX_REDIRECTS } = require('./config');

/**
 * Fetch URL and rewrite content to proxy through our server
 */
async function fetchAndRewrite(targetUrl, sessionId, baseProxyPath = '/proxy') {
  try {
    logger.info('Fetching URL for proxy mode', { targetUrl, sessionId });

    // Fetch the target URL
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: REQUEST_TIMEOUT,
      maxRedirects: MAX_REDIRECTS,
      validateStatus: (status) => status < 500 // Accept 4xx responses
    });

    const contentType = response.headers['content-type'] || '';
    
    // Only rewrite HTML content
    if (!contentType.includes('text/html')) {
      logger.info('Non-HTML content, passing through', { contentType });
      return {
        content: response.data,
        contentType: contentType,
        statusCode: response.status,
        rewritten: false
      };
    }

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);
    const parsedUrl = new URL(targetUrl);

    // Helper function to rewrite URLs
    const rewriteUrl = (url) => {
      if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('vbscript:') || url.startsWith('#')) {
        return url;
      }

      try {
        // Resolve relative URLs
        const absoluteUrl = new URL(url, targetUrl).href;
        // Return proxied URL
        return `${baseProxyPath}?sid=${sessionId}&url=${encodeURIComponent(absoluteUrl)}`;
      } catch (e) {
        logger.warn('Failed to rewrite URL', { url, error: e.message });
        return url;
      }
    };

    // Rewrite href attributes (links)
    $('a[href], link[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        $(elem).attr('href', rewriteUrl(href));
      }
    });

    // Rewrite src attributes (images, scripts, iframes)
    $('img[src], script[src], iframe[src], source[src], embed[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        $(elem).attr('src', rewriteUrl(src));
      }
    });

    // Rewrite srcset attributes
    $('[srcset]').each((i, elem) => {
      const srcset = $(elem).attr('srcset');
      if (srcset) {
        const rewritten = srcset.split(',').map(part => {
          const [url, ...rest] = part.trim().split(' ');
          return `${rewriteUrl(url)} ${rest.join(' ')}`.trim();
        }).join(', ');
        $(elem).attr('srcset', rewritten);
      }
    });

    // Rewrite form actions
    $('form[action]').each((i, elem) => {
      const action = $(elem).attr('action');
      if (action) {
        $(elem).attr('action', rewriteUrl(action));
      }
    });

    // Rewrite CSS url() in style tags
    $('style').each((i, elem) => {
      let css = $(elem).html();
      if (css) {
        css = rewriteCSSUrls(css, rewriteUrl);
        $(elem).html(css);
      }
    });

    // Rewrite inline styles
    $('[style]').each((i, elem) => {
      let style = $(elem).attr('style');
      if (style) {
        style = rewriteCSSUrls(style, rewriteUrl);
        $(elem).attr('style', style);
      }
    });

    // Add base tag to help with relative URLs (escaped for security)
    if ($('base').length === 0) {
      const baseHref = escapeHtml(parsedUrl.origin + parsedUrl.pathname);
      $('head').prepend(`<base href="${baseHref}">`);
    }

    // Inject warning banner
    const warningBanner = `
      <div style="position: fixed; top: 0; left: 0; right: 0; background: #ff9800; color: white; padding: 10px; text-align: center; z-index: 999999; font-family: Arial, sans-serif; font-size: 14px;">
        🌐 Viewing through Headless-web Proxy | Original URL: ${escapeHtml(targetUrl)}
      </div>
      <style>body { padding-top: 45px !important; }</style>
    `;
    $('body').prepend(warningBanner);

    const rewrittenHtml = $.html();

    logger.info('Successfully rewrote HTML', { 
      targetUrl, 
      sessionId,
      originalSize: response.data.length,
      rewrittenSize: rewrittenHtml.length
    });

    return {
      content: rewrittenHtml,
      contentType: 'text/html; charset=utf-8',
      statusCode: response.status,
      rewritten: true
    };

  } catch (error) {
    logger.error('Proxy fetch failed', { 
      targetUrl, 
      sessionId,
      error: error.message,
      stack: error.stack
    });

    if (error.code === 'ENOTFOUND') {
      throw new Error('Domain not found');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timeout');
    } else if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  }
}

/**
 * Rewrite CSS url() functions
 */
function rewriteCSSUrls(css, rewriteUrl) {
  return css.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, url) => {
    return `url('${rewriteUrl(url)}')`;
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  fetchAndRewrite,
  rewriteCSSUrls,
  escapeHtml
};
