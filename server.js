const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== CONFIGURATION PLACEHOLDERS =====

// TODO: Implement SSRF Protection
// Block private IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
// Block localhost: 127.0.0.1, ::1
// Block link-local/metadata: 169.254.0.0/16 (especially 169.254.169.254)
// SECURITY WARNING: This is a placeholder. In production, this MUST be implemented.
const SSRF_CONFIG = {
  blockPrivateRanges: true,
  blockLocalhost: true,
  blockMetadataIP: true,
  // TODO: Implement IP validation function
  // SECURITY: This currently returns false (no blocking). MUST implement before production.
  isBlockedIP: (ip) => {
    // Placeholder - implement actual IP range checking
    // Example implementation needed:
    // - Parse IP address
    // - Check if in 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    // - Check if 127.0.0.1 or ::1
    // - Check if in 169.254.0.0/16
    return false;
  }
};

// TODO: Implement Rate Limiting
// Track requests per IP/session
// Implement throttling and abuse detection
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 60,
  maxSessionsPerIP: 10,
  // TODO: Implement rate limiting middleware
};

// TODO: Implement Session Management
// Generate and validate session IDs
// Store session state (URL, mode, cookies)
const sessions = new Map();

function generateSessionId() {
  // Using crypto.randomBytes() for cryptographically secure session IDs
  return 'session_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
}

// ===== ROUTE HANDLERS =====

// Main UI page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start a new session/tab
app.get('/go', (req, res) => {
  const { url, mode = 'fast' } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // TODO: Validate URL format (ensure it's a valid HTTP/HTTPS URL)
  // TODO: Check URL against SSRF protections before allowing
  // TODO: Apply rate limiting
  // SECURITY: In production, this MUST validate the URL and check SSRF_CONFIG.isBlockedIP
  
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
    message: 'Session created (placeholder - no actual browsing yet)'
  });
});

// Proxy mode: Server-side fetch + rewrite
app.get('/proxy', (req, res) => {
  const { sid, url } = req.query;
  
  // TODO: Validate session ID
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

// Reader mode: Content extraction
app.get('/reader', (req, res) => {
  const { sid, url } = req.query;
  
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

// Text-only mode: Minimal representation
app.get('/text', (req, res) => {
  const { sid, url } = req.query;
  
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

// Live mode: Start Playwright session
app.post('/live/start', (req, res) => {
  const { url, sessionId } = req.body;
  
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

// Snapshot mode: Create snapshot
app.post('/snapshot/create', (req, res) => {
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
  console.log('Current status: Scaffold only - routes return placeholders');
  console.log('See README.md for implementation status and next steps');
});
