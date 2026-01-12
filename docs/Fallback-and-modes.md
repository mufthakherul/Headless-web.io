# Fallback System & Mode Management
## Mapping between 7 Public Modes and 10 Internal Modes

This project separates:
- **Public modes (7):** what the user selects in the UI.
- **Internal modes (10):** implementation strategies used by the controller.

The controller can either:
1) **Respect a locked user choice** (manual mode), or
2) **Auto-upgrade** (recommended mode) to keep the experience working.

---

## 1. Mode Mapping Table

| Public Mode | Primary Goal | Typical Internal Modes Used |
|---|---|---|
| Fast (Proxy) | Lowest cost, quick load | 2 (+ light 6) |
| Fast+ (Proxy Optimized) | Better performance/compatibility | 2 + 6 + (9) |
| Reader | Extract main article content | 4 |
| Text-only | Always-works minimal view | 5 |
| Snapshot (View-only) | Render once, replay | 8 (often produced via 3) |
| Live (Interactive) | Real browser session streamed | 3 (+ 7 optionally) |
| Full Desktop (Maximum) | Full GUI browser remote desktop | 1 |

**Notes**
- Internal Mode 9 (existing proxy engine) is an implementation choice that strengthens Fast/Fast+.
- Internal Mode 7 (selective remote rendering) is a strategy mainly used to reduce cost in Live mode or to create smart hybrid flows.
- Internal Mode 10 (on-device embedded engine) is **app-only** and not applicable to the web UI; keep it as future roadmap.

---

## 2. Manual Mode (User-Locked) Behavior

When a user manually selects a public mode, the controller should:
- Keep the user in that public mode.
- Only apply “safe” internal fallbacks **within the same family**.

### Example: user selects Fast+
Allowed internal fallbacks:
- Proxy rewrite variations (rewrite strategy changes)
- More aggressive optimization (image transcoding, script stripping)
- Switch to a different proxy engine implementation

Not automatically allowed:
- Jumping to Live or Full Desktop without user confirmation

**Reason:** avoid surprising the user (“I chose Fast but it turned into a remote session”).

---

## 3. Auto Mode (Recommended) Behavior

In Auto mode, the controller is allowed to escalate across public modes.

### Suggested escalation ladder
1. Fast (Proxy)
2. Fast+ (Proxy Optimized)
3. Reader (if detected as article-like)
4. Text-only (if user just needs access)
5. Snapshot (View-only) for JS-heavy pages where interaction is not required
6. Live (Interactive) when user needs full interaction
7. Full Desktop (Maximum) as last resort

---

## 4. Fallback Triggers (Practical Rules)

### Triggers to move from Fast → Fast+
- Page is heavy (large images, many requests)
- Slow on device/network
- User preference (data saver)

### Triggers to move from Proxy family → Reader/Text-only
- Proxy rewrite produces unusable layout
- Page is primarily an article and user goal is reading
- Too many subresource failures

### Triggers to move to Snapshot
- User wants view-only result
- JS-heavy site, but live session cost should be avoided
- Need to capture a stable “moment in time”

### Triggers to move to Live / Full Desktop
- JS app shell (minimal HTML, requires client JS)
- Login flows break in proxy mode
- Bot checks/captchas block proxying
- Need complex interaction

---

## 5. Session & State Management Guidelines

### Identity & session model
- Use a **session id** per user “tab”.
- Store mode choice + site URL + cookies/session mapping.
- In Live/Desktop modes, isolate each session in its own browser context or container.

### Cookie handling
- Proxy modes: map target cookies to your service domain storage; never leak cookies across sessions.
- Live/Desktop: cookies live inside the server-side browser context/container.

### Mode switching rules
- When switching Proxy → Live, do **not** automatically carry user credentials unless explicitly designed and secured.
- Provide a clear “Switch to Live” / “Switch to Desktop” action.

---

## 6. Security Requirements (All Modes)

Minimum baseline:
- SSRF protections (block private ranges, localhost, metadata endpoints like `169.254.169.254`)
- Rate limiting per user/session
- Domain allowlist/denylist (start with allowlist for MVP)
- Logging & abuse monitoring
- Strong isolation for Live/Desktop sessions

---

## 7. Implementation Notes

- Keep public mode names simple and user-friendly.
- Keep internal modes flexible so multiple techniques can be chained.
- Treat Mode 10 (embedded engine) as a future non-web deliverable.

---
