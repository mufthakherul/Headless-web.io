// Polyfill File for environments where global File is missing (e.g., some Node builds)
if (typeof File === 'undefined') {
  global.File = class File extends Blob {
    constructor(chunks, name, options = {}) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
    get [Symbol.toStringTag]() {
      return 'File';
    }
  };
}

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { ssrfProtectionMiddleware } = require('./security');
const { rateLimitMiddleware, sessionRateLimitMiddleware } = require('./rateLimit');
const { isValidURL, isValidSessionID, validateJSONPayload } = require('./validator');
const logger = require('./logger');
const { fetchAndRewrite } = require('./proxy');
const { extractContent, generateReaderHTML } = require('./reader');
const { convertToTextOnly, generateTextOnlyHTML } = require('./textOnly');
const liveManager = require('./liveMode');
const snapshotManager = require('./snapshotMode');
const desktopMode = require('./desktopMode');
const cookieManager = require('./cookieManager');
const pdfGenerator = require('./pdfGenerator');
const wsManager = require('./websocketManager');
const redisManager = require('./redisManager');

// New modules for authentication, AI, and scraper
const database = require('./database');
const authManager = require('./auth');
const { authMiddleware, optionalAuthMiddleware, adminMiddleware, checkAuth } = require('./authMiddleware');
const aiManager = require('./aiManager');
const scraper = require('./scraper');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const USE_REDIS = process.env.USE_REDIS === 'true';
const IS_SERVERLESS = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const DISABLE_PLAYWRIGHT = process.env.DISABLE_PLAYWRIGHT === 'true' || IS_SERVERLESS;
const DISABLE_WEBSOCKET = process.env.DISABLE_WEBSOCKET === 'true' || IS_SERVERLESS;

// Security middleware - Helmet.js for secure headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for now to allow inline scripts
  crossOriginEmbedderPolicy: false
}));

// Compression middleware for better performance
app.use(compression());

// Cookie parser for authentication
app.use(cookieParser());

// Body size limits to prevent abuse
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// CORS configuration for API access
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files from root directory
app.use(express.static(__dirname, {
  index: false // Don't auto-serve index.html, we handle it explicitly
}));

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

// Add security and caching headers
app.use((req, res, next) => {
  // Prevent caching of API responses
  if (req.path.startsWith('/api') || req.path.startsWith('/snapshot') || req.path.startsWith('/live')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // Cache static assets for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add rate limit headers to response
  if (res.locals.rateLimit) {
    res.setHeader('X-RateLimit-Limit', res.locals.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', res.locals.rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', res.locals.rateLimit.reset);
  }

  next();
});

// Request metrics tracking
const metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byPath: {},
    byStatus: {},
    errors: 0
  },
  startTime: Date.now()
};

// Logging and metrics middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.request(req);

  // Track metrics
  metrics.requests.total++;
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;

  // Capture response to track status codes
  const originalSend = res.send;
  res.send = function (data) {
    const statusCode = res.statusCode;
    metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;

    if (statusCode >= 400) {
      metrics.requests.errors++;
    }

    // Track path metrics
    const pathKey = req.path || 'unknown';
    if (!metrics.requests.byPath[pathKey]) {
      metrics.requests.byPath[pathKey] = { count: 0, totalTime: 0, avgTime: 0 };
    }
    metrics.requests.byPath[pathKey].count++;

    const responseTime = Date.now() - startTime;
    metrics.requests.byPath[pathKey].totalTime += responseTime;
    metrics.requests.byPath[pathKey].avgTime = Math.round(
      metrics.requests.byPath[pathKey].totalTime / metrics.requests.byPath[pathKey].count
    );

    // Add response time header
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    return originalSend.call(this, data);
  };

  next();
});

// Initialize WebSocket server (skip in serverless)
if (!DISABLE_WEBSOCKET) {
  try {
    wsManager.initialize(server);
    logger.info('WebSocket server initialized');
  } catch (error) {
    logger.warn('WebSocket initialization failed', { error: error.message });
  }
}

// Initialize Redis if enabled
if (USE_REDIS) {
  redisManager.initialize()
    .then(() => {
      logger.info('Redis initialized successfully');
    })
    .catch((error) => {
      logger.warn('Redis initialization failed, using in-memory storage', {
        error: error.message
      });
    });
}

// ===== CONFIGURATION =====

// Session Management
const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId() {
  // Using crypto.randomBytes() for cryptographically secure session IDs
  return 'session_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
}

