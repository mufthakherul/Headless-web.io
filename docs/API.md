# API Documentation - Headless-web v2.1.0

## Overview

Headless-web provides a RESTful API for web browsing with multiple modes and features. This document describes all available endpoints, request formats, and response structures.

## Base URL

```
https://headless-web-mufthakherul.onrender.com
```

## Authentication

All requests require a valid session ID for mode-specific operations. Sessions are created via the `/go` endpoint.

## HTTP Headers

Include the following headers with your requests:

```
Content-Type: application/json
X-Forwarded-For: client-ip (automatically set by proxy)
```

## Response Format

All API responses follow this format:

### Success Response (2xx)
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

### Error Response (4xx, 5xx)
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "requestId": "unique-request-id"
}
```

## Rate Limiting

- **Limit**: 60 requests per minute per IP
- **Headers**: Check `X-RateLimit-*` headers in response

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2026-01-12T15:30:00Z
```

## Endpoints

### 1. Session Management

#### Create Session
```
GET /go?url={url}&mode={mode}
```

**Parameters:**
- `url` (required): Website URL to browse
- `mode` (optional): Browsing mode (fast, reader, text, live, snapshot, pdf)

**Response:**
```json
{
  "success": true,
  "sessionId": "session_1673123456_abc123...",
  "url": "https://example.com",
  "mode": "fast"
}
```

**Rate Limit**: 10 sessions per minute per IP

---

### 2. Browsing Modes

#### Fast Mode (Proxy)
```
GET /proxy?sid={sessionId}&url={url}
```

**Features:**
- Server-side fetch with HTML/CSS rewriting
- Fastest performance
- Best for static sites

**Response**: HTML content with rewritten URLs

---

#### Reader Mode
```
GET /reader?sid={sessionId}&url={url}
```

**Features:**
- Clean article extraction
- Optimized reading experience
- PDF export support

**Response:** HTML with extracted article content

---

#### Text-Only Mode
```
GET /text?sid={sessionId}&url={url}
```

**Features:**
- Minimal bandwidth usage
- Text-only content
- Link list included

**Response:** Plain text with links

---

### 3. Live Mode (Interactive Browser)

#### Start Live Session
```
POST /live/start
Content-Type: application/json

{
  "sessionId": "session_...",
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_...",
  "viewport": {
    "width": 1280,
    "height": 720
  }
}
```

#### Connect via WebSocket
```
wss://headless-web.../ws/live?sid={sessionId}
```

**Message Types:**

- **frame** - Screenshot frame
- **navigated** - Page navigation completed
- **error** - Error message
- **pong** - Latency response

**Send Messages:**
```json
{
  "type": "navigate",
  "url": "https://newurl.com"
}
```

```json
{
  "type": "input",
  "event": {
    "type": "click",
    "x": 100,
    "y": 200
  }
}
```

---

### 4. Snapshot Mode

#### Create Snapshot
```
POST /snapshot/create
Content-Type: application/json

{
  "url": "https://example.com",
  "fullPage": false
}
```

**Response:**
```json
{
  "success": true,
  "snapshotId": "snap_1673123456_abc123..."
}
```

#### View Snapshot
```
GET /snapshot/view?sid={snapshotId}
```

**Response:** HTML content of snapshot

#### Get Screenshot
```
GET /snapshot/screenshot?sid={snapshotId}
```

**Response:** PNG image

#### List Snapshots
```
GET /snapshot/list
```

---

### 5. PDF Generation

#### Generate PDF
```
GET /pdf/generate?url={url}
```

**Parameters:**
- `url` (required): URL to convert to PDF
- `format` (optional): Paper format (A4, Letter, etc.)

**Response:** PDF file

---

### 6. Health & Monitoring

#### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "environment": "standalone",
  "features": {
    "proxy": true,
    "reader": true,
    "textOnly": true,
    "live": true,
    "snapshot": true,
    "pdf": true,
    "websocket": true
  }
}
```

#### Statistics
```
GET /stats
```

**Response:**
```json
{
  "uptime": "2h 30m 45s",
  "requests": {
    "total": 1234,
    "errors": 12,
    "errorRate": "0.97%"
  },
  "sessions": {
    "active": 5,
    "total": 123
  },
  "memory": {
    "heapUsed": "45MB",
    "heapTotal": "200MB"
  }
}
```

#### API Documentation
```
GET /api/docs
```

---

### 7. Session Diagnostics

#### Get Session Status
```
GET /live/session/{sessionId}
```

**Response:**
```json
{
  "requestedSession": "session_...",
  "sessionExists": true,
  "liveStats": {
    "activeSessions": 3,
    "browserActive": true
  }
}
```

---

## Error Codes

| Code | Meaning | Resolution |
|------|---------|-----------|
| 400 | Bad Request | Check URL and parameters |
| 401 | Unauthorized | Invalid or missing session ID |
| 404 | Not Found | Endpoint or resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded, wait before retrying |
| 500 | Server Error | Try again later or check server status |
| 503 | Service Unavailable | Feature disabled in current environment |

---

## Code Examples

### JavaScript/Fetch

```javascript
// Create session
const response = await fetch('/go?url=https://example.com&mode=fast');
const { sessionId, url } = await response.json();

// Open result
const proxyUrl = `/proxy?sid=${sessionId}&url=${encodeURIComponent(url)}`;
window.open(proxyUrl, '_blank');
```

### cURL

```bash
# Create session
curl -X GET "http://localhost:3000/go?url=https://example.com&mode=reader"

# Create snapshot
curl -X POST "http://localhost:3000/snapshot/create" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Check health
curl http://localhost:3000/health
```

### Python

```python
import requests

# Create session
response = requests.get(
    'http://localhost:3000/go',
    params={'url': 'https://example.com', 'mode': 'reader'}
)
session_id = response.json()['sessionId']

# Get reader content
reader_response = requests.get(
    'http://localhost:3000/reader',
    params={'sid': session_id, 'url': 'https://example.com'}
)
print(reader_response.text)
```

---

## Best Practices

1. **Always validate URLs** before sending them to the API
2. **Reuse session IDs** within their lifetime (30 minutes)
3. **Check health endpoint** before critical operations
4. **Monitor rate limits** via response headers
5. **Handle errors gracefully** with appropriate user feedback
6. **Use appropriate mode** for your use case:
   - Fast: Speed-critical applications
   - Reader: Article/content extraction
   - Live: Interactive browsing
   - Snapshot: Static page capture

---

## Limitations & Features

### Resource Limits
- Max URL length: 2048 characters
- Request body size: 1MB
- Session timeout: 30 minutes
- Max concurrent live sessions: 10 per IP
- Screenshot timeout: 30 seconds

### Supported Protocols
- HTTP
- HTTPS

### Blocked URLs
- Localhost (127.0.0.1, localhost)
- Private IPs (10.x, 172.16-31.x, 192.168.x)
- Link-local addresses (169.254.x)
- Metadata endpoints (169.254.169.254)

---

## Support

- **Issues**: https://github.com/mufthakherul/Headless-web.io/issues
- **Documentation**: https://github.com/mufthakherul/Headless-web.io/tree/main/docs
- **Status**: Check `/health` endpoint

---

**Last Updated**: January 12, 2026  
**API Version**: 2.1.0
