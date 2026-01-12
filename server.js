const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

// Logging middleware
app.use((req, res, next) => {
  logger.request(req);
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Live mode viewer page (rate limited by global middleware)
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'live.html'));
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
        memory: process.memoryUsage(),
        activeSessions: sessions.size
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    url: req.url 
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
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
