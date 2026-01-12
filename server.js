const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { ssrfProtectionMiddleware } = require('./security');
const { rateLimitMiddleware, sessionRateLimitMiddleware } = require('./rateLimit');
const logger = require('./logger');
const { fetchAndRewrite } = require('./proxy');
const { extractContent, generateReaderHTML } = require('./reader');
const { convertToTextOnly, generateTextOnlyHTML } = require('./textOnly');
const liveManager = require('./liveMode');
const snapshotManager = require('./snapshotMode');
const cookieManager = require('./cookieManager');
const pdfGenerator = require('./pdfGenerator');
const wsManager = require('./websocketManager');
const redisManager = require('./redisManager');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const USE_REDIS = process.env.USE_REDIS === 'true';

// Security middleware - Helmet.js for secure headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for now to allow inline scripts
  crossOriginEmbedderPolicy: false
}));

// Compression middleware for better performance
app.use(compression());

// CORS configuration for API access
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files from web directory for backward compatibility
app.use(express.static(path.join(__dirname, 'web')));
// Serve static files from public directory if it exists
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

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
  res.send = function(data) {
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

// Initialize WebSocket server
wsManager.initialize(server);

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

function generateSessionId() {
  // Using crypto.randomBytes() for cryptographically secure session IDs
  return 'session_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
}

// ===== ROUTE HANDLERS =====

// Main UI page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Live mode viewer page (rate limited by global middleware)
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, 'live.html'));
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

// Snapshot mode: Create snapshot (with SSRF protection)
app.post('/snapshot/create', ssrfProtectionMiddleware, async (req, res) => {
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

// Remote Desktop mode: Full GUI browser
app.get('/desktop', (req, res) => {
  const { sid } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Start containerized desktop environment
  // TODO: Launch Chromium in container
  // TODO: Set up Guacamole/noVNC streaming
  // TODO: Implement strong isolation
  
  res.json({
    mode: 'desktop',
    message: 'Remote desktop mode not yet implemented',
    todo: [
      'Set up container/VM infrastructure',
      'Install Guacamole or noVNC',
      'Configure VNC/RDP streaming',
      'Implement per-session isolation',
      'Handle cleanup and resource limits'
    ],
    note: 'This feature requires Docker/Podman and noVNC/Guacamole setup'
  });
});

// PDF Generation: Generate PDF from reader mode
app.get('/pdf/generate', ssrfProtectionMiddleware, async (req, res) => {
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
        startTime: new Date(metrics.startTime).toISOString()
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
      liveMode: liveManager.getStats(),
      snapshot: snapshotManager.getStats(),
      websocket: wsManager.getStats()
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
    features: {
      proxy: true,
      reader: true,
      textOnly: true,
      live: true,
      snapshot: true,
      pdf: true,
      websocket: wsManager.getStats().wsServerActive,
      redis: USE_REDIS && redisManager.isConnected
    }
  };

  // Check Redis health if enabled
  if (USE_REDIS) {
    health.redis = await redisManager.healthCheck();
  }

  res.json(health);
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
      'Multiple browsing modes (Fast, Reader, Text-only, Live, Snapshot)',
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

// Start server (only if not in serverless environment)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
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
    console.log('   📄 PDF Generation - Convert reader mode to PDF');
    console.log('   🔌 WebSocket Support - Real-time updates (/ws/live)');
    console.log('   🍪 Cookie Management - Persistent cookie storage');
    console.log(`   ${USE_REDIS ? '✅' : '⚠️'} Redis - ${USE_REDIS ? 'Distributed sessions enabled' : 'Using in-memory storage'}`);
    console.log('\n🔒 Security:');
    console.log('   - SSRF protection active');
    console.log('   - Rate limiting active (60 req/min per IP)');
    console.log('   - Session validation active');
    console.log('   - Comprehensive logging enabled');
    console.log('\n⚠️  Note: Desktop mode (noVNC/Guacamole) requires additional setup');
    console.log('\n📚 Documentation: See README.md and docs/ folder');
    console.log(`${'='.repeat(60)}\n`);
  });

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
      pdfGenerator.shutdown(),
      wsManager.shutdown(),
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
      pdfGenerator.shutdown(),
      wsManager.shutdown(),
      USE_REDIS ? redisManager.shutdown() : Promise.resolve()
    ]);

    process.exit(0);
  });
}

// Export app for serverless environments (Vercel, AWS Lambda, etc.)
module.exports = app;