// Session cleanup - Remove stale sessions periodically
function cleanupStaleSessions() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const timeSinceLastAccess = now - session.lastAccessed;
    const timeSinceCreation = now - session.createdAt;

    // Remove session if inactive for 30 minutes or older than 24 hours
    if (timeSinceLastAccess > SESSION_TIMEOUT || timeSinceCreation > SESSION_MAX_AGE) {
      sessions.delete(sessionId);
      cleanedCount++;
      logger.session('expired', sessionId, {
        reason: timeSinceLastAccess > SESSION_TIMEOUT ? 'timeout' : 'max_age',
        age: Math.floor(timeSinceCreation / 1000) + 's'
      });
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} stale sessions`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleSessions, 5 * 60 * 1000);

// Response cache for static content
const responseCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResponse(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    responseCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedResponse(key, data) {
  // Simple LRU: if cache is full, remove oldest entry
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }

  responseCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// ===== ROUTE HANDLERS =====

// ===== AUTHENTICATION ROUTES =====

// Check authentication status
app.get('/auth/check', checkAuth);

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    const result = await authManager.login(
      email,
      password,
      req.ip,
      req.headers['user-agent']
    );

    if (result.success) {
      // Set cookies for session
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      logger.info('User logged in', { email, userId: result.user.id });
    }

    res.json(result);
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    const result = await authManager.register(email, password, username);
    res.json(result);
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Logout
app.post('/auth/logout', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    await authManager.logout(sessionId, token);

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('sessionId');

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Get user stats (protected)
app.get('/auth/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await authManager.getUserStats(req.user.id);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Stats retrieval error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    });
  }
});

// ===== AI CHAT ROUTES =====

// Get available AI providers
app.get('/ai/providers', optionalAuthMiddleware, (req, res) => {
  try {
    const providers = aiManager.getAvailableProviders();
    res.json({
      success: true,
      providers
    });
  } catch (error) {
    logger.error('Failed to get providers', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get providers'
    });
  }
});

// Send message to AI
app.post('/ai/chat', optionalAuthMiddleware, async (req, res) => {
  try {
    const { provider, message, model, history, sessionId } = req.body;

    if (!provider || !message) {
      return res.status(400).json({
        success: false,
        error: 'Provider and message required'
      });
    }

    const userId = req.user?.id || null;
    const result = await aiManager.sendMessage(
      provider,
      message,
      model,
      history || [],
      userId,
      sessionId
    );

    res.json(result);
  } catch (error) {
    logger.error('AI chat error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Chat failed'
    });
  }
});

// Get chat history (protected)
app.get('/ai/history', authMiddleware, async (req, res) => {
  try {
    const { sessionId, limit } = req.query;
    const history = await aiManager.getChatHistory(
      req.user.id,
      sessionId,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Failed to get chat history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get history'
    });
  }
});

// Clear chat history (protected)
app.delete('/ai/history', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await aiManager.clearChatHistory(req.user.id, sessionId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to clear chat history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to clear history'
    });
  }
});

// ===== WEB SCRAPER & DOWNLOADER ROUTES =====

// Scrape webpage
app.post('/scrape', optionalAuthMiddleware, async (req, res) => {
  try {
    const { url, options } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL required'
      });
    }

    const result = await scraper.scrapeWebpage(url, options);
    res.json(result);
  } catch (error) {
    logger.error('Scraping error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Scraping failed'
    });
  }
});

// Download YouTube video/audio
app.post('/download/youtube', optionalAuthMiddleware, async (req, res) => {
  try {
    const { url, format, quality } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL required'
      });
    }

    const userId = req.user?.id || null;
    const result = await scraper.downloadYouTube(url, format, quality, userId);
    res.json(result);
  } catch (error) {
    logger.error('YouTube download error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Download failed'
    });
  }
});

// Download image
app.post('/download/image', optionalAuthMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL required'
      });
    }

    const userId = req.user?.id || null;
    const result = await scraper.downloadImage(url, userId);
    res.json(result);
  } catch (error) {
    logger.error('Image download error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Download failed'
    });
  }
});

// Get download status
app.get('/download/status/:downloadId', optionalAuthMiddleware, (req, res) => {
  try {
    const { downloadId } = req.params;
    const status = scraper.getDownloadStatus(downloadId);
    res.json(status);
  } catch (error) {
    logger.error('Status check error', { error: error.message });
    res.status(500).json({
      found: false,
      error: 'Status check failed'
    });
  }
});

// Get download history (protected)
app.get('/download/history', authMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    const history = await scraper.getDownloadHistory(
      req.user.id,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Failed to get download history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get history'
    });
  }
});

// Extract social media info
app.post('/scrape/social', optionalAuthMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL required'
      });
    }

    const result = await scraper.extractSocialMediaInfo(url);
    res.json(result);
  } catch (error) {
    logger.error('Social media extraction error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Extraction failed'
    });
  }
});

// ===== EXISTING ROUTES =====

// Main UI page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Live mode viewer page (rate limited by global middleware)
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, 'live.html'));
});

// Desktop mode viewer page (rate limited by global middleware)
app.get('/desktop-viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'desktop-viewer.html'));
});

// Start a new session/tab (with SSRF protection and session rate limiting)
app.get('/go', sessionRateLimitMiddleware, ssrfProtectionMiddleware, (req, res) => {
  const { url, mode = 'fast' } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // URL has been validated by ssrfProtectionMiddleware
  // req.validatedURL contains the parsed and validated URL

  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    url,
    mode,
    createdAt: Date.now(),
    lastAccessed: Date.now()
  });

  logger.session('created', sessionId, { url, mode });

  res.json({
    success: true,
    sessionId,
    url,
    mode,
    message: 'Session created successfully'
  });
});

// Proxy mode: Server-side fetch + rewrite (with SSRF protection)
app.get('/proxy', ssrfProtectionMiddleware, async (req, res) => {
  const { sid, url } = req.query;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const result = await fetchAndRewrite(url, sid, '/proxy');

    // Update session last accessed time
    const session = sessions.get(sid);
    session.lastAccessed = Date.now();

    res.setHeader('Content-Type', result.contentType);
    res.status(result.statusCode).send(result.content);
  } catch (error) {
    logger.error('Proxy request failed', { sid, url, error: error.message });
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message
    });
  }
});

// Reader mode: Content extraction (with SSRF protection)
app.get('/reader', ssrfProtectionMiddleware, async (req, res) => {
  const { sid, url } = req.query;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const article = await extractContent(url);
    const html = generateReaderHTML(article, url);

    // Update session last accessed time
    const session = sessions.get(sid);
    session.lastAccessed = Date.now();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Reader mode failed', { sid, url, error: error.message });
    res.status(500).json({
      error: 'Reader mode failed',
      message: error.message
    });
  }
});

// Text-only mode: Minimal representation (with SSRF protection)
app.get('/text', ssrfProtectionMiddleware, async (req, res) => {
  const { sid, url } = req.query;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const data = await convertToTextOnly(url);
    const html = generateTextOnlyHTML(data);

    // Update session last accessed time
    const session = sessions.get(sid);
    session.lastAccessed = Date.now();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Text-only mode failed', { sid, url, error: error.message });
    res.status(500).json({
      error: 'Text-only mode failed',
      message: error.message
    });
  }
});

// Live mode: Start Playwright session (with SSRF protection)
app.post('/live/start', ssrfProtectionMiddleware, async (req, res) => {
  // Check if Playwright is disabled
  if (DISABLE_PLAYWRIGHT) {
    return res.status(503).json({
      error: 'Live mode not available',
      message: 'Live mode is disabled in serverless environments. Please use other modes like Fast, Reader, or Text-only.',
      availableModes: ['fast', 'reader', 'text', 'snapshot', 'pdf']
    });
  }

  const { url, sessionId } = req.body;

  // Validate session ID
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  try {
    const result = await liveManager.createSession(sessionId, url);

    logger.info('Live session started', { sessionId, url });

    res.json({
      success: true,
      mode: 'live',
      sessionId,
      viewport: result.viewport,
      message: 'Live session started. Connect via WebSocket at /ws/live?sid=' + sessionId
    });
  } catch (error) {
    logger.error('Failed to start live session', { sessionId, url, error: error.message });
    res.status(500).json({
      error: 'Failed to start live session',
      message: error.message
    });
  }
});

// Live mode: Get frame/screenshot
app.get('/live/frame', async (req, res) => {
  const { sid } = req.query;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  try {
    const frameData = await liveManager.captureFrame(sid, 'png');

    res.setHeader('Content-Type', 'image/png');
    res.send(frameData.image);
  } catch (error) {
    logger.error('Failed to capture frame', { sid, error: error.message });
    res.status(500).json({
      error: 'Failed to capture frame',
      message: error.message
    });
  }
});

// Live mode: Send input events
app.post('/live/input', async (req, res) => {
  const { sid, event } = req.body;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  try {
    await liveManager.sendInput(sid, event);

    res.json({
      success: true,
      message: 'Input event processed'
    });
  } catch (error) {
    logger.error('Failed to send input', { sid, error: error.message });
    res.status(500).json({
      error: 'Failed to send input',
      message: error.message
    });
  }
});

// Live mode: Session diagnostic endpoint
app.get('/live/session/:sid', (req, res) => {
  const { sid } = req.params;
  const sessionExists = sessions.has(sid);
  const liveStats = liveManager.getStats();

  try {
    const allLiveSessions = Array.from(liveManager.sessions.entries()).map(([id, sess]) => ({
      sessionId: id,
      url: sess.url,
      createdAt: sess.createdAt,
      lastAccessed: sess.lastAccessed,
      pageClosed: sess.page ? sess.page.isClosed() : 'N/A'
    }));

    res.json({
      requestedSession: sid,
      sessionExists,
      liveStats,
      allLiveSessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Snapshot mode: Create snapshot (with SSRF protection)
app.post('/snapshot/create', ssrfProtectionMiddleware, async (req, res) => {
  // Check if Playwright is disabled
  if (DISABLE_PLAYWRIGHT) {
    return res.status(503).json({
      error: 'Snapshot mode not available',
      message: 'Snapshot mode requires Playwright which is disabled in serverless environments.',
      availableModes: ['fast', 'reader', 'text', 'pdf']
    });
  }

  const { url, fullPage = false } = req.body;

  try {
    const result = await snapshotManager.createSnapshot(url, { fullPage });

    res.json({
      success: true,
      mode: 'snapshot',
      snapshotId: result.snapshotId,
      snapshot: result.snapshot,
      message: 'Snapshot created successfully'
    });
  } catch (error) {
    logger.error('Failed to create snapshot', { url, error: error.message });
    res.status(500).json({
      error: 'Failed to create snapshot',
      message: error.message
    });
  }
});

// Snapshot mode: View snapshot
app.get('/snapshot/view', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Snapshot ID is required' });
  }

  try {
    const snapshot = await snapshotManager.getSnapshot(sid);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(snapshot.content);
  } catch (error) {
    logger.error('Failed to view snapshot', { sid, error: error.message });
    res.status(404).json({
      error: 'Snapshot not found',
      message: error.message
    });
  }
});

// Snapshot mode: List snapshots
app.get('/snapshot/list', async (req, res) => {
  try {
    const snapshots = await snapshotManager.listSnapshots();

    res.json({
      success: true,
      snapshots,
      count: snapshots.length
    });
  } catch (error) {
    logger.error('Failed to list snapshots', { error: error.message });
    res.status(500).json({
      error: 'Failed to list snapshots',
      message: error.message
    });
  }
});

// Snapshot mode: Get screenshot
app.get('/snapshot/screenshot', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Snapshot ID is required' });
  }

  try {
    const screenshot = await snapshotManager.getSnapshotScreenshot(sid);

    res.setHeader('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    logger.error('Failed to get snapshot screenshot', { sid, error: error.message });
    res.status(404).json({
      error: 'Screenshot not found',
      message: error.message
    });
  }
});

// Remote Desktop mode: Full GUI browser with enhanced capabilities
app.post('/desktop/start', sessionRateLimitMiddleware, ssrfProtectionMiddleware, async (req, res) => {
  if (DISABLE_PLAYWRIGHT) {
    return res.status(503).json({
      error: 'Desktop mode not available',
      message: 'Desktop mode requires Playwright which is disabled in serverless environments.',
      suggestion: 'Try Live mode instead: /live/start'
    });
  }

  const { url, sessionId } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  try {
    const result = await desktopMode.startDesktopSession(sessionId, url, {
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }
    });

    res.json({
      success: true,
      mode: 'desktop',
      ...result
    });
  } catch (error) {
    logger.error('Failed to start desktop session', { error: error.message, url, sessionId });
    res.status(500).json({
      error: 'Failed to start desktop session',
      message: error.message
    });
  }
});

// Desktop mode: Capture full page screenshot
app.get('/desktop/capture', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  try {
    const result = await desktopMode.captureFullPage(sid);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('X-Render-Time', result.metadata.renderTime);
    res.send(result.screenshot);
  } catch (error) {
    logger.error('Failed to capture desktop page', { sid, error: error.message });
    res.status(404).json({
      error: 'Failed to capture page',
      message: error.message
    });
  }
});

// Desktop mode: Get page content
app.get('/desktop/content', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  try {
    const result = await desktopMode.getPageContent(sid);

    res.json({
      success: true,
      content: result.content,
      url: result.url,
      timestamp: result.timestamp
    });
  } catch (error) {
    logger.error('Failed to get desktop page content', { sid, error: error.message });
    res.status(404).json({
      error: 'Failed to get page content',
      message: error.message
    });
  }
});

// Desktop mode: Resize viewport
app.post('/desktop/resize', async (req, res) => {
  const { sid, width, height } = req.body;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  if (!width || !height) {
    return res.status(400).json({ error: 'Width and height are required' });
  }

  try {
    const result = await desktopMode.resizeViewport(sid, width, height);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to resize desktop viewport', { sid, error: error.message });
    res.status(400).json({
      error: 'Failed to resize viewport',
      message: error.message
    });
  }
});

// Desktop mode: Execute JavaScript
app.post('/desktop/execute', async (req, res) => {
  const { sid, script, args } = req.body;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  if (!script) {
    return res.status(400).json({ error: 'Script is required' });
  }

  try {
    const result = await desktopMode.executeScript(sid, script, args || []);

    res.json({
      success: true,
      result: result.result
    });
  } catch (error) {
    logger.error('Failed to execute desktop script', { sid, error: error.message });
    res.status(400).json({
      error: 'Failed to execute script',
      message: error.message
    });
  }
});

// Desktop mode: Get page metrics
app.get('/desktop/metrics', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  try {
    const result = await desktopMode.getPageMetrics(sid);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to get desktop metrics', { sid, error: error.message });
    res.status(404).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

// Desktop mode: Get session stats
app.get('/desktop/stats', async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  try {
    const stats = desktopMode.getSessionStats(sid);

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    logger.error('Failed to get desktop session stats', { sid, error: error.message });
    res.status(404).json({
      error: 'Session not found',
      message: error.message
    });
  }
});

// Desktop mode: List all active sessions (monitoring)
app.get('/desktop/sessions', (req, res) => {
  try {
    const sessions = desktopMode.getAllSessions();

    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    logger.error('Failed to list desktop sessions', { error: error.message });
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error.message
    });
  }
});

// Desktop mode: Close session
app.post('/desktop/close', async (req, res) => {
  const { sid } = req.body;

  if (!sid) {
    return res.status(400).json({ error: 'Desktop session ID is required' });
  }

  try {
    const result = await desktopMode.closeDesktopSession(sid);

    res.json({
      success: true,
      message: 'Desktop session closed'
    });
  } catch (error) {
    logger.error('Failed to close desktop session', { sid, error: error.message });
    res.status(404).json({
      error: 'Failed to close session',
      message: error.message
    });
  }
});

// Remote Desktop mode: Full GUI browser [ORIGINAL PLACEHOLDER - KEPT FOR REFERENCE]
app.get('/desktop', (req, res) => {
  const { sid } = req.query;

  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }

  // Return info about desktop mode
  res.json({
    mode: 'desktop',
    message: 'Desktop mode endpoint available',
    note: 'Full remote desktop (noVNC/Guacamole) not yet implemented',
    availableFeatures: [
      'POST /desktop/start - Start desktop session',
      'GET /desktop/capture - Full page screenshot',
      'GET /desktop/content - Get page HTML',
      'POST /desktop/resize - Resize viewport',
      'POST /desktop/execute - Execute JavaScript',
      'GET /desktop/metrics - Get page metrics',
      'GET /desktop/stats - Get session statistics',
      'GET /desktop/sessions - List all sessions',
      'POST /desktop/close - Close session'
    ],
    futureFeatures: [
      'VNC/RDP streaming via noVNC',
      'Full GUI desktop environment',
      'Per-session containerization',
      'Download support'
    ]
  });
});

// PDF Generation: Generate PDF from reader mode
app.get('/pdf/generate', ssrfProtectionMiddleware, async (req, res) => {
  // Check if Playwright is disabled
  if (DISABLE_PLAYWRIGHT) {
    return res.status(503).json({
      error: 'PDF generation not available',
      message: 'PDF generation requires Playwright which is disabled in serverless environments. Try Reader mode instead.',
      suggestion: 'Use /reader endpoint to view the article in a clean format'
    });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const pdf = await pdfGenerator.generatePDFFromURL(url);

    // Generate filename from URL
    const urlObj = new URL(url);
    const filename = `reader-${urlObj.hostname}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    logger.error('Failed to generate PDF', { url, error: error.message });
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

