# Advanced Features Guide

## Overview

Headless-web Gateway now includes a comprehensive suite of advanced features for web browsing, content extraction, and interactive sessions. This guide covers all available features and how to use them.

---

## 🎮 Live Mode (Interactive Browser)

### Description
Live Mode provides a real-time, interactive browser session powered by Playwright. Users can interact with websites through a web-based interface with mouse, keyboard, and scroll support.

### Features
- Real-time frame streaming (2 FPS)
- Mouse input forwarding (click, move, drag)
- Keyboard input support
- Scroll and wheel events
- WebSocket-based bidirectional communication
- Automatic reconnection
- Latency monitoring
- FPS counter

### API Endpoints

#### Start Live Session
```
POST /live/start
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "url": "https://example.com"
}

Response:
{
  "success": true,
  "mode": "live",
  "sessionId": "session_xxx",
  "viewport": { "width": 1280, "height": 720 },
  "message": "Live session started. Connect via WebSocket at /ws/live?sid=session_xxx"
}
```

#### Get Frame/Screenshot
```
GET /live/frame?sid=session_xxx

Response: PNG image (image/png)
```

#### Send Input Event
```
POST /live/input
Content-Type: application/json

{
  "sid": "session_xxx",
  "event": {
    "type": "click",
    "x": 100,
    "y": 200
  }
}
```

### WebSocket Protocol

Connect to: `ws://localhost:3000/ws/live?sid=session_xxx`

#### Client → Server Messages

**Navigate:**
```json
{
  "type": "navigate",
  "url": "https://example.com"
}
```

**Input Event:**
```json
{
  "type": "input",
  "event": {
    "type": "click|mousemove|keydown|keyup|scroll",
    "x": 100,
    "y": 200,
    "key": "Enter",
    "text": "hello"
  }
}
```

**Request Frame:**
```json
{
  "type": "requestFrame"
}
```

**Ping:**
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

#### Server → Client Messages

**Frame Update:**
```json
{
  "type": "frame",
  "image": "base64_encoded_png",
  "format": "png",
  "timestamp": 1234567890,
  "pageInfo": {
    "title": "Page Title",
    "url": "https://example.com",
    "viewport": { "width": 1280, "height": 720 }
  }
}
```

**Navigation Complete:**
```json
{
  "type": "navigated",
  "url": "https://example.com",
  "timestamp": 1234567890
}
```

### Usage Example

```javascript
// Create session
const sessionRes = await fetch('/go?url=https://example.com&mode=live');
const session = await sessionRes.json();

// Start live mode
const liveRes = await fetch('/live/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.sessionId,
    url: 'https://example.com'
  })
});

// Open live viewer
window.open(`/live?sid=${session.sessionId}`, '_blank');
```

### Configuration

```javascript
// In liveMode.js
maxSessions: 10  // Maximum concurrent live sessions
sessionTimeout: 30 * 60 * 1000  // 30 minutes
viewport: { width: 1280, height: 720 }
frameRate: 2  // FPS (frames every 500ms)
```

---

## 📸 Snapshot Mode

### Description
Snapshot Mode captures a complete view of a webpage, including HTML content, resources, and a screenshot for offline viewing.

### Features
- Full page HTML capture
- Resource metadata collection (HAR-like)
- Screenshot generation
- Metadata storage (title, URL, timestamp)
- Offline viewing support
- List and manage snapshots

### API Endpoints

#### Create Snapshot
```
POST /snapshot/create
Content-Type: application/json

{
  "url": "https://example.com",
  "fullPage": false
}

Response:
{
  "success": true,
  "mode": "snapshot",
  "snapshotId": "snap_xxx",
  "snapshot": {
    "id": "snap_xxx",
    "url": "https://example.com",
    "title": "Page Title",
    "createdAt": 1234567890,
    "viewport": { "width": 1280, "height": 720 }
  }
}
```

#### View Snapshot
```
GET /snapshot/view?sid=snap_xxx

Response: HTML content
```

#### Get Screenshot
```
GET /snapshot/screenshot?sid=snap_xxx

Response: PNG image
```

