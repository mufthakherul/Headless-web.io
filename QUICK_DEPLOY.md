# Quick Deployment Guide

## 🎯 Recommended: Deploy to Vercel (2 minutes)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Fix: Add serverless compatibility for Vercel deployment"
git push origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository: `mufthakherul/Headless-web.io`
4. Click "Deploy" (no configuration needed - `vercel.json` handles everything)

### Step 3: Test Your Deployment
Visit: `https://your-app-name.vercel.app`

**Available features:**
- ✅ Fast Mode (Proxy)
- ✅ Reader Mode
- ✅ Text-only Mode

**Unavailable features** (need Docker):
- ❌ Live Mode (requires Playwright)
- ❌ Snapshots (requires Playwright)
- ❌ PDF Generation (requires Playwright)

---

## 🐳 For Full Features: Deploy with Docker

### Option A: Deploy to Railway (Easiest)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `mufthakherul/Headless-web.io`
4. Railway will automatically detect Dockerfile and deploy
5. All features will work! ✅

### Option B: Deploy to Render

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Select "Docker" as runtime
5. Deploy

### Option C: Run Locally with Docker

```bash
# Build
docker build -t headless-web .

# Run
docker run -p 3000:3000 headless-web

# Visit
http://localhost:3000
```

---

## 🔧 What Was Fixed

### Vercel Issues:
- ✅ Added serverless compatibility
- ✅ Disabled Playwright features (not supported)
- ✅ Increased memory limits
- ✅ Better error handling

### GitHub Pages Issues:
- ✅ Updated workflow to only deploy static files
- ✅ Added helpful error messages
- ✅ Note: GitHub Pages cannot run backend APIs

---

## 📊 Testing Your Deployment

### Health Check:
```bash
curl https://your-app.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "environment": "serverless",
  "features": {
    "proxy": true,
    "reader": true,
    "textOnly": true,
    "live": false,
    "snapshot": false,
    "pdf": false
  }
}
```

### Stats Check:
```bash
curl https://your-app.vercel.app/stats
```

Should return server metrics and show environment type.

---

## 💡 Quick Tips

1. **Vercel is perfect** for Proxy, Reader, and Text modes
2. **Use Docker** (Railway/Render) if you need Live mode or PDF generation
3. **GitHub Pages** won't work for the backend - it's static hosting only

---

## 🆘 Still Having Issues?

1. Check Vercel logs: `vercel logs`
2. Verify environment variables are set
3. Make sure all changes are pushed to GitHub
4. Redeploy if needed

**Most common fix**: Just redeploy after pushing these changes!
