# Render Deployment - Troubleshooting Guide

## Current Status: Deployed ✅
**URL**: https://headless-web-mufthakherul.onrender.com

---

## ✅ What's Working
- Server is running (Node 20)
- Health check: `/health`
- API endpoints responding
- Basic proxy mode should work
- Reader mode extraction should work
- Text-only mode should work

---

## 🔧 Known Issues & Solutions

### 1. **Playwright Features (Live, Snapshot, PDF)**

**Issue**: These require Chromium browser which may fail on Render free tier due to:
- Memory limits (512 MB on free tier)
- Chromium process overhead
- Container restrictions

**Solution**:
```bash
# In Render Dashboard → Environment
# Verify these are set:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**If still failing**:
1. Check logs in Render dashboard
2. Look for "Playwright" or "chromium" errors
3. May need to upgrade to Starter plan ($7/mo) for 512-1024 MB RAM

**Test endpoints**:
```bash
# Live mode
curl -X POST https://headless-web-mufthakherul.onrender.com/live/start \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","sessionId":"test_123"}'

# Snapshot
curl -X POST https://headless-web-mufthakherul.onrender.com/snapshot/create \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# PDF
curl "https://headless-web-mufthakherul.onrender.com/pdf/generate?url=https://example.com"
```

---

### 2. **Reader Mode "Not Showing as Expected"**

**Possible causes**:
- CORS blocking frontend requests
- Target website blocking scraping
- Invalid URL format
- Readability parser can't extract content

**Debug steps**:
```bash
# Test directly via API
curl "https://headless-web-mufthakherul.onrender.com/go?url=https://example.com&mode=reader"
# Should return JSON with sessionId

# Then test reader endpoint
curl "https://headless-web-mufthakherul.onrender.com/reader?sid=SESSION_ID&url=https://example.com"
# Should return HTML
```

**Common fixes**:
1. **CORS**: Verify in Render dashboard Environment:
   ```
   CORS_ORIGIN=https://headless-web-mufthakherul.onrender.com
   ```
   Or temporarily use `CORS_ORIGIN=*` for testing

2. **Test with known-good URLs**:
   - https://example.com (basic HTML)
   - https://en.wikipedia.org/wiki/Web_browser (article)
   - Avoid sites with heavy JavaScript (won't work without Live mode)

---

### 3. **Text-Only Mode "Not Showing as Expected"**

**Similar issues as Reader Mode**

**Test**:
```bash
curl "https://headless-web-mufthakherul.onrender.com/text?sid=SESSION_ID&url=https://example.com"
```

**What to expect**:
- Monospace layout
- Paragraphs, headings, lists
- Link list at bottom
- Minimal styling

**If content is empty**:
- Target page might be JavaScript-heavy (try simpler sites)
- Check Render logs for errors

---

### 4. **Full Desktop Mode**

**Status**: ❌ Not implemented (placeholder only)

This feature requires:
- Docker container with GUI
- VNC/noVNC setup
- Much more resources

**Message expected**:
```json
{
  "mode": "desktop",
  "message": "Remote desktop mode not yet implemented",
  "todo": [...]
}
```

---

## 🔍 Debugging Steps

### Step 1: Check Health
```bash
curl https://headless-web-mufthakherul.onrender.com/health
```
Should return:
```json
{
  "status": "ok",
  "environment": "standalone",
  "features": {
    "proxy": true,
    "reader": true,
    "textOnly": true,
    "live": true,    // false if DISABLE_PLAYWRIGHT=true
    "snapshot": true,
    "pdf": true
  }
}
```

### Step 2: Check Stats
```bash
curl https://headless-web-mufthakherul.onrender.com/stats
```
Look for:
- `environment: "standalone"` or `"serverless"`
- `liveMode.enabled` - should be true
- Any error messages

### Step 3: Check Render Logs
1. Go to Render dashboard
2. Select your service
3. Click "Logs"
4. Look for:
   - Startup errors
   - Playwright launch errors
   - Request errors
   - Memory warnings

### Step 4: Test from Browser Console
Open browser console on your Render URL and test:
```javascript
// Test session creation
fetch('/go?url=https://example.com&mode=fast')
  .then(r => r.json())
  .then(console.log)

// Test stats
fetch('/stats')
  .then(r => r.json())
  .then(console.log)
```

---

## 🚀 Quick Fixes

### If Playwright features aren't working:

**Option A: Upgrade Render plan**
- Free tier: 512 MB RAM (tight for Playwright)
- Starter: $7/mo, 512-1024 MB (better)

**Option B: Disable Playwright features**
Add to Render environment:
```
DISABLE_PLAYWRIGHT=true
```
This will disable Live/Snapshot/PDF but keep Proxy/Reader/Text working.

---

### If Reader/Text modes show blank:

**1. Check CORS**:
```bash
# In Render dashboard, set:
CORS_ORIGIN=*
```

**2. Try different URLs**:
- https://example.com (simple)
- https://httpbin.org/html (test HTML)
- https://en.wikipedia.org/wiki/Main_Page (Wikipedia)

**3. Check frontend**:
- Open browser DevTools
- Check Network tab for failed requests
- Check Console for JavaScript errors

---

## 📊 Expected Behavior by Mode

| Mode | What Should Happen |
|------|-------------------|
| **Fast (Proxy)** | HTML rewritten, resources proxied through server |
| **Reader** | Clean article view, Georgia font, white background |
| **Text-only** | Monospace text, paragraphs + links list |
| **Live** | Real-time browser screenshots (needs Playwright) |
| **Snapshot** | One-time page capture (needs Playwright) |
| **PDF** | Download PDF of article (needs Playwright) |
| **Desktop** | ❌ Not implemented yet |

---

## 🎯 Next Steps

1. **Check Render logs** - identify specific errors
2. **Test each mode** - use curl commands above
3. **Verify env vars** - CORS, Playwright paths
4. **Consider upgrade** - if Playwright features needed
5. **Report specific errors** - share logs for detailed help

---

## 💡 Tips

- **Render free tier sleeps after 15 min** - first request will be slow
- **Cold start time**: ~20-40 seconds
- **Memory limits**: May need paid tier for Playwright
- **CORS**: Set to `*` for testing, then restrict to your domain
- **Logs**: Essential for debugging - check them first

---

## 📞 Need Help?

Share:
1. Specific error message from Render logs
2. Which mode isn't working
3. Example URL you're testing
4. Browser console errors (if applicable)
