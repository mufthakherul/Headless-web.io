/**
 * PDF Generation from Reader Mode
 * Converts extracted article content to PDF format
 */

const { chromium } = require('playwright');
const logger = require('./logger');
const { extractContent } = require('./reader');

class PDFGenerator {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      try {
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        this.browser = await chromium.launch({
          headless: true,
          ...(executablePath ? { executablePath } : {}),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
          ]
        });
        logger.info('PDF generator browser launched');
      } catch (error) {
        logger.error('Failed to launch PDF browser', { error: error.message });
        throw error;
      }
    }
    return this.browser;
  }

  async generatePDFFromURL(url, options = {}) {
    let browser = null;
    try {
      // Use a fresh browser instance for PDF generation to avoid conflicts
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
          // Note: Removed --single-process and --no-zygote for PDF generation stability
        ]
      });

      // Extract article content
      const article = await extractContent(url);
      
      if (!article) {
        throw new Error('Failed to extract article content');
      }

      // Create HTML for PDF
      const html = this.generatePDFHTML(article, url);

      // Create PDF
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.setContent(html, { waitUntil: 'networkidle' });
      
      const pdf = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: {
          top: options.marginTop || '20mm',
          right: options.marginRight || '15mm',
          bottom: options.marginBottom || '20mm',
          left: options.marginLeft || '15mm'
        },
        displayHeaderFooter: options.displayHeaderFooter !== false,
        headerTemplate: options.headerTemplate || this.getDefaultHeaderTemplate(article),
        footerTemplate: options.footerTemplate || this.getDefaultFooterTemplate()
      });

      await context.close();
      await browser.close();

      logger.info('PDF generated from URL', { 
        url, 
        title: article.title,
        size: pdf.length 
      });

      return pdf;
    } catch (error) {
      logger.error('Failed to generate PDF', { url, error: error.message });
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          logger.error('Failed to close PDF browser', { error: closeError.message });
        }
      }
      throw error;
    }
  }

  generatePDFHTML(article, url) {
    const title = this.escapeHtml(article.title || 'Untitled');
    const byline = this.escapeHtml(article.byline || '');
    const content = article.content || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
    }
    
    .article {
      padding: 20px;
    }
    
    .article-header {
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    
    .article-title {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    
    .article-meta {
      font-size: 10pt;
      color: #666;
      margin-bottom: 5px;
    }
    
    .article-byline {
      font-style: italic;
      margin-bottom: 5px;
    }
    
    .article-url {
      font-size: 9pt;
      color: #0066cc;
      word-break: break-all;
    }
    
    .article-content {
      font-size: 11pt;
    }
    
    .article-content p {
      margin-bottom: 15px;
      text-align: justify;
    }
    
    .article-content h1,
    .article-content h2,
    .article-content h3 {
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    
    .article-content h1 {
      font-size: 18pt;
    }
    
    .article-content h2 {
      font-size: 16pt;
    }
    
    .article-content h3 {
      font-size: 14pt;
    }
    
    .article-content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
      page-break-inside: avoid;
    }
    
    .article-content blockquote {
      margin: 20px 30px;
      padding: 10px 20px;
      border-left: 4px solid #ccc;
      background-color: #f9f9f9;
      font-style: italic;
    }
    
    .article-content ul,
    .article-content ol {
      margin-left: 30px;
      margin-bottom: 15px;
    }
    
    .article-content li {
      margin-bottom: 5px;
    }
    
    .article-content code {
      font-family: 'Courier New', monospace;
      background-color: #f5f5f5;
      padding: 2px 5px;
      border-radius: 3px;
    }
    
    .article-content pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    
    @media print {
      body {
        font-size: 11pt;
      }
    }
  </style>
</head>
<body>
  <div class="article">
    <div class="article-header">
      <h1 class="article-title">${title}</h1>
      ${byline ? `<div class="article-byline">${byline}</div>` : ''}
      <div class="article-meta">Generated from Reader Mode</div>
      <div class="article-url">${this.escapeHtml(url)}</div>
    </div>
    <div class="article-content">
      ${content}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  getDefaultHeaderTemplate(article) {
    const title = this.escapeHtml(article.title || 'Untitled');
    return `
      <div style="font-size: 9px; padding: 5px 15px; width: 100%; color: #666;">
        <span>${title}</span>
      </div>
    `;
  }

  getDefaultFooterTemplate() {
    return `
      <div style="font-size: 9px; padding: 5px 15px; width: 100%; text-align: center; color: #666;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async shutdown() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('PDF generator browser closed');
    }
  }
}

// Singleton instance
const pdfGenerator = new PDFGenerator();

module.exports = pdfGenerator;