#### List Snapshots
```
GET /snapshot/list

Response:
{
  "success": true,
  "snapshots": [...],
  "count": 5
}
```

### Storage Structure

```
snapshots/
├── snap_xxx/
│   ├── metadata.json
│   ├── index.html
│   ├── screenshot.png
│   └── resources.json
```

---

## 🍪 Cookie Management

### Description
Advanced cookie persistence and management with domain-based isolation and secure storage.

### Features
- Cookie parsing from Set-Cookie headers
- Domain-based cookie isolation
- Attribute support (expires, max-age, domain, path, secure, httpOnly, sameSite)
- Disk persistence
- Automatic expiration cleanup
- Per-session cookie stores

### API Usage

Cookies are automatically managed by the proxy, reader, and text-only modes. No direct API access needed.

### Internal API

```javascript
const cookieManager = require('./cookieManager');

// Store cookies
await cookieManager.storeCookies(sessionId, url, setCookieHeader);

// Get cookies
const cookieString = cookieManager.getCookies(sessionId, url);

// Load from disk
await cookieManager.loadFromDisk(sessionId);

// Clear cookies
await cookieManager.clearCookies(sessionId);

// Get stats
const stats = cookieManager.getStats(sessionId);
// Returns: { domains: 3, cookies: 15 }
```

### Storage Location
Cookies are stored in: `cookies/{sessionId}.json`

---

## 📄 PDF Generation

### Description
Convert reader mode articles to professionally formatted PDF documents.

### Features
- Clean, readable formatting
- Header and footer support
- Page numbers
- Article metadata
- Configurable margins and page size
- Embedded images
- Professional typography

### API Endpoint

```
GET /pdf/generate?url=https://example.com

Response: PDF file (application/pdf)
Content-Disposition: attachment; filename="reader-example.com-1234567890.pdf"
```

### Options

```javascript
await pdfGenerator.generatePDFFromURL(url, {
  format: 'A4',  // or 'Letter', 'A3', etc.
  marginTop: '20mm',
  marginRight: '15mm',
  marginBottom: '20mm',
  marginLeft: '15mm',
  displayHeaderFooter: true,
  headerTemplate: '<div>Custom header</div>',
  footerTemplate: '<div>Page <span class="pageNumber"></span></div>'
});
```

### Usage Example

```html
<a href="/pdf/generate?url=https://example.com" download>
  Download as PDF
</a>
```

---

## 🔌 WebSocket Support

### Description
Real-time bidirectional communication for live mode and future interactive features.

### Features
- Automatic reconnection
- Message queuing
- Ping/pong for latency monitoring
- Frame streaming
- Event broadcasting
- Connection management

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/live?sid=session_xxx');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

---

## 📊 Redis Integration

### Description
Optional Redis support for distributed session storage and rate limiting.

### Features
- Session storage with TTL
- Distributed rate limiting
- Cache management
- Pub/sub for events
- Health monitoring
- Statistics tracking

### Configuration

Set environment variables:
```bash
USE_REDIS=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password  # optional
REDIS_DB=0  # optional
```

### API Usage

```javascript
const redisManager = require('./redisManager');

// Initialize
await redisManager.initialize();

// Session management
await redisManager.setSession(sessionId, data, ttl);
const session = await redisManager.getSession(sessionId);
await redisManager.deleteSession(sessionId);

// Rate limiting
const result = await redisManager.checkRateLimit(key, limit, windowSeconds);
// Returns: { count, limit, remaining, exceeded }

// Cache
await redisManager.setCache(key, value, ttl);
const cached = await redisManager.getCache(key);

// Pub/sub
await redisManager.publish('channel', message);
const subscriber = redisManager.subscribe('channel', callback);

// Health check
const isHealthy = await redisManager.healthCheck();

// Stats
const stats = await redisManager.getStats();
```

---

## 📈 Statistics Endpoint

### Description
Real-time server statistics and monitoring.

### Endpoint

