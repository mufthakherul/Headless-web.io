/**
 * Reader Mode Module
 * Content extraction using Mozilla Readability
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const logger = require('./logger');

/**
 * Extract readable content from URL
 */
async function extractContent(targetUrl) {
  try {
    logger.info('Extracting content for reader mode', { targetUrl });

    // Fetch the URL
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    // Parse with JSDOM
    const dom = new JSDOM(response.data, {
      url: targetUrl
    });

    // Use Readability to extract content
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Could not extract readable content from this page');
    }

    logger.info('Successfully extracted content', {
      targetUrl,
      title: article.title,
      contentLength: article.content?.length || 0
    });

    return {
      success: true,
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline: article.byline,
      length: article.length,
      siteName: article.siteName,
      publishedTime: article.publishedTime
    };

  } catch (error) {
    logger.error('Content extraction failed', {
      targetUrl,
      error: error.message
    });

    throw error;
  }
}

/**
 * Generate clean HTML for reader view
 */
function generateReaderHTML(article, originalUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(article.title || 'Reader View')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.8;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 60px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        .header {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        h1 {
            font-size: 2.5em;
            line-height: 1.3;
            margin-bottom: 15px;
            color: #1a1a1a;
        }
        .meta {
            color: #666;
            font-size: 0.95em;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }
        .meta a {
            color: #0066cc;
            text-decoration: none;
        }
        .meta a:hover {
            text-decoration: underline;
        }
        .byline {
            font-style: italic;
            margin-bottom: 10px;
        }
        .content {
            font-size: 1.1em;
        }
        .content p {
            margin-bottom: 1.5em;
        }
        .content img {
            max-width: 100%;
            height: auto;
            margin: 20px 0;
            border-radius: 4px;
        }
        .content h2, .content h3 {
            margin-top: 1.5em;
            margin-bottom: 0.8em;
            color: #1a1a1a;
        }
        .content ul, .content ol {
            margin-left: 30px;
            margin-bottom: 1.5em;
        }
        .content li {
            margin-bottom: 0.5em;
        }
        .content blockquote {
            border-left: 4px solid #0066cc;
            padding-left: 20px;
            margin: 20px 0;
            color: #555;
            font-style: italic;
        }
        .content pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 20px 0;
        }
        .content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 30px 20px;
            }
            h1 {
                font-size: 1.8em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(article.title || 'Untitled')}</h1>
            <div class="meta">
                ${article.byline ? `<div class="byline">By ${escapeHtml(article.byline)}</div>` : ''}
                ${article.siteName ? `<div>Source: ${escapeHtml(article.siteName)}</div>` : ''}
                <div>Original: <a href="${escapeHtml(originalUrl)}" target="_blank">${escapeHtml(originalUrl)}</a></div>
                ${article.length ? `<div>Reading time: ~${Math.ceil(article.length / 1000)} min</div>` : ''}
            </div>
        </div>
        <div class="content">
            ${article.content || '<p>No content available.</p>'}
        </div>
        <div class="footer">
            <p>📖 Powered by Headless-web Reader Mode</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  extractContent,
  generateReaderHTML
};
