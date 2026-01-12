# Headless-web

A web-based “headless browsing gateway” project. The goal is to let users open websites **through your server** using different **compatibility modes**—from a lightweight HTTP proxy (fast/cheap) to a fully interactive server-side browser session (high compatibility), with a controller that can **fallback** between techniques when something doesn’t work.

This is especially useful when:
- some websites break on constrained devices or networks
- you want a “browser inside a website” experience
- you want to offer multiple ways to load a site (fast vs compatible vs view-only)

> Note: A website cannot behave like a device-wide VPN. It can only proxy/broker traffic inside this service.

---

## Project Goals

- Provide a **browser-like experience inside a web app**.
- Support a **mode system**: users can manually choose a mode, or allow auto-selection.
- Implement a **fallback controller** that can switch strategies when a site fails in a cheaper mode.
- Keep the frontend simple enough to work on **older Chrome versions** (example target from our discussion: Chrome 75 on Chromebook).

---

## Key Concepts

### Public user modes (7)
These are the simple options you can show to users:

1. **Fast (Proxy)** — server fetch + rewrite
2. **Fast+ (Proxy Optimized)** — proxy + optimization/transcoding
3. **Reader** — article/content extraction
4. **Text-only** — maximum compatibility, minimum bandwidth
5. **Snapshot (View-only)** — render once, replay later
6. **Live (Interactive)** — interactive server-side browser (Playwright/Puppeteer streaming)
7. **Full Desktop (Maximum)** — remote desktop browser (Guacamole/noVNC)

### Internal modes/techniques (10)
Internally, the controller uses multiple techniques (proxy rewrite, transcoding, snapshots, selective remote rendering, remote desktop, etc.) to implement the 7 user modes.

---

## Features (Planned / In Scope)

### Mode system
- Manual mode selection (user chooses what they need)
- Optional auto mode (controller escalates as needed)

### Proxy browsing (Fast / Fast+)
- Server-side HTTP fetch and HTML/CSS rewriting
- Cookie/session mapping
- Resource rewriting (links, forms, assets)
- Optional optimization layer (image compression, blocking heavy scripts, gzip, caching)

### Readability modes
- Reader mode (article extraction)
- Text-only mode

### Headless rendering modes
- Snapshot mode (render once, replay view-only)
- Live mode (interactive remote tab via Playwright/Puppeteer)

### Remote desktop mode
- Full GUI browser in a container/VM, streamed to client

### Security (required)
- SSRF protections (block localhost/private ranges/metadata endpoints)
- Rate limiting and abuse prevention
- Strong session isolation (especially for Live/Desktop)
- Safe handling of cookies/credentials

---

## How It Works (High-Level)

1. User enters a URL and chooses a mode (or “Auto”).
2. The controller routes the request:
   - Proxy rewrite for cheap browsing
   - Reader/Text-only for content access
   - Snapshot for view-only
   - Live/Remote Desktop for full compatibility
3. If Auto mode is enabled, the controller can fallback/escalate:
   - Fast → Fast+ → Reader/Text → Snapshot → Live → Full Desktop

---

## Repository Docs

- **Internal Modes (10):** `docs/internal-modes.md`
- **Public User Modes (7):** `docs/public-user-modes.md`
- **Fallback System & Mode Management:** `docs/fallback-and-mode-management.md`

---

## Planned Architecture (Suggested)

- **Gateway / Controller**
  - Decides mode per tab/session
  - Stores session state (URL, mode, cookies mapping, etc.)

- **Proxy Service**
  - Fetch + rewrite HTML/CSS
  - Applies optimization/transcoding when enabled

- **Render Service (Playwright/Puppeteer)**
  - Snapshot generation
  - Live interactive sessions (frames + input events)

- **Remote Desktop Service**
  - Guacamole/noVNC session manager
  - Per-user container isolation

---

## API / Routing Ideas (Example)

These are example endpoints you can implement (adjust freely):

### Main Routes
- `GET /` — Enhanced UI with dark mode and statistics
- `GET /live` — Live mode interactive viewer
- `GET /health` — Health check with feature status

### Session Management
- `GET /go?url=...&mode=fast` — Create a session/tab
- `GET /stats` — Server statistics and monitoring

