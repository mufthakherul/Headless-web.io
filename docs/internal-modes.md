# Internal Modes (10)

This repository defines **10 internal modes**. These are implementation strategies used by the controller to load and present third‑party websites through this service.

> Note: Some internal modes are techniques that can be used together (for example, a proxy rewrite can also apply transcoding). The controller can chain techniques as needed.

## Internal Mode 1 — Remote Browser via Guacamole/noVNC (Full Desktop)
**Purpose:** Provide a full remote desktop session where a real GUI browser runs on the server.

**How it works (high level):**
- Start a per-session container/VM with a lightweight desktop environment and Chromium.
- Stream the desktop to the client using VNC/RDP over a web client (noVNC) or Guacamole.

**Pros:**
- Highest website compatibility
- Supports downloads and complex user flows more easily

**Cons:**
- Highest cost per user (CPU/RAM)
- Requires strong isolation and abuse controls

## Internal Mode 2 — Server-side Fetch & Rewrite (HTTP Proxy + Rewriter)
**Purpose:** Load a site server-side and rewrite content so the client loads everything through this service.

**Typical rewrites:**
- HTML: rewrite `href`, `src`, `action`
- CSS: rewrite `url(...)`
- Redirects: normalize and re-route
- Cookies: map target cookies to service-managed storage

**Pros:**
- Fast and cheap compared to full remote browser

**Cons:**
- Breaks on many modern sites (CSP, heavy JS apps, bot checks)

## Internal Mode 3 — Rendering-as-Image (Live) via Playwright/Puppeteer
**Purpose:** Run a real Chromium on the server and send rendered frames to the client.

**Implementation patterns:**
- Periodic screenshots (simplest)
- Tiled screenshots (better bandwidth)
- CDP screencast (more "live")
- Input forwarding (mouse/keyboard) to the server browser

**Pros:**
- High compatibility with modern sites

**Cons:**
- Interactive streaming is complex
- Expensive compared to proxy

## Internal Mode 4 — Reader Mode / Content Extraction
**Purpose:** Extract the main content (article/body) and display it in a clean template.

**How it works:**
- Parse HTML and run a readability algorithm to locate the primary content.
- Strip most scripts/styles.

**Pros:**
- Great for blogs/news/docs
- Very cheap

**Cons:**
- Not suitable for web apps or complex interactions

## Internal Mode 5 — Text-only Mode
**Purpose:** Provide an "always works" minimal representation.

**Output:**
- Plain text HTML
- Links as a list
- Very basic forms when possible

**Pros:**
- Maximum compatibility
- Lowest bandwidth

**Cons:**
- Poor visual fidelity and interaction

## Internal Mode 6 — Transcoding / Optimization Proxy
**Purpose:** Reduce bandwidth and improve compatibility for constrained clients.

**Transformations (examples):**
- Image resize/re-encode (JPEG/PNG)
- Strip or defer scripts
- Block trackers/ads
- Force gzip (avoid Brotli-only)
- Cache aggressively

**Pros:**
- Improves performance and sometimes prevents needing a remote browser

**Cons:**
- Adds CPU cost on the server
- Risk of breaking pages if too aggressive

## Internal Mode 7 — Selective Remote Rendering (Hybrid)
**Purpose:** Use remote rendering only where needed.

**Examples:**
- Start in proxy rewrite; if a page is JS-heavy, open that page in Playwright.
- Render above-the-fold as an image while proxying the rest.

**Pros:**
- Reduces cost while improving success rate

**Cons:**
- More complex controller logic

## Internal Mode 8 — Snapshot / Replay (HAR-based or Archived Resources)
**Purpose:** Load once using a real browser, then replay a snapshot.

**How it works:**
- Use Playwright to load the page and collect rendered HTML + network resources (HAR) or a custom archive.
- Serve the captured version without keeping a live browser session.

**Pros:**
- Cheaper than live remote browsing
- Good for view-only content

**Cons:**
- Not truly interactive
- Logins and dynamic content are hard

## Internal Mode 9 — Existing Proxy Engine Integration
**Purpose:** Use a mature proxy/rewriter engine rather than building everything from scratch.

**What it provides:**
- Better URL rewriting correctness
- More edge-case handling
- Potential plugin system

**Pros:**
- Faster development
- More reliability

**Cons:**
- Integration complexity
- Must keep security tight

## Internal Mode 10 — On-device Embedded Browser Engine (App-only)
**Purpose:** Ship an app that embeds its own browser engine (e.g., WebView/GeckoView).

**Important:** This is **not feasible** for a normal website running in Chrome on a Chromebook. It only applies if this project later ships as an Android/desktop application.

**Pros:**
- Full control over client rendering engine

**Cons:**
- Requires building/maintaining an app
- Not applicable to web-only deployment

---

## Security baseline (applies to multiple modes)
Regardless of mode, the service should implement:
- SSRF protections (block private IP ranges, metadata endpoints, localhost)
- Domain allow/deny lists
- Rate limiting and abuse detection
- Strict session isolation
- Safe handling of credentials and cookies
