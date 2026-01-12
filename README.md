# Headless-web

Documentation for a web-based "headless web" / browsing gateway that can provide multiple compatibility modes (proxy rewrite, reader/text, snapshots, live headless browser rendering, and full remote desktop browsing).

## Docs

- **Internal Modes (10):** `docs/internal-modes.md`
- **Public User Modes (7):** `docs/public-user-modes.md`
- **Fallback System & Mode Management:** `docs/fallback-and-mode-management.md`

## Quick Concept

Users interact with **7 public modes** in the UI. Behind the scenes, a controller uses **10 internal techniques** to implement those modes and provide fallbacks.

### Public modes (UI)
1. Fast (Proxy)
2. Fast+ (Proxy Optimized)
3. Reader
4. Text-only
5. Snapshot (View-only)
6. Live (Interactive)
7. Full Desktop (Maximum)

### Internal techniques
See `docs/internal-modes.md` for full details.

## Notes

- A website cannot act as a device-wide VPN. It can only proxy/broker traffic inside this service.
- Security is critical (SSRF protection, isolation, rate limiting). See `docs/fallback-and-mode-management.md`.
