# Headless-web Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Browser                              │
│                        (Desktop/Mobile/Chromebook)                       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          Express.js Server                               │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                    Security Middleware Layer                        │ │
│ │ ┌─────────────────┐ ┌──────────────────┐ ┌─────────────────────┐  │ │
│ │ │ Rate Limiting   │ │ SSRF Protection  │ │ Session Validation  │  │ │
│ │ │                 │ │                  │ │                     │  │ │
│ │ │ • 60 req/min    │ │ • Block Private  │ │ • Crypto Secure    │  │ │
│ │ │ • Per IP limit  │ │ • Block Metadata │ │ • 256-bit IDs      │  │ │
│ │ │ • Auto cleanup  │ │ • DNS Validation │ │ • Timeout Handling │  │ │
│ │ └─────────────────┘ └──────────────────┘ └─────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
│ ┌─────────────────────────────────▼───────────────────────────────────┐ │
│ │                        Route Handlers                                │ │
│ │                                                                      │ │
│ │  /go              → Create Session (with SSRF + Rate Limit)         │ │
│ │  /proxy           → Fast Mode (Proxy + Rewrite) [TODO]              │ │
│ │  /reader          → Reader Mode (Content Extraction) [TODO]         │ │
│ │  /text            → Text-only Mode [TODO]                           │ │
│ │  /live/start      → Live Mode (Playwright) [TODO]                   │ │
│ │  /live/frame      → Frame Capture [TODO]                            │ │
│ │  /live/input      → Input Forwarding [TODO]                         │ │
│ │  /snapshot/*      → Snapshot Mode [TODO]                            │ │
│ │  /desktop         → Full Desktop Mode [TODO]                        │ │
│ │  /health          → Health Check ✅                                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐     ┌──────────▼──────────┐    ┌───────▼────────────┐
│  HTTP Fetcher  │     │  Browser Automation │    │  Content Extractor │
│    [PLANNED]   │     │     [PLANNED]       │    │     [PLANNED]      │
│                │     │                     │    │                    │
│ • Fetch URLs   │     │ • Playwright        │    │ • Readability.js   │
│ • HTML Rewrite │     │ • Puppeteer         │    │ • Text-only        │
│ • CSS Rewrite  │     │ • Screenshots       │    │ • Article Extract  │
│ • Cookie Map   │     │ • Input Events      │    │                    │
└────────────────┘     └─────────────────────┘    └────────────────────┘
```

## Request Flow

### 1. Session Creation (/go)

```
Client → Rate Limiter → SSRF Validator → Session Generator → Response
         (60/min)       (DNS Check)      (Crypto Random)    (Session ID)
```

### 2. Proxy Mode (/proxy) [PLANNED]

```
Client → Rate Limiter → Session Validator → SSRF Check → HTTP Fetch
                                                             ↓
Client ← HTML/CSS Rewriter ← Response Parser ← HTTP Response
```

### 3. Live Mode (/live/start) [PLANNED]

```
Client → Rate Limiter → Session Validator → SSRF Check → Playwright Launch
                                                             ↓
Client ← Frame Stream ← Screenshot Capture ← Browser Rendering
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network (Rate Limiting)                            │
│ • Blocks excessive requests                                  │
│ • Prevents DoS attacks                                       │
│ • Per-IP tracking                                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Input Validation (SSRF Protection)                 │
│ • URL format validation                                      │
│ • Protocol restriction (HTTP/HTTPS only)                     │
│ • Private IP blocking                                        │
│ • DNS resolution check                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Session Security                                    │
│ • Cryptographically secure IDs                              │
│ • Session validation on all routes                          │
│ • Timeout handling                                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Application Logic (Future)                         │
│ • Content filtering                                          │
│ • Resource limits                                            │
│ • Browser isolation                                          │
└─────────────────────────────────────────────────────────────┘
```

## Mode Selection Flow

```
         ┌─────────────┐
         │ User Input  │
         │ URL + Mode  │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │  Auto Mode? │
         └──┬────────┬─┘
            │        │
        No  │        │ Yes
            │        │
    ┌───────▼──┐     │
    │ Selected │     │
    │   Mode   │     │
    └────┬─────┘     │
         │           │
         │     ┌─────▼──────────┐
         │     │ Mode Controller│
         │     │  (Intelligent  │
         │     │   Fallback)    │
         │     └─────┬──────────┘
         │           │
    ┌────▼───────────▼───┐
    │   Route to Mode    │
    └────┬───────────────┘
         │
    ┌────▼────────────────────────────────┐
    │                                     │
┌───▼────┐  ┌────────┐  ┌──────┐  ┌──────────┐
│  Fast  │  │ Reader │  │ Live │  │ Desktop  │
│  Mode  │  │  Mode  │  │ Mode │  │   Mode   │
└────────┘  └────────┘  └──────┘  └──────────┘
```

## Data Flow: Fast Mode (Planned)

```
1. Client Request
   ↓
2. Security Validation (SSRF + Rate Limit)
   ↓
3. Server-side HTTP Fetch
   ↓
4. HTML/CSS Parsing
   ↓
5. URL Rewriting
   • href="/path" → href="/proxy?sid=xxx&url=..."
   • src="/asset" → src="/proxy?sid=xxx&url=..."
   • url(bg.jpg) → url(/proxy?sid=xxx&url=...)
   ↓
6. Cookie Mapping (target → session storage)
   ↓
7. Modified Response to Client
   ↓
8. Client Renders Through Proxy
```

## Deployment Architecture

```
┌────────────────────────────────────────────────┐
│              GitHub Repository                  │
│         (mufthakherul/Headless-web.io)         │
└──────────────────┬─────────────────────────────┘
                   │
                   │ push to main
                   │
         ┌─────────▼────────────┐
         │   GitHub Actions     │
         │  (CI/CD Pipeline)    │
         │                      │
         │  1. Checkout code    │
         │  2. Setup Node.js    │
         │  3. npm ci           │
         │  4. Build artifacts  │
         │  5. Upload to Pages  │
         └─────────┬────────────┘
                   │
                   │ deploy
                   │
         ┌─────────▼────────────┐
         │   GitHub Pages       │
         │  (Static Hosting)    │
         │                      │
         │  URL: https://       │
         │  mufthakherul.       │
         │  github.io/          │
         │  Headless-web.io/    │
         └──────────────────────┘
```

## Future Production Architecture

```
                    ┌─────────────┐
                    │   Clients   │
                    └──────┬──────┘
                           │
                    ┌──────▼───────┐
                    │ Load Balancer│
                    │   (NGINX)    │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼────┐       ┌────▼────┐
   │ Node.js │       │ Node.js  │       │ Node.js │
   │Instance │       │ Instance │       │ Instance│
   │    1    │       │     2    │       │    3    │
   └────┬────┘       └─────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │
                    │  (Sessions & │
                    │ Rate Limits) │
                    └──────────────┘
```

## Component Responsibilities

### Current (Implemented)
- ✅ Express Server - HTTP request handling
- ✅ Security Module - SSRF protection and validation
- ✅ Rate Limiter - Abuse prevention
- ✅ Session Manager - Secure session handling
- ✅ Static Frontend - User interface

### Phase 2 (Next)
- ⏳ HTTP Fetcher - Server-side requests
- ⏳ HTML/CSS Rewriter - Content modification
- ⏳ Cookie Mapper - Session isolation

### Phase 3 (Future)
- ⏳ Content Extractor - Readability integration
- ⏳ Browser Automation - Playwright/Puppeteer
- ⏳ Desktop Streamer - Guacamole/noVNC

### Production (Later)
- ⏳ Redis Integration - Distributed state
- ⏳ Logging System - Monitoring and debugging
- ⏳ Metrics Collection - Performance tracking
- ⏳ Container Orchestration - Scalability

---

**Architecture Status:** Foundation Complete ✅
**Security:** Hardened ✅
**Next Phase:** Proxy Implementation ⏳
