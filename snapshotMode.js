/**
 * Snapshot Mode Implementation with HAR Archive
 * Captures and stores web pages for offline viewing
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');

class SnapshotManager {
  constructor() {
    this.snapshots = new Map();
    this.snapshotDir = path.join(__dirname, 'snapshots');
    this.browser = null;
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.snapshotDir, { recursive: true });
      logger.info('Snapshot storage initialized', { dir: this.snapshotDir });
    } catch (error) {
      logger.error('Failed to initialize snapshot storage', { error: error.message });
    }
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
            '--disable-dev-shm-usage'
          ]
        });
        logger.info('Snapshot browser launched');
      } catch (error) {
        logger.error('Failed to launch browser for snapshots', { error: error.message });
        throw error;
      }
    }
    return this.browser;
  }

  generateSnapshotId() {
    return 'snap_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
  }

  async createSnapshot(url, options = {}) {
    const snapshotId = this.generateSnapshotId();

    try {
      await this.initialize();

      const context = await this.browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
        userAgent: config.USER_AGENT
      });

      const page = await context.newPage();

      // Start HAR recording
      await context.route('**/*', route => route.continue());

      // Navigate to page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT
      });

      // Wait for additional time to ensure everything loads
      await page.waitForTimeout(2000);

      // Capture page data
      const title = await page.title();
      const content = await page.content();
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: options.fullPage || false
      });

      // Get all resources (HAR-like data)
      const resources = await this.captureResources(page);

      // Save snapshot to disk
      const snapshotPath = path.join(this.snapshotDir, snapshotId);
      await fs.mkdir(snapshotPath, { recursive: true });

      const snapshot = {
        id: snapshotId,
        url,
        title,
        createdAt: Date.now(),
        viewport: options.viewport || { width: 1280, height: 720 }
      };

      // Save metadata
      await fs.writeFile(
        path.join(snapshotPath, 'metadata.json'),
        JSON.stringify(snapshot, null, 2)
      );

      // Save HTML content
      await fs.writeFile(
        path.join(snapshotPath, 'index.html'),
        content
      );

      // Save screenshot
      await fs.writeFile(
        path.join(snapshotPath, 'screenshot.png'),
        screenshot
      );

      // Save resources
      await fs.writeFile(
        path.join(snapshotPath, 'resources.json'),
        JSON.stringify(resources, null, 2)
      );

      await context.close();

      this.snapshots.set(snapshotId, snapshot);
      logger.info('Snapshot created', { snapshotId, url });

      return {
        success: true,
        snapshotId,
        snapshot
      };
    } catch (error) {
      logger.error('Failed to create snapshot', { url, error: error.message });
      throw error;
    }
  }

  async captureResources(page) {
    try {
      // Capture all resources loaded by the page
      const resources = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        return entries.map(entry => ({
          name: entry.name,
          type: entry.initiatorType,
          size: entry.transferSize,
          duration: entry.duration,
          startTime: entry.startTime
        }));
      });

      return resources;
    } catch (error) {
      logger.error('Failed to capture resources', { error: error.message });
      return [];
    }
  }

  async getSnapshot(snapshotId) {
    const snapshotPath = path.join(this.snapshotDir, snapshotId);

    try {
      // Read metadata
      const metadataRaw = await fs.readFile(
        path.join(snapshotPath, 'metadata.json'),
        'utf-8'
      );
      const metadata = JSON.parse(metadataRaw);

      // Read HTML content
      const content = await fs.readFile(
        path.join(snapshotPath, 'index.html'),
        'utf-8'
      );

      return {
        metadata,
        content
      };
    } catch (error) {
      logger.error('Failed to get snapshot', { snapshotId, error: error.message });
      throw new Error('Snapshot not found');
    }
  }

  async getSnapshotScreenshot(snapshotId) {
    const snapshotPath = path.join(this.snapshotDir, snapshotId);

    try {
      const screenshot = await fs.readFile(
        path.join(snapshotPath, 'screenshot.png')
      );
      return screenshot;
    } catch (error) {
      logger.error('Failed to get snapshot screenshot', { snapshotId, error: error.message });
      throw new Error('Screenshot not found');
    }
  }

  async listSnapshots() {
    try {
      const entries = await fs.readdir(this.snapshotDir);
      const snapshots = [];

      for (const entry of entries) {
        const snapshotPath = path.join(this.snapshotDir, entry);
        const metadataPath = path.join(snapshotPath, 'metadata.json');

        try {
          const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataRaw);
          snapshots.push(metadata);
        } catch (err) {
          // Skip invalid snapshots
          continue;
        }
      }

      return snapshots;
    } catch (error) {
      logger.error('Failed to list snapshots', { error: error.message });
      return [];
    }
  }

  async deleteSnapshot(snapshotId) {
    const snapshotPath = path.join(this.snapshotDir, snapshotId);

    try {
      await fs.rm(snapshotPath, { recursive: true, force: true });
      this.snapshots.delete(snapshotId);
      logger.info('Snapshot deleted', { snapshotId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete snapshot', { snapshotId, error: error.message });
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down snapshot manager');
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getStats() {
    return {
      totalSnapshots: this.snapshots.size,
      browserActive: !!this.browser
    };
  }
}

// Singleton instance
const snapshotManager = new SnapshotManager();

module.exports = snapshotManager;