// Statistics endpoint
app.get('/stats', async (req, res) => {
  try {
    const stats = {
      server: {
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        memory: process.memoryUsage(),
        activeSessions: sessions.size,
        startTime: new Date(metrics.startTime).toISOString(),
        environment: IS_SERVERLESS ? 'serverless' : 'standalone'
      },
      requests: {
        total: metrics.requests.total,
        byMethod: metrics.requests.byMethod,
        byStatus: metrics.requests.byStatus,
        errors: metrics.requests.errors,
        errorRate: metrics.requests.total > 0
          ? ((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%'
      },
      liveMode: !DISABLE_PLAYWRIGHT ? liveManager.getStats() : { enabled: false, message: 'Disabled in serverless' },
      snapshot: !DISABLE_PLAYWRIGHT ? snapshotManager.getStats() : { enabled: false, message: 'Disabled in serverless' },
      websocket: !DISABLE_WEBSOCKET ? wsManager.getStats() : { enabled: false, message: 'Disabled in serverless' }
    };

    // Add Redis stats if available
    if (USE_REDIS && redisManager.isConnected) {
      stats.redis = await redisManager.getStats();
    }

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// Metrics endpoint (detailed request metrics)
app.get('/metrics', (req, res) => {
  const topPaths = Object.entries(metrics.requests.byPath)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([path, data]) => ({
      path,
      requests: data.count,
      avgResponseTime: data.avgTime + 'ms'
    }));

  res.json({
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    totalRequests: metrics.requests.total,
    requestsByMethod: metrics.requests.byMethod,
    requestsByStatus: metrics.requests.byStatus,
    errorCount: metrics.requests.errors,
    errorRate: metrics.requests.total > 0
      ? ((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2) + '%'
      : '0%',
    topEndpoints: topPaths,
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    cacheSize: responseCache.size,
    environment: IS_SERVERLESS ? 'serverless' : 'standalone',
    features: {
      proxy: true,
      reader: true,
      textOnly: true,
      live: !DISABLE_PLAYWRIGHT,
      snapshot: !DISABLE_PLAYWRIGHT,
      pdf: !DISABLE_PLAYWRIGHT,
      websocket: !DISABLE_WEBSOCKET && (wsManager.getStats ? wsManager.getStats().wsServerActive : false),
      redis: USE_REDIS && redisManager.isConnected
    }
  };

  // Check Redis health if enabled
  if (USE_REDIS) {
    health.redis = await redisManager.healthCheck();
  }

  res.json(health);
});

// Session management endpoints
app.get('/sessions/list', (req, res) => {
  const sessionsList = Array.from(sessions.entries()).map(([id, data]) => ({
    id,
    url: data.url,
    mode: data.mode,
    createdAt: new Date(data.createdAt).toISOString(),
    lastAccessed: new Date(data.lastAccessed).toISOString(),
    age: Math.floor((Date.now() - data.createdAt) / 1000) + 's',
    idle: Math.floor((Date.now() - data.lastAccessed) / 1000) + 's'
  }));

  res.json({
    success: true,
    count: sessionsList.length,
    sessions: sessionsList
  });
});

app.delete('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  sessions.delete(sessionId);
  logger.session('deleted', sessionId);

  res.json({
    success: true,
    message: 'Session deleted'
  });
});

app.post('/sessions/cleanup', (req, res) => {
  const beforeCount = sessions.size;
  cleanupStaleSessions();
  const afterCount = sessions.size;

  res.json({
    success: true,
    removed: beforeCount - afterCount,
    remaining: afterCount
  });
});

// Cache management endpoints
app.get('/cache/stats', (req, res) => {
  res.json({
    success: true,
    size: responseCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL + 'ms'
  });
});

app.post('/cache/clear', (req, res) => {
  const beforeSize = responseCache.size;
  responseCache.clear();

  logger.info('Response cache cleared');

  res.json({
    success: true,
    message: 'Cache cleared',
    itemsRemoved: beforeSize
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  const apiDocs = {
    title: 'Headless-web Gateway API Documentation',
    version: '2.0.0',
    description: 'Advanced web-based headless browsing gateway with multiple compatibility modes',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    endpoints: {
      session: {
        'GET /go': {
          description: 'Start a new browsing session',
          parameters: {
            url: { type: 'string', required: true, description: 'Target URL to browse' },
            mode: { type: 'string', required: false, default: 'fast', options: ['fast', 'reader', 'text', 'live', 'snapshot'] }
          },
          response: { sessionId: 'string', url: 'string', mode: 'string' },
          example: '/go?url=https://example.com&mode=fast'
        }
      },
      proxy: {
        'GET /proxy': {
          description: 'Fast mode - Server-side fetch with HTML rewriting',
          parameters: {
            sid: { type: 'string', required: true, description: 'Session ID from /go' },
            url: { type: 'string', required: true, description: 'URL to fetch' }
          },
          response: 'HTML content',
          example: '/proxy?sid=session_xxx&url=https://example.com'
        }
      },
      reader: {
        'GET /reader': {
          description: 'Reader mode - Clean article extraction',
          parameters: {
            sid: { type: 'string', required: true, description: 'Session ID' },
            url: { type: 'string', required: true, description: 'Article URL' }
          },
          response: 'Readable HTML',
          example: '/reader?sid=session_xxx&url=https://example.com/article'
        }
      },
      text: {
        'GET /text': {
          description: 'Text-only mode - Minimal bandwidth',
          parameters: {
            sid: { type: 'string', required: true, description: 'Session ID' },
            url: { type: 'string', required: true, description: 'URL to convert' }
          },
          response: 'Text-only HTML',
          example: '/text?sid=session_xxx&url=https://example.com'
        }
      },
      live: {
        'POST /live/start': {
          description: 'Start interactive browser session (Playwright)',
          parameters: {
            url: { type: 'string', required: true, description: 'URL to load' },
            sessionId: { type: 'string', required: true, description: 'Session ID' }
          },
          response: { success: true, mode: 'live', viewport: 'object' },
          example: 'POST /live/start with JSON body'
        },
        'GET /live/frame': {
          description: 'Get current frame/screenshot from live session',
          parameters: {
            sid: { type: 'string', required: true, description: 'Session ID' }
          },
          response: 'PNG image',
          example: '/live/frame?sid=session_xxx'
        },
        'POST /live/input': {
          description: 'Send input events to live session',
          parameters: {
            sid: { type: 'string', required: true, description: 'Session ID' },
            event: { type: 'object', required: true, description: 'Input event data' }
          },
          response: { success: true },
          example: 'POST /live/input with JSON body'
        }
      },
      snapshot: {
        'POST /snapshot/create': {
          description: 'Create page snapshot',
          parameters: {
            url: { type: 'string', required: true, description: 'URL to snapshot' },
            fullPage: { type: 'boolean', required: false, default: false }
          },
          response: { snapshotId: 'string', snapshot: 'object' },
          example: 'POST /snapshot/create with JSON body'
        },
        'GET /snapshot/view': {
          description: 'View saved snapshot',
          parameters: {
            sid: { type: 'string', required: true, description: 'Snapshot ID' }
          },
          response: 'HTML content',
          example: '/snapshot/view?sid=snapshot_xxx'
        },
        'GET /snapshot/list': {
          description: 'List all snapshots',
          response: { snapshots: 'array', count: 'number' },
          example: '/snapshot/list'
        },
        'GET /snapshot/screenshot': {
          description: 'Get snapshot screenshot',
          parameters: {
            sid: { type: 'string', required: true, description: 'Snapshot ID' }
          },
          response: 'PNG image',
          example: '/snapshot/screenshot?sid=snapshot_xxx'
        }
      },
      pdf: {
        'GET /pdf/generate': {
          description: 'Generate PDF from URL using reader mode',
          parameters: {
            url: { type: 'string', required: true, description: 'URL to convert to PDF' }
          },
          response: 'PDF file',
          example: '/pdf/generate?url=https://example.com/article'
        }
      },
      desktop: {
        'POST /desktop/start': {
          description: 'Start desktop mode session with enhanced capabilities',
          parameters: {
            url: { type: 'string', required: true, description: 'URL to load' },
            sessionId: { type: 'string', required: true, description: 'Session ID' }
          },
          response: { success: true, desktopSessionId: 'string', viewport: 'object' },
          example: 'POST /desktop/start with JSON body'
        },
        'GET /desktop/capture': {
          description: 'Capture full page screenshot',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' }
          },
          response: 'JPEG image',
          example: '/desktop/capture?sid=desktop_xxx'
        },
        'GET /desktop/content': {
          description: 'Get page HTML content',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' }
          },
          response: { content: 'string', url: 'string' },
          example: '/desktop/content?sid=desktop_xxx'
        },
        'POST /desktop/resize': {
          description: 'Resize viewport',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' },
            width: { type: 'number', required: true, description: 'New width (320-3840)' },
            height: { type: 'number', required: true, description: 'New height (240-2160)' }
          },
          response: { success: true, viewport: 'object' },
          example: 'POST /desktop/resize with JSON body'
        },
        'POST /desktop/execute': {
          description: 'Execute JavaScript in page context',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' },
            script: { type: 'string', required: true, description: 'JavaScript code to execute' },
            args: { type: 'array', required: false, description: 'Arguments to pass to script' }
          },
          response: { success: true, result: 'any' },
          example: 'POST /desktop/execute with JSON body'
        },
        'GET /desktop/metrics': {
          description: 'Get page performance metrics',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' }
          },
          response: { metrics: 'object', sessionMetrics: 'object' },
          example: '/desktop/metrics?sid=desktop_xxx'
        },
        'GET /desktop/stats': {
          description: 'Get session statistics and usage data',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' }
          },
          response: { sessionId: 'string', metrics: 'object' },
          example: '/desktop/stats?sid=desktop_xxx'
        },
        'GET /desktop/sessions': {
          description: 'List all active desktop sessions',
          response: { sessions: 'array', count: 'number' },
          example: '/desktop/sessions'
        },
        'POST /desktop/close': {
          description: 'Close desktop session',
          parameters: {
            sid: { type: 'string', required: true, description: 'Desktop session ID' }
          },
          response: { success: true, message: 'string' },
          example: 'POST /desktop/close with JSON body'
        }
      },
      monitoring: {
        'GET /health': {
          description: 'Health check endpoint',
          response: { status: 'ok', timestamp: 'ISO-8601', features: 'object' },
          example: '/health'
        },
        'GET /stats': {
          description: 'Server statistics with comprehensive metrics',
          response: { server: 'object', requests: 'object', liveMode: 'object', snapshot: 'object' },
          example: '/stats'
        },
        'GET /metrics': {
          description: 'Detailed request metrics and performance data',
          response: { uptime: 'number', totalRequests: 'number', topEndpoints: 'array', memory: 'object' },
          example: '/metrics'
        }
      }
    },
    security: {
      ssrf: 'SSRF protection prevents access to internal/private networks',
      rateLimit: '60 requests per minute per IP address',
      sessionValidation: 'All requests require valid session IDs',
      logging: 'Comprehensive logging of all requests'
    },
    features: [
      'Multiple browsing modes (Fast, Reader, Text-only, Live, Snapshot, Desktop)',
      'PDF generation from articles',
      'WebSocket support for real-time updates',
      'Cookie management',
      'Session persistence',
      'Rate limiting',
      'SSRF protection',
      'Compression for better performance',
      'CORS support for API access'
    ]
  };

  res.json(apiDocs);
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  res.status(404).json({
    error: 'Not found',
    message: `The endpoint ${req.method} ${req.url} does not exist`,
    suggestion: 'Check /api/docs for available endpoints',
    documentation: '/api/docs'
  });
});

// Error handler with better error messages
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Send different responses based on environment
  if (isProduction) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
      requestId: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      stack: err.stack,
      url: req.url
    });
  }
});

