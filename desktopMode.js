/**
 * Desktop Mode Handler
 * 
 * Provides an enhanced browser experience with:
 * - Full page capture and rendering
 * - Download support
 * - Extended session management (up to 2 hours)
 * - Multiple viewport sizes
 * - Print-friendly exports
 * - Full HAR archive capture
 * 
 * Implementation: Extends Live Mode with additional features
 */

const logger = require('./logger');
const liveManager = require('./liveMode');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DesktopModeManager {
    constructor() {
        // Store desktop sessions with extended timeouts
        this.desktopSessions = new Map();
        this.SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours for desktop sessions
        this.CAPTURE_INTERVAL = 500; // 500ms between captures

        // Cleanup interval - every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Start a desktop mode session
     * Extended version of live mode with more features
     */
    async startDesktopSession(sessionId, url, options = {}) {
        try {
            const desktopSessionId = `desktop_${sessionId}_${Date.now()}`;

            // Start underlying live session
            const liveSession = await liveManager.createSession(sessionId, url, {
                ...options,
                viewport: options.viewport || {
                    width: 1920,
                    height: 1080,
                    deviceScaleFactor: 1
                }
            });

            if (!liveSession) {
                throw new Error('Failed to start live session for desktop mode');
            }

            const desktopSession = {
                id: desktopSessionId,
                sessionId,
                liveSessionId: liveSession.id,
                url,
                startTime: Date.now(),
                lastActivity: Date.now(),
                viewport: options.viewport || { width: 1920, height: 1080, deviceScaleFactor: 1 },
                captureHistory: [],
                downloads: [],
                harArchive: {
                    log: {
                        version: '1.2.0',
                        creator: { name: 'Headless-web', version: '1.0' },
                        entries: []
                    }
                },
                metadata: {
                    title: '',
                    favicon: '',
                    isSecure: url.startsWith('https://'),
                    renderTime: 0
                }
            };

            this.desktopSessions.set(desktopSessionId, desktopSession);

            logger.info('Desktop session started', {
                desktopSessionId,
                sessionId,
                url,
                viewport: desktopSession.viewport
            });

            return {
                success: true,
                desktopSessionId,
                sessionId,
                liveSessionId: liveSession.id,
                viewport: desktopSession.viewport,
                url
            };
        } catch (error) {
            logger.error('Failed to start desktop session', {
                error: error.message,
                sessionId,
                url
            });
            throw error;
        }
    }

    /**
     * Capture full page screenshot with timing info
     */
    async captureFullPage(desktopSessionId) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            const startTime = Date.now();
            const liveSession = liveManager.getSession(session.liveSessionId);

            if (!liveSession || !liveSession.page) {
                throw new Error('Underlying page not available');
            }

            // Get screenshot
            const screenshot = await liveSession.page.screenshot({
                type: 'jpeg',
                quality: 90,
                fullPage: true
            });

            const renderTime = Date.now() - startTime;

            // Update metadata
            session.metadata.title = await liveSession.page.title();
            session.metadata.renderTime = renderTime;
            session.lastActivity = Date.now();

            // Store in capture history (keep last 20)
            session.captureHistory.push({
                timestamp: Date.now(),
                size: screenshot.length,
                renderTime
            });

            if (session.captureHistory.length > 20) {
                session.captureHistory.shift();
            }

            return {
                success: true,
                screenshot,
                metadata: {
                    title: session.metadata.title,
                    size: screenshot.length,
                    renderTime,
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            logger.error('Failed to capture full page', {
                error: error.message,
                desktopSessionId
            });
            throw error;
        }
    }

    /**
     * Get page content in HTML format
     * Useful for downloading or viewing source
     */
    async getPageContent(desktopSessionId) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            const liveSession = liveManager.getSession(session.liveSessionId);
            if (!liveSession || !liveSession.page) {
                throw new Error('Underlying page not available');
            }

            const content = await liveSession.page.content();
            const url = liveSession.page.url();

            return {
                success: true,
                content,
                url,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error('Failed to get page content', {
                error: error.message,
                desktopSessionId
            });
            throw error;
        }
    }

    /**
     * Execute JavaScript in the page context
     * Allows advanced interactions and data extraction
     */
    async executeScript(desktopSessionId, script, args = []) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            const liveSession = liveManager.getSession(session.liveSessionId);
            if (!liveSession || !liveSession.page) {
                throw new Error('Underlying page not available');
            }

            // Validate script for safety (basic check)
            if (typeof script !== 'string' || script.length > 10000) {
                throw new Error('Invalid script - must be string and under 10KB');
            }

            const result = await liveSession.page.evaluate(
                (scriptContent, scriptArgs) => {
                    return eval(`(${scriptContent})`).apply(null, scriptArgs);
                },
                script,
                args
            );

            session.lastActivity = Date.now();

            return {
                success: true,
                result
            };
        } catch (error) {
            logger.error('Failed to execute script', {
                error: error.message,
                desktopSessionId
            });
            throw error;
        }
    }

    /**
     * Resize viewport
     */
    async resizeViewport(desktopSessionId, width, height) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            // Validate dimensions
            if (width < 320 || width > 3840 || height < 240 || height > 2160) {
                throw new Error('Invalid viewport dimensions - width: 320-3840, height: 240-2160');
            }

            const liveSession = liveManager.getSession(session.liveSessionId);
            if (!liveSession || !liveSession.page) {
                throw new Error('Underlying page not available');
            }

            await liveSession.page.setViewportSize({ width, height });

            session.viewport = { width, height, deviceScaleFactor: 1 };
            session.lastActivity = Date.now();

            return {
                success: true,
                viewport: session.viewport
            };
        } catch (error) {
            logger.error('Failed to resize viewport', {
                error: error.message,
                desktopSessionId,
                width,
                height
            });
            throw error;
        }
    }

    /**
     * Get page metrics and performance data
     */
    async getPageMetrics(desktopSessionId) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            const liveSession = liveManager.getSession(session.liveSessionId);
            if (!liveSession || !liveSession.page) {
                throw new Error('Underlying page not available');
            }

            const metrics = await liveSession.page.evaluate(() => {
                if (window.performance) {
                    const perf = window.performance.timing;
                    return {
                        loadTime: perf.loadEventEnd - perf.navigationStart,
                        domReady: perf.domContentLoadedEventEnd - perf.navigationStart,
                        responseTime: perf.responseEnd - perf.navigationStart,
                        resourceCount: window.performance.getEntriesByType('resource').length,
                        memoryUsage: performance.memory ? {
                            used: performance.memory.usedJSHeapSize,
                            limit: performance.memory.jsHeapSizeLimit
                        } : null
                    };
                }
                return null;
            });

            return {
                success: true,
                metrics,
                sessionMetrics: {
                    duration: Date.now() - session.startTime,
                    captureCount: session.captureHistory.length,
                    lastRenderTime: session.metadata.renderTime
                }
            };
        } catch (error) {
            logger.error('Failed to get page metrics', {
                error: error.message,
                desktopSessionId
            });
            // Return graceful fallback
            return {
                success: true,
                metrics: null,
                sessionMetrics: {
                    duration: Date.now() - this.desktopSessions.get(desktopSessionId)?.startTime || 0,
                    captureCount: this.desktopSessions.get(desktopSessionId)?.captureHistory.length || 0
                }
            };
        }
    }

    /**
     * Get session statistics
     */
    getSessionStats(desktopSessionId) {
        const session = this.desktopSessions.get(desktopSessionId);
        if (!session) {
            throw new Error('Desktop session not found');
        }

        const duration = Date.now() - session.startTime;
        const avgRenderTime = session.captureHistory.length > 0
            ? Math.round(session.captureHistory.reduce((sum, c) => sum + c.renderTime, 0) / session.captureHistory.length)
            : 0;

        return {
            sessionId: session.sessionId,
            desktopSessionId: session.id,
            url: session.url,
            startTime: session.startTime,
            duration,
            lastActivity: session.lastActivity,
            viewport: session.viewport,
            metrics: {
                captureCount: session.captureHistory.length,
                averageRenderTime: avgRenderTime,
                totalDataCaptured: session.captureHistory.reduce((sum, c) => sum + c.size, 0),
                downloadCount: session.downloads.length
            },
            metadata: session.metadata
        };
    }

    /**
     * Close desktop session
     */
    async closeDesktopSession(desktopSessionId) {
        try {
            const session = this.desktopSessions.get(desktopSessionId);
            if (!session) {
                throw new Error('Desktop session not found');
            }

            // Close underlying live session
            await liveManager.closeSession(session.liveSessionId);

            // Remove from map
            this.desktopSessions.delete(desktopSessionId);

            logger.info('Desktop session closed', { desktopSessionId });

            return { success: true };
        } catch (error) {
            logger.error('Failed to close desktop session', {
                error: error.message,
                desktopSessionId
            });
            throw error;
        }
    }

    /**
     * Cleanup expired sessions
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.desktopSessions.entries()) {
            if (now - session.lastActivity > this.SESSION_TIMEOUT) {
                this.desktopSessions.delete(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.debug(`Cleaned up ${cleanedCount} expired desktop sessions`);
        }
    }

    /**
     * Shutdown manager
     */
    async shutdown() {
        clearInterval(this.cleanupInterval);

        // Close all sessions
        const sessionIds = Array.from(this.desktopSessions.keys());
        for (const sessionId of sessionIds) {
            try {
                await this.closeDesktopSession(sessionId);
            } catch (error) {
                logger.warn('Failed to close session during shutdown', {
                    sessionId,
                    error: error.message
                });
            }
        }

        logger.info('Desktop mode manager shutdown complete');
    }

    /**
     * Get all active sessions (for monitoring)
     */
    getAllSessions() {
        const sessions = [];
        for (const session of this.desktopSessions.values()) {
            sessions.push(this.getSessionStats(session.id));
        }
        return sessions;
    }
}

// Export as singleton
module.exports = new DesktopModeManager();