```
GET /stats

Response:
{
  "server": {
    "uptime": 3600,
    "memory": {
      "heapUsed": 50000000,
      "heapTotal": 100000000
    },
    "activeSessions": 5
  },
  "liveMode": {
    "activeSessions": 2,
    "maxSessions": 10,
    "browserActive": true
  },
  "snapshot": {
    "totalSnapshots": 15,
    "browserActive": false
  },
  "websocket": {
    "connectedClients": 3,
    "wsServerActive": true
  },
  "redis": {
    "connected": true,
    "sessions": 5,
    "cacheEntries": 20,
    "rateLimits": 10
  }
}
```

---

## 🔒 Security Features

All advanced features integrate with existing security measures:

- **SSRF Protection**: Validates all URLs before processing
- **Rate Limiting**: Applies to all endpoints
- **Session Validation**: Required for all operations
- **Input Sanitization**: HTML escaping and validation
- **Resource Limits**: Maximum sessions, timeouts
- **Graceful Shutdown**: Cleanup on termination

---

## 🎨 Enhanced UI

### Features
- Dark mode support
- Responsive design
- Real-time statistics
- Mode selection cards
- Quick URL links
- Status indicators
- Modal dialogs
- Smooth animations

### Theme Toggle

The UI supports light and dark themes. Theme preference is saved to localStorage.

```javascript
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}
```

---

## 🚀 Performance Tips

1. **Live Mode**: Limit concurrent sessions (default: 10)
2. **Snapshots**: Clean up old snapshots periodically
3. **Cookies**: Clear expired cookies regularly
4. **Redis**: Use Redis for production deployments
5. **WebSocket**: Close connections when not in use
6. **PDF Generation**: Cache generated PDFs when possible

---

## 🐛 Troubleshooting

### Live Mode Issues
- **Browser won't launch**: Run `npx playwright install chromium`
- **High memory usage**: Reduce maxSessions or implement cleanup
- **Connection drops**: Check WebSocket timeout settings

### Snapshot Issues
- **Snapshots fail**: Ensure write permissions to snapshots/ directory
- **Large snapshot size**: Reduce viewport size or use fullPage: false

### Cookie Issues
- **Cookies not persisting**: Check write permissions to cookies/ directory
- **Cookies not sent**: Verify domain matching logic

### Redis Issues
- **Connection fails**: Verify Redis is running and connection settings
- **Auth errors**: Check REDIS_PASSWORD environment variable

---

## 📝 Example Workflows

### Workflow 1: Browse with Live Mode
```javascript
// 1. Create session
const session = await fetch('/go?url=https://example.com&mode=live').then(r => r.json());

// 2. Start live session
await fetch('/live/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: session.sessionId, url: 'https://example.com' })
});

// 3. Open live viewer
window.open('/live?sid=' + session.sessionId, '_blank');
```

### Workflow 2: Create and View Snapshot
```javascript
// 1. Create snapshot
const snapshot = await fetch('/snapshot/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com', fullPage: true })
}).then(r => r.json());

// 2. View snapshot
window.open('/snapshot/view?sid=' + snapshot.snapshotId, '_blank');

// 3. Get screenshot
window.open('/snapshot/screenshot?sid=' + snapshot.snapshotId, '_blank');
```

### Workflow 3: Export Article to PDF
```javascript
// 1. Generate PDF
const pdfUrl = '/pdf/generate?url=' + encodeURIComponent('https://example.com');

// 2. Download
const a = document.createElement('a');
a.href = pdfUrl;
a.download = 'article.pdf';
a.click();
```

---

## 🔄 Migration from Old Version

If upgrading from an earlier version:

1. **Install new dependencies**: `npm install`
2. **Install Playwright**: `npx playwright install chromium`
3. **Update environment variables**: Add Redis config if needed
4. **Create directories**: `mkdir -p snapshots cookies`
5. **Update UI**: Replace old index.html with new version
6. **Test features**: Run `npm start` and test each mode

---

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Redis Documentation](https://redis.io/docs/)
- [PDF Specification](https://www.adobe.com/devnet/pdf/pdf_reference.html)

---

**Last Updated**: January 12, 2026
**Version**: 2.0
