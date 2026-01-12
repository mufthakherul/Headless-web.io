/**
 * Text-Only Mode Module
 * Minimal representation for maximum compatibility
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

/**
 * Convert page to text-only format
 */
async function convertToTextOnly(targetUrl) {
  try {
    logger.info('Converting to text-only', { targetUrl });

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, noscript, iframe, embed, object').remove();

    // Extract title
    const title = $('title').text() || 'Untitled Page';

    // Extract main content
    let textContent = '';
    
    // Try to find main content area
    const mainContent = $('main, article, [role="main"], .content, #content').first();
    const contentArea = mainContent.length ? mainContent : $('body');

    // Extract paragraphs
    const paragraphs = [];
    contentArea.find('p, h1, h2, h3, h4, h5, h6').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 0) {
        paragraphs.push({
          type: elem.name,
          text: text
        });
      }
    });

    // Extract links
    const links = [];
    contentArea.find('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      if (href && text) {
        try {
          const absoluteUrl = new URL(href, targetUrl).href;
          links.push({
            text: text,
            url: absoluteUrl
          });
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });

    // Extract lists
    const lists = [];
    contentArea.find('ul, ol').each((i, elem) => {
      const items = [];
      $(elem).find('li').each((j, li) => {
        const text = $(li).text().trim();
        if (text) {
          items.push(text);
        }
      });
      if (items.length > 0) {
        lists.push({
          type: elem.name,
          items: items
        });
      }
    });

    logger.info('Text-only conversion complete', {
      targetUrl,
      paragraphs: paragraphs.length,
      links: links.length,
      lists: lists.length
    });

    return {
      success: true,
      title: title,
      paragraphs: paragraphs,
      links: links,
      lists: lists,
      url: targetUrl
    };

  } catch (error) {
    logger.error('Text-only conversion failed', {
      targetUrl,
      error: error.message
    });
    throw error;
  }
}

/**
 * Generate text-only HTML
 */
function generateTextOnlyHTML(data) {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.title)}</title>
    <style>
        body {
            font-family: monospace;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background: #fff;
            color: #000;
            line-height: 1.6;
        }
        h1 { font-size: 1.5em; border-bottom: 2px solid #000; padding-bottom: 10px; }
        h2 { font-size: 1.3em; margin-top: 20px; }
        h3 { font-size: 1.1em; margin-top: 15px; }
        p { margin: 10px 0; }
        a { color: #00f; text-decoration: underline; }
        ul, ol { margin: 10px 0; padding-left: 30px; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
        .links-section { border-top: 1px solid #ccc; margin-top: 30px; padding-top: 20px; }
    </style>
</head>
<body>
    <h1>${escapeHtml(data.title)}</h1>
    <div class="meta">
        Source: <a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a>
    </div>
`;

  // Add paragraphs and headings
  if (data.paragraphs && data.paragraphs.length > 0) {
    for (const para of data.paragraphs) {
      if (para.type.startsWith('h')) {
        html += `    <${para.type}>${escapeHtml(para.text)}</${para.type}>\n`;
      } else {
        html += `    <p>${escapeHtml(para.text)}</p>\n`;
      }
    }
  }

  // Add lists
  if (data.lists && data.lists.length > 0) {
    for (const list of data.lists) {
      html += `    <${list.type}>\n`;
      for (const item of list.items) {
        html += `        <li>${escapeHtml(item)}</li>\n`;
      }
      html += `    </${list.type}>\n`;
    }
  }

  // Add links section
  if (data.links && data.links.length > 0) {
    html += `
    <div class="links-section">
        <h2>Links on this page (${data.links.length})</h2>
        <ul>
`;
    // Limit to first 100 links to avoid overwhelming
    const linksToShow = data.links.slice(0, 100);
    for (const link of linksToShow) {
      html += `            <li><a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a></li>\n`;
    }
    if (data.links.length > 100) {
      html += `            <li><em>... and ${data.links.length - 100} more links</em></li>\n`;
    }
    html += `        </ul>
    </div>
`;
  }

  html += `
    <div style="margin-top: 40px; text-align: center; color: #666; font-size: 0.9em;">
        <p>📝 Text-only mode - Maximum compatibility, minimum bandwidth</p>
    </div>
</body>
</html>`;

  return html;
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
  convertToTextOnly,
  generateTextOnlyHTML
};
