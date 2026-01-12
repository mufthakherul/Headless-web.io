/**
 * Live Mode Implementation with Playwright
 * Provides interactive server-side browser sessions with real-time screenshot streaming
 */

const { chromium } = require('playwright');
const logger = require('./logger');
const config = require('./config');

class LiveModeManager {
  constructor() {
    this.sessions = new Map();
    this.browser = null;
    this.maxSessions = process.env.MAX_LIVE_SESSIONS || 10;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
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
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });
        logger.info('Playwright browser launched successfully');

        // Start cleanup timer
        this.startCleanupTimer();
      } catch (error) {
        logger.error('Failed to launch Playwright browser', { error: error.message });
        throw error;
      }
    }
    return this.browser;
  }

  async createSession(sessionId, url) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum live sessions (${this.maxSessions}) reached`);
    }

    if (this.sessions.has(sessionId)) {
      throw new Error('Session already exists');
    }

    try {
      await this.initialize();

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: config.USER_AGENT,
        ignoreHTTPSErrors: false
      });

      const page = await context.newPage();

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT
      });

      const session = {
        sessionId,
        context,
        page,
        url,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        viewport: { width: 1280, height: 720 }
      };

      this.sessions.set(sessionId, session);
      logger.session('live-created', sessionId, { url });

      return {
        success: true,
        sessionId,
        viewport: session.viewport
      };
    } catch (error) {
      logger.error('Failed to create live session', { sessionId, url, error: error.message });
      throw error;
    }
  }

  async captureFrame(sessionId, format = 'png') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      session.lastAccessed = Date.now();
      
      // Check if page is still valid
      if (!session.page || session.page.isClosed()) {
        throw new Error('Page has been closed');
      }
      
      const screenshot = await session.page.screenshot({
        type: format,
        fullPage: false,
        timeout: 5000
      });

      if (!screenshot || screenshot.length === 0) {
        throw new Error('Screenshot is empty');
      }

      return {
        image: screenshot,
        format,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Failed to capture frame', { 
        sessionId, 
        error: error.message,
        pageExists: session.page !== undefined,
        pageClosed: session.page ? session.page.isClosed() : 'N/A'
      });
      throw error;
    }
  }

  async sendInput(sessionId, event) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      session.lastAccessed = Date.now();
      const { page } = session;

      switch (event.type) {
        case 'click':
          await page.mouse.click(event.x, event.y);
          break;

        case 'mousemove':
          await page.mouse.move(event.x, event.y);
          break;

        case 'mousedown':
          await page.mouse.down();
          break;

        case 'mouseup':
          await page.mouse.up();
          break;

        case 'keydown':
          if (event.key) {
            await page.keyboard.down(event.key);
          }
          break;

        case 'keyup':
          if (event.key) {
            await page.keyboard.up(event.key);
          }
          break;

        case 'keypress':
        case 'type':
          if (event.text) {
            await page.keyboard.type(event.text);
          }
          break;

        case 'scroll':
          await page.evaluate((x, y) => {
            window.scrollBy(x, y);
          }, event.deltaX || 0, event.deltaY || 0);
          break;

        case 'wheel':
          await page.mouse.wheel(event.deltaX || 0, event.deltaY || 0);
          break;

        default:
          throw new Error(`Unknown event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to send input', { sessionId, event, error: error.message });
      throw error;
    }
  }

  async navigate(sessionId, url) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      session.lastAccessed = Date.now();
      await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT
      });
      session.url = url;

      return { success: true, url };
    } catch (error) {
      logger.error('Failed to navigate', { sessionId, url, error: error.message });
      throw error;
    }
  }

  async getPageInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      session.lastAccessed = Date.now();
      const { page } = session;

      const title = await page.title();
      const url = page.url();
      const viewport = page.viewportSize();

      return {
        title,
        url,
        viewport
      };
    } catch (error) {
      logger.error('Failed to get page info', { sessionId, error: error.message });
      throw error;
    }
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      await session.context.close();
      this.sessions.delete(sessionId);
      logger.session('live-closed', sessionId);
    } catch (error) {
      logger.error('Failed to close session', { sessionId, error: error.message });
      this.sessions.delete(sessionId);
    }
  }

  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastAccessed > this.sessionTimeout) {
          logger.info('Cleaning up inactive session', { sessionId });
          this.closeSession(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  async shutdown() {
    logger.info('Shutting down live mode manager');

    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getStats() {
    return {
      activeSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      browserActive: !!this.browser
    };
  }
}

// Singleton instance
const liveManager = new LiveModeManager();

module.exports = liveManager;
