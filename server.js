const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { ssrfProtectionMiddleware } = require('./security');
const { rateLimitMiddleware, sessionRateLimitMiddleware } = require('./rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

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
  
  res.json({
    success: true,
    sessionId,
    url,
    mode,
    message: 'Session created successfully (Note: Actual browsing features not yet implemented)'
  });
});

// Proxy mode: Server-side fetch + rewrite (with SSRF protection)
app.get('/proxy', ssrfProtectionMiddleware, (req, res) => {
  const { sid, url } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Implement HTTP fetch and HTML/CSS rewriting
  // TODO: Handle cookie/session mapping
  // TODO: Rewrite links, forms, and assets
  
  res.json({
    mode: 'proxy',
    message: 'Proxy rewrite not yet implemented',
    todo: [
      'Fetch URL server-side',
      'Rewrite HTML (href, src, action)',
      'Rewrite CSS (url(...))',
      'Handle redirects',
      'Map cookies'
    ]
  });
});

// Reader mode: Content extraction (with SSRF protection)
app.get('/reader', ssrfProtectionMiddleware, (req, res) => {
  const { sid, url } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Fetch page content
  // TODO: Apply readability algorithm to extract main content
  // TODO: Strip scripts/styles and present clean template
  
  res.json({
    mode: 'reader',
    message: 'Reader mode not yet implemented',
    todo: [
      'Parse HTML',
      'Extract main content using readability algorithm',
      'Return clean article template'
    ]
  });
});

// Text-only mode: Minimal representation (with SSRF protection)
app.get('/text', ssrfProtectionMiddleware, (req, res) => {
  const { sid, url } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Fetch page
  // TODO: Convert to plain text with links as list
  // TODO: Present basic forms if possible
  
  res.json({
    mode: 'text-only',
    message: 'Text-only mode not yet implemented',
    todo: [
      'Extract text content',
      'List links',
      'Present basic forms',
      'Minimal bandwidth usage'
    ]
  });
});

// Live mode: Start Playwright session (with SSRF protection)
app.post('/live/start', ssrfProtectionMiddleware, (req, res) => {
  const { url, sessionId } = req.body;
  
  // Validate session ID
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Initialize Playwright/Puppeteer
  // TODO: Create isolated browser context
  // TODO: Navigate to URL
  // TODO: Set up screenshot/screencast mechanism
  
  res.json({
    mode: 'live',
    message: 'Live mode (Playwright) not yet implemented',
    todo: [
      'Install Playwright/Puppeteer',
      'Launch headless browser',
      'Create isolated context',
      'Set up frame capture',
      'Implement input event forwarding'
    ]
  });
});

// Live mode: Get frame/screenshot
app.get('/live/frame', (req, res) => {
  const { sid } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Capture current frame from Playwright session
  // TODO: Return as image or tiles
  // TODO: Support CDP screencast for better performance
  
  res.json({
    mode: 'live',
    message: 'Frame capture not yet implemented',
    todo: [
      'Capture screenshot from browser',
      'Support tiled screenshots',
      'Consider CDP screencast',
      'Optimize bandwidth'
    ]
  });
});

// Live mode: Send input events
app.post('/live/input', (req, res) => {
  const { sid, event } = req.body;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Validate session
  // TODO: Forward mouse/keyboard events to Playwright browser
  // TODO: Handle clicks, typing, scrolling
  
  res.json({
    mode: 'live',
    message: 'Input forwarding not yet implemented',
    todo: [
      'Parse input events',
      'Forward to browser (mouse, keyboard)',
      'Handle scrolling',
      'Support touch events'
    ]
  });
});

// Snapshot mode: Create snapshot (with SSRF protection)
app.post('/snapshot/create', ssrfProtectionMiddleware, (req, res) => {
  const { url } = req.body;
  
  // TODO: Use Playwright to load page once
  // TODO: Capture rendered HTML + resources (HAR or custom archive)
  // TODO: Store snapshot for later replay
  
  res.json({
    mode: 'snapshot',
    message: 'Snapshot creation not yet implemented',
    todo: [
      'Load page with Playwright',
      'Capture HTML and resources (HAR)',
      'Store snapshot',
      'Generate snapshot ID'
    ]
  });
});

// Snapshot mode: View snapshot
app.get('/snapshot/view', (req, res) => {
  const { sid } = req.query;
  
  // Validate session ID
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  // TODO: Retrieve stored snapshot
  // TODO: Serve captured version without live browser
  // TODO: Handle resource requests from snapshot
  
  res.json({
    mode: 'snapshot',
    message: 'Snapshot viewing not yet implemented',
    todo: [
      'Load snapshot from storage',
      'Serve captured HTML',
      'Serve captured resources',
      'Support view-only interaction'
    ]
  });
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
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Headless-web server running on http://localhost:${PORT}`);
  console.log('✅ Security features enabled:');
  console.log('   - SSRF protection active');
  console.log('   - Rate limiting active (60 req/min per IP)');
  console.log('   - Session validation active');
  console.log('⚠️  Note: Core browsing features still in development');
  console.log('See README.md for implementation status and next steps');
});
