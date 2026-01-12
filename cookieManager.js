/**
 * Cookie Persistence and Management
 * Handles cookie storage, isolation, and mapping between client and target sites
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

class CookieManager {
  constructor() {
    this.cookieStores = new Map(); // sessionId -> cookies
    this.cookieDir = path.join(__dirname, 'cookies');
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.cookieDir, { recursive: true });
      logger.info('Cookie storage initialized', { dir: this.cookieDir });
    } catch (error) {
      logger.error('Failed to initialize cookie storage', { error: error.message });
    }
  }

  /**
   * Parse Set-Cookie header and extract cookie data
   */
  parseSetCookie(setCookieHeader) {
    const cookies = [];
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    for (const header of headers) {
      if (!header) continue;

      const parts = header.split(';').map(p => p.trim());
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      const cookie = {
        name: name.trim(),
        value: value || '',
        attributes: {}
      };

      // Parse attributes
      for (let i = 1; i < parts.length; i++) {
        const attr = parts[i];
        const [key, val] = attr.split('=');
        const attrName = key.trim().toLowerCase();

        if (attrName === 'expires') {
          cookie.attributes.expires = new Date(val);
        } else if (attrName === 'max-age') {
          cookie.attributes.maxAge = parseInt(val, 10);
        } else if (attrName === 'domain') {
          cookie.attributes.domain = val;
        } else if (attrName === 'path') {
          cookie.attributes.path = val;
        } else if (attrName === 'secure') {
          cookie.attributes.secure = true;
        } else if (attrName === 'httponly') {
          cookie.attributes.httpOnly = true;
        } else if (attrName === 'samesite') {
          cookie.attributes.sameSite = val;
        }
      }

      cookies.push(cookie);
    }

    return cookies;
  }

  /**
   * Store cookies for a session
   */
  async storeCookies(sessionId, url, setCookieHeader) {
    if (!setCookieHeader) return;

    try {
      const cookies = this.parseSetCookie(setCookieHeader);
      
      if (!this.cookieStores.has(sessionId)) {
        this.cookieStores.set(sessionId, new Map());
      }

      const store = this.cookieStores.get(sessionId);
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      if (!store.has(domain)) {
        store.set(domain, []);
      }

      const domainCookies = store.get(domain);

      // Update or add cookies
      for (const cookie of cookies) {
        const existingIndex = domainCookies.findIndex(c => c.name === cookie.name);
        if (existingIndex !== -1) {
          domainCookies[existingIndex] = cookie;
        } else {
          domainCookies.push(cookie);
        }
      }

      logger.info('Cookies stored', { 
        sessionId, 
        domain, 
        count: cookies.length 
      });

      // Persist to disk
      await this.saveToDisk(sessionId);
    } catch (error) {
      logger.error('Failed to store cookies', { 
        sessionId, 
        error: error.message 
      });
    }
  }

  /**
   * Get cookies for a session and URL
   */
  getCookies(sessionId, url) {
    try {
      if (!this.cookieStores.has(sessionId)) {
        return '';
      }

      const store = this.cookieStores.get(sessionId);
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      const isSecure = urlObj.protocol === 'https:';

      const allCookies = [];

      // Get cookies for this domain and parent domains
      for (const [cookieDomain, cookies] of store.entries()) {
        if (domain.endsWith(cookieDomain) || cookieDomain.endsWith(domain)) {
          for (const cookie of cookies) {
            // Check if cookie is expired
            if (cookie.attributes.expires && cookie.attributes.expires < new Date()) {
              continue;
            }

            // Check path
            if (cookie.attributes.path && !path.startsWith(cookie.attributes.path)) {
              continue;
            }

            // Check secure flag
            if (cookie.attributes.secure && !isSecure) {
              continue;
            }

            allCookies.push(`${cookie.name}=${cookie.value}`);
          }
        }
      }

      return allCookies.join('; ');
    } catch (error) {
      logger.error('Failed to get cookies', { 
        sessionId, 
        url, 
        error: error.message 
      });
      return '';
    }
  }

  /**
   * Save cookies to disk for persistence
   */
  async saveToDisk(sessionId) {
    try {
      const store = this.cookieStores.get(sessionId);
      if (!store) return;

      const cookieData = {};
      for (const [domain, cookies] of store.entries()) {
        cookieData[domain] = cookies;
      }

      const filePath = path.join(this.cookieDir, `${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(cookieData, null, 2));
    } catch (error) {
      logger.error('Failed to save cookies to disk', { 
        sessionId, 
        error: error.message 
      });
    }
  }

  /**
   * Load cookies from disk
   */
  async loadFromDisk(sessionId) {
    try {
      const filePath = path.join(this.cookieDir, `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const cookieData = JSON.parse(data);

      const store = new Map();
      for (const [domain, cookies] of Object.entries(cookieData)) {
        // Convert expires strings back to Date objects
        const parsedCookies = cookies.map(c => ({
          ...c,
          attributes: {
            ...c.attributes,
            expires: c.attributes.expires ? new Date(c.attributes.expires) : undefined
          }
        }));
        store.set(domain, parsedCookies);
      }

      this.cookieStores.set(sessionId, store);
      logger.info('Cookies loaded from disk', { sessionId });
    } catch (error) {
      // File might not exist, which is fine
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load cookies from disk', { 
          sessionId, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Clear cookies for a session
   */
  async clearCookies(sessionId) {
    try {
      this.cookieStores.delete(sessionId);
      const filePath = path.join(this.cookieDir, `${sessionId}.json`);
      await fs.unlink(filePath).catch(() => {});
      logger.info('Cookies cleared', { sessionId });
    } catch (error) {
      logger.error('Failed to clear cookies', { 
        sessionId, 
        error: error.message 
      });
    }
  }

  /**
   * Get cookie statistics
   */
  getStats(sessionId) {
    if (!this.cookieStores.has(sessionId)) {
      return { domains: 0, cookies: 0 };
    }

    const store = this.cookieStores.get(sessionId);
    let totalCookies = 0;
    for (const cookies of store.values()) {
      totalCookies += cookies.length;
    }

    return {
      domains: store.size,
      cookies: totalCookies
    };
  }

  /**
   * Clean up expired cookies
   */
  cleanupExpired(sessionId) {
    if (!this.cookieStores.has(sessionId)) return;

    const store = this.cookieStores.get(sessionId);
    const now = new Date();

    for (const [domain, cookies] of store.entries()) {
      const validCookies = cookies.filter(cookie => {
        if (cookie.attributes.expires && cookie.attributes.expires < now) {
          return false;
        }
        return true;
      });

      if (validCookies.length === 0) {
        store.delete(domain);
      } else {
        store.set(domain, validCookies);
      }
    }

    logger.info('Expired cookies cleaned up', { sessionId });
  }
}

// Singleton instance
const cookieManager = new CookieManager();

module.exports = cookieManager;