### Browsing Modes
- `GET /proxy?sid=...&url=...` — Proxy rewrite fetch (Fast Mode)
- `GET /reader?sid=...&url=...` — Reader mode extraction
- `GET /text?sid=...&url=...` — Text-only rendering
- `GET /pdf/generate?url=...` — Generate PDF from reader mode

### Live Mode (Interactive Browser)
- `POST /live/start` — Start Playwright session
- `GET /live/frame?sid=...` — Get current frame/screenshot
- `POST /live/input?sid=...` — Send input events (mouse, keyboard)
- `WS /ws/live?sid=...` — WebSocket for real-time streaming

### Snapshot Mode
- `POST /snapshot/create` — Create page snapshot with HAR
- `GET /snapshot/view?sid=...` — View captured snapshot
- `GET /snapshot/screenshot?sid=...` — Get snapshot screenshot
- `GET /snapshot/list` — List all snapshots

### Desktop Mode (Requires Setup)
- `GET /desktop?sid=...` — Open Guacamole/noVNC session

---

## Advanced Features Documentation

For detailed documentation on advanced features, see:
- **[Advanced Features Guide](docs/ADVANCED_FEATURES.md)** - Complete guide to Live Mode, Snapshots, Cookie Management, PDF Generation, WebSocket, and Redis
- **[API Documentation](docs/ADVANCED_FEATURES.md#api-endpoints)** - Detailed API endpoint documentation
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions

---

## Compatibility Notes

- Proxy rewriting will never be perfect for all modern sites (CSP/bot checks/JS-heavy apps).
- Live/Remote Desktop modes increase compatibility but require more server resources.
- Chrome 75 clients should work fine with a simple UI and basic JS (avoid modern-only frontend dependencies).

---

## Security Notes (Must Read)

If you allow users to load arbitrary URLs, you must protect the server from abuse:

- **SSRF blocking**
  - Block requests to:
    - `127.0.0.1`, `localhost`
    - private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
    - link-local/metadata: `169.254.0.0/16` (including `169.254.169.254`)
- Rate limiting per IP/user/session
- Abuse monitoring and logging
- Strict isolation for Live/Desktop sessions
- Consider a domain allowlist for MVP

---

## Status

This repository currently focuses on **design and documentation** for the multi-mode browsing system. Implementation can be added incrementally (start with Fast + Reader/Text-only, then add Playwright, then remote desktop).

---

## License

Add a license file if/when you decide the project’s licensing (MIT/Apache-2.0/etc.).

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation & Running

1. Clone the repository:
   ```bash
   git clone https://github.com/mufthakherul/Headless-web.git
   cd Headless-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers (for Live Mode and Snapshots):
   ```bash
   npx playwright install chromium
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

The server will start on port 3000 by default (or the port specified in the `PORT` environment variable).

### Optional: Redis Setup

For distributed sessions and rate limiting:

```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                  # macOS

# Start Redis
redis-server

# Configure in environment
export USE_REDIS=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

---

## ✨ Features Overview

### 🎯 7 Browsing Modes

1. **⚡ Fast (Proxy)** - Server-side fetch with HTML/CSS rewriting
2. **🚀 Fast+ (Optimized)** - Enhanced proxy with optimization (planned)
3. **📖 Reader** - Article extraction with PDF export
4. **📝 Text-only** - Minimal bandwidth text view
5. **📸 Snapshot** - Capture and replay with HAR archive
6. **🎮 Live (Interactive)** - Real-time browser via Playwright + WebSocket
7. **🖥️ Full Desktop** - Remote desktop browser (requires setup)

### 🔥 Advanced Features

- **🎮 Live Mode**: Interactive browser sessions with Playwright
  - Real-time frame streaming (2 FPS)
  - Mouse and keyboard input forwarding
  - WebSocket bidirectional communication
  - Session isolation and automatic cleanup

- **📸 Snapshot Mode**: Full page capture with offline viewing
  - HTML content + resource metadata
  - Screenshot generation
  - HAR-like archive format
  - List and manage snapshots

- **🍪 Cookie Management**: Persistent and isolated
  - Domain-based cookie stores
  - Attribute parsing (expires, secure, httpOnly, etc.)
  - Disk persistence
  - Automatic expiration cleanup

- **📄 PDF Generation**: Professional formatting
  - Convert reader mode to PDF
  - Headers, footers, page numbers
  - Configurable margins and page size

- **🔌 WebSocket Support**: Real-time communication
  - Bidirectional messaging
  - Automatic reconnection
  - Latency monitoring
  - Event broadcasting

- **📊 Redis Integration** (Optional): Distributed state
  - Session storage with TTL
  - Distributed rate limiting
  - Cache management
  - Pub/sub for events

### 🔒 Security Features

- ✅ SSRF protection (blocks private IPs, localhost, metadata endpoints)
- ✅ Rate limiting (60 req/min per IP)
- ✅ Session validation
- ✅ Input sanitization and XSS prevention
- ✅ Secure session IDs (256-bit crypto random)
- ✅ Comprehensive logging with Winston

### 🎨 Modern UI

- ✅ Dark mode support
- ✅ Responsive design (mobile + desktop)
- ✅ Real-time statistics
- ✅ Visual mode selector
- ✅ Progress indicators
- ✅ Smooth animations
- ✅ Chrome 75+ compatible

---

## Implementation Status

### ✅ Currently Implemented (v2.0 - Advanced Features)

**Server Infrastructure:**
- ✅ Node.js/Express server with HTTP/WebSocket support
- ✅ All API endpoints fully functional
- ✅ Cryptographically secure session IDs (256-bit)
- ✅ Configuration structure for SSRF protection
- ✅ Configuration structure for rate limiting
- ✅ Health check endpoint (`/health`)
- ✅ Statistics endpoint (`/stats`)
- ✅ Graceful shutdown handling

**Frontend UI:**
- ✅ Modern responsive design with dark mode
- ✅ Enhanced user interface with animations
- ✅ URL input with quick links
- ✅ Visual mode selector with status badges
- ✅ Real-time statistics modal
- ✅ Theme toggle (light/dark)
- ✅ Mobile-responsive design
- ✅ Chrome 75+ compatible

**Security Features (Production-Ready):**
- ✅ SSRF protection with IP range validation
- ✅ Localhost and private IP blocking
- ✅ Metadata endpoint blocking (169.254.169.254)
- ✅ Rate limiting middleware (60 req/min per IP)
- ✅ Session validation on all routes
- ✅ Comprehensive logging with Winston
- ✅ Input sanitization and validation

**Proxy Mode (Fast/Fast+):**
- ✅ HTTP/HTTPS fetching with proper headers
- ✅ HTML rewriting (href, src, action, srcset)
- ✅ CSS rewriting (url(...) patterns)
- ✅ Cookie mapping and isolation
- ✅ Redirect handling (max 5 redirects)
- ✅ Error handling and timeouts
- ✅ XSS prevention with HTML escaping

**Content Extraction (Reader & Text-only):**
- ✅ Mozilla Readability algorithm integration
- ✅ Article extraction with clean formatting
- ✅ Reading time estimation
- ✅ Text-only mode with minimal bandwidth
- ✅ Link list generation
- ✅ Mobile-responsive templates

**🎮 Live Mode (NEW - Playwright Integration):**
- ✅ Interactive server-side browser sessions
- ✅ Real-time frame streaming (2 FPS)
- ✅ WebSocket bidirectional communication
- ✅ Mouse input forwarding (click, move, drag)
- ✅ Keyboard input support
- ✅ Scroll and wheel events
- ✅ Browser context isolation per session
- ✅ Automatic session cleanup
- ✅ Live mode viewer UI (`/live`)
- ✅ FPS counter and latency monitoring

**📸 Snapshot Mode (NEW - HAR-like Capture):**
- ✅ Full page capture with Playwright
- ✅ Screenshot generation
- ✅ Resource metadata collection
- ✅ Offline viewing support
- ✅ Snapshot management (list, view, delete)
- ✅ Disk-based storage

**🍪 Cookie Management (NEW):**
- ✅ Cookie persistence and isolation
- ✅ Domain-based cookie stores
- ✅ Attribute parsing (expires, domain, path, secure, httpOnly, sameSite)
- ✅ Disk persistence
- ✅ Automatic expiration cleanup
- ✅ Per-session cookie isolation

**📄 PDF Generation (NEW):**
- ✅ Convert reader mode to PDF
- ✅ Professional formatting
- ✅ Headers and footers
- ✅ Page numbers
- ✅ Article metadata
- ✅ Configurable margins and page size

**🔌 WebSocket Support (NEW):**
- ✅ Real-time bidirectional communication
- ✅ WebSocket server on `/ws/live`
- ✅ Automatic reconnection logic
- ✅ Frame streaming for live mode
- ✅ Event forwarding
- ✅ Ping/pong for latency monitoring

**📊 Redis Integration (NEW - Optional):**
- ✅ Distributed session storage
- ✅ Redis-based rate limiting
- ✅ Cache management
- ✅ Pub/sub for events
- ✅ Health monitoring
- ✅ Statistics tracking
- ✅ Configurable via environment variables

### 🚧 Next Steps (Future Enhancements)

**Phase 1: Desktop Mode (Requires External Setup)**
- [ ] Docker/Podman container setup
- [ ] VNC server configuration
- [ ] noVNC client integration
- [ ] Guacamole alternative setup
- [ ] Container orchestration
- [ ] Resource limits per container

**Phase 2: Advanced Optimizations**
- [ ] Image transcoding/compression for Fast+ mode
- [ ] Script stripping/deferral options
- [ ] Advanced resource caching
- [ ] Ad/tracker blocking (optional)
- [ ] CDN integration
- [ ] Compression optimization

**Phase 3: Enhanced Features**
- [ ] JavaScript execution in proxy mode
- [ ] WebSocket proxy support
- [ ] History tracking
- [ ] Bookmark/favorites system
- [ ] Search within proxied content
- [ ] Multi-language support (i18n)
- [ ] Progressive Web App (PWA)

**Phase 4: Production Scaling**
- [ ] Kubernetes deployment configs
- [ ] Load balancing setup
- [ ] Multi-region support
- [ ] Advanced monitoring (Prometheus/Grafana)
- [ ] Log aggregation (ELK stack)
- [ ] Automated backups

**Phase 5: AI/ML Features**
- [ ] Content classification
- [ ] Automatic mode selection
- [ ] Smart caching predictions
- [ ] Anomaly detection
- [ ] Performance optimization recommendations

### 📝 Important Notes

**Current Status: Production-Ready for Most Features**
- Core proxy, reader, and text-only modes are fully functional
- Live mode (Playwright) is fully functional
- Snapshot mode is fully functional
- PDF generation is fully functional
- Cookie management is fully functional
- WebSocket support is fully functional
- Redis integration is optional and configurable
- Security hardening is complete (SSRF, rate limiting, logging)
- Session management is production-ready
- Desktop mode requires external setup (noVNC/Guacamole)

**Performance Characteristics:**
- **Fast Mode**: Very fast, moderate compatibility
- **Reader Mode**: Fast, high compatibility for articles
- **Text-only**: Very fast, very high compatibility
- **Live Mode**: Interactive but resource-intensive (max 10 concurrent sessions)
- **Snapshot Mode**: One-time capture, efficient replay

**Before Production Use:**
- Configure Redis for distributed sessions (recommended)
- Set up NGINX reverse proxy with SSL
- Configure environment variables
- Set up monitoring and alerting
- Review and adjust resource limits
- Test all security features
- Configure backup strategy
- Set up log rotation

**Resource Requirements:**
- **Minimum**: 2GB RAM, 2 CPU cores
- **Recommended**: 4GB RAM, 4 CPU cores
- **Live Mode**: Additional 100-200MB RAM per session
- **Playwright**: ~200MB disk space for browser binaries

---

## Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mufthakherul/Headless-web.io)

**Note:** Vercel deployment has limitations for WebSocket and Playwright features. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

### Alternative Deployment Options

- **Docker**: `docker build -t headless-web . && docker run -p 3000:3000 headless-web`
- **Traditional Server**: See [DEPLOYMENT.md](DEPLOYMENT.md) for PM2, systemd, and cloud deployment guides
- **AWS/GCP/Azure**: Full feature support with proper VM configuration

For comprehensive deployment instructions, including Vercel, Docker, PM2, and cloud platforms, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## API Documentation

Once deployed, visit `/api/docs` for comprehensive API documentation with examples for all endpoints.

Key endpoints:
- `GET /` - Main UI
- `GET /api/docs` - API documentation
- `GET /health` - Health check
- `GET /stats` - Server statistics
- `GET /metrics` - Request metrics
- `GET /go?url=<url>&mode=<mode>` - Start session

---
