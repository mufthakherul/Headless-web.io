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

- `GET /` — UI (address bar + mode selector)
- `GET /go?url=...&mode=fast` — start a session / tab
- `GET /proxy?sid=...&url=...` — proxy rewrite fetch
- `GET /reader?sid=...&url=...` — reader extraction
- `GET /text?sid=...&url=...` — text-only rendering
- `POST /live/start` — start Playwright session
- `GET /live/frame?sid=...` — get frame image/tiles
- `POST /live/input?sid=...` — send input events
- `POST /snapshot/create` — create snapshot
- `GET /snapshot/view?sid=...` — view snapshot
- `GET /desktop?sid=...` — open Guacamole/noVNC session

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