// Initialize database and authentication
async function initializeServer() {
  try {
    // Initialize database
    logger.info('Initializing database connection...');
    await database.initialize();

    // Initialize authentication
    logger.info('Initializing authentication system...');
    await authManager.initializeAdminUser();

    logger.info('Server initialization complete');
    return true;
  } catch (error) {
    logger.error('Server initialization failed', { error: error.message });
    // Continue running even if database fails (admin can still login via env)
    return false;
  }
}

// Start server (only if not in serverless environment)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Initialize before starting
  initializeServer().then(() => {
    server.listen(PORT, () => {
      logger.info(`Headless-web server started on port ${PORT}`);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Headless-web Gateway Server`);
      console.log(`${'='.repeat(60)}`);
      console.log(`\n📡 Server: http://localhost:${PORT}`);
      console.log(`\n✅ Advanced Features Enabled:`);
      console.log('   ⚡ Fast Mode (Proxy) - Server-side fetch + rewrite');
      console.log('   📖 Reader Mode - Article extraction');
      console.log('   📝 Text-only Mode - Minimal bandwidth');
      console.log('   🎮 Live Mode (Playwright) - Interactive browser sessions');
      console.log('   📸 Snapshot Mode - Capture and replay with HAR');
      console.log('   �️  Desktop Mode - Enhanced browser with full page captures');
      console.log('   📄 PDF Generation - Convert reader mode to PDF');
      console.log('   🔌 WebSocket Support - Real-time updates (/ws/live)');
      console.log('   🍪 Cookie Management - Persistent cookie storage');
      console.log(`   ${USE_REDIS ? '✅' : '⚠️'} Redis - ${USE_REDIS ? 'Distributed sessions enabled' : 'Using in-memory storage'}`);
      console.log(`   ${database.isConnected() ? '✅' : '⚠️'} Database - ${database.isConnected() ? 'PostgreSQL connected' : 'Admin fallback mode'}`);
      console.log('\n🆕 New Features:');
      console.log('   🔐 Authentication - Login with PostgreSQL or admin env fallback');
      console.log('   🤖 AI Chat - Gemini, GPT, Grok, DeepSeek, Copilot');
      console.log('   🕷️  Web Scraper - Extract content, images, links, metadata');
      console.log('   ⬇️  Media Downloader - YouTube videos/audio, images, social media');
      console.log('\n🔒 Security:');
      console.log('   - SSRF protection active');
      console.log('   - Rate limiting active (60 req/min per IP)');
      console.log('   - Session validation active');
      console.log('   - JWT token authentication');
      console.log('   - Comprehensive logging enabled');
      console.log('\n📊 Desktop Mode Features:');
      console.log('   - Full page capture (JPEG, up to 1920x1080)');
      console.log('   - Viewport resizing (320-3840 x 240-2160)');
      console.log('   - JavaScript execution in page context');
      console.log('   - Performance metrics and analytics');
      console.log('   - Extended session timeouts (2 hours)');
      console.log('\n📚 Documentation: See README.md and docs/ folder');
      console.log(`${'='.repeat(60)}\n`);
    });
  });
} else {
  logger.info('Serverless environment detected - skipping server.listen()');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Cleanup managers
  await Promise.all([
    liveManager.shutdown(),
    snapshotManager.shutdown(),
    desktopMode.shutdown(),
    pdfGenerator.shutdown(),
    wsManager.shutdown(),
    database.shutdown(),
    USE_REDIS ? redisManager.shutdown() : Promise.resolve()
  ]);

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await Promise.all([
    liveManager.shutdown(),
    snapshotManager.shutdown(),
    desktopMode.shutdown(),
    pdfGenerator.shutdown(),
    wsManager.shutdown(),
    database.shutdown(),
    USE_REDIS ? redisManager.shutdown() : Promise.resolve()
  ]);

  process.exit(0);
});

// Export app for serverless environments (Vercel, AWS Lambda, etc.)
module.exports = app;