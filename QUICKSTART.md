# 🚀 Quick Start Guide - Headless-web v3.0

## 60-Second Setup

### 1. Install & Configure (2 minutes)
```bash
# Install all dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your details
# Most important:
# - ADMIN_EMAIL=admin@headless-web.io
# - ADMIN_PASSWORD=your_secure_password
# - JWT_SECRET=(run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
```

### 2. Start Server
```bash
node server.js
```

You should see:
```
✅ Headless-web server started on port 3000
```

### 3. Access the App
Open http://localhost:3000

---

## 🎯 First Time Usage

### Visit Main Page
- Click **🔐 Login** button in top right

### Create Account
- Click **Register** tab
- Enter username, email, password
- Click **Create Account**
- Auto-logs you in!

### Use Features

#### 🤖 AI Chat
- Click **AI Chat** (if logged in)
- Select AI provider (Gemini, GPT, Grok, etc.)
- Pick model
- Start chatting!

#### ⬇️ Download Media
- Click **Download** (if logged in)
- Paste YouTube URL or image URL
- Click **Start Download**
- View download history

#### 🕷️ Scrape Website
- Click **Download** tab → **Web Scraper**
- Enter website URL
- Select what to extract
- View results

---

## 🔑 Admin Login (No Database Needed)

Even without PostgreSQL:

1. Go to http://localhost:3000/login.html
2. Email: `admin@headless-web.io`
3. Password: (from your ADMIN_PASSWORD env var)
4. Click **Login**

✅ Works even when database is down!

---

## 🤖 Setup AI Providers (Optional)

To use AI features, you need at least ONE API key:

### Google Gemini
1. Visit https://aistudio.google.com/
2. Click "Get API Key"
3. Create new API key
4. Add to `.env`: `GEMINI_API_KEY=your_key`

### OpenAI GPT
1. Visit https://platform.openai.com/
2. Create account
3. Go to API keys section
4. Create new key
5. Add to `.env`: `OPENAI_API_KEY=your_key`

### Other Providers
- **Grok**: https://x.ai/
- **DeepSeek**: https://platform.deepseek.com/
- **Copilot**: https://github.com/settings/copilot

---

## 📦 API Examples

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@headless-web.io",
    "password":"your_admin_password"
  }'
```

### Chat with AI
```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"gemini",
    "message":"Hello!",
    "model":"gemini-pro"
  }'
```

### Scrape Website
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### Download YouTube
```bash
curl -X POST http://localhost:3000/download/youtube \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url":"https://www.youtube.com/watch?v=...",
    "format":"video",
    "quality":"highest"
  }'
```

---

## 🗄️ Setup PostgreSQL (Optional)

For persistent user data:

### Windows
```powershell
# Install PostgreSQL
choco install postgresql

# Create database
createdb headless_web

# Set env variables
# DB_HOST=localhost
# DB_USER=postgres
# DB_PASSWORD=your_postgres_password
# DB_NAME=headless_web
```

### Linux
```bash
sudo apt install postgresql
createdb headless_web
```

Tables created automatically:
- `users` - User accounts
- `chat_history` - AI chat messages
- `download_history` - Downloaded files
- `user_sessions` - Active sessions
- `api_keys` - Stored API keys

---

## 🔐 Authentication Flow

```
User Registration:
  1. Visit /login.html
  2. Enter email, password, username
  3. Click "Create Account"
  4. Account created in PostgreSQL
  5. Auto-logged in with JWT token
  6. Token stored in localStorage
  7. Redirected to /

User Login:
  1. Visit /login.html
  2. Enter email, password
  3. System checks PostgreSQL
  4. If DB down, tries admin fallback
  5. Returns JWT token
  6. Token stored in cookie + localStorage
  7. User can access AI Chat & Downloader

Guest User:
  1. Click "Guest User"
  2. Can use Browse & Scraper
  3. Cannot access AI Chat or Download history
  4. No authentication needed
```

---

## 🎨 Dark Mode

- Click 🌙 (moon icon) in top right
- Toggles dark/light theme
- Saves preference in localStorage

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Submit form |
| `Shift+Enter` | Newline in textarea |
| `Ctrl+T` | Clear history |
| `Ctrl+K` | Show keyboard help |
| `Ctrl+Shift+H` | Focus URL input |

---

## 📊 Monitoring

View server logs:
```bash
tail -f server_output.txt
```

Check active sessions:
```bash
# Via database
SELECT * FROM user_sessions WHERE expires_at > NOW();

# Or via API
GET /auth/check
```

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check syntax
node -c server.js

# Check port is free
netstat -ano | findstr :3000

# Or use different port
PORT=3001 node server.js
```

### Database connection failed
✅ **This is normal!** Server continues in admin-only mode
- Admin can still login via ADMIN_EMAIL/ADMIN_PASSWORD
- All features work except user data persistence

### Can't login
- Check email/password correct
- Try admin credentials (ADMIN_EMAIL/ADMIN_PASSWORD)
- Check .env file has JWT_SECRET set

### AI Chat not working
- Check API key is in .env
- Verify provider is available: `GET /ai/providers`
- Check API key is valid/has quota

### Download fails
- Check URL is valid
- YouTube video may be restricted
- Check file size not too large

---

## 🚀 Deploy to Cloud

### Render.com
```bash
# Push to GitHub
git push origin main

# Create new Web Service on Render
# - Connect GitHub repo
# - Add PostgreSQL addon
# - Set environment variables
# - Deploy!
```

### Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

**Note:** Must use external PostgreSQL (Neon, Supabase)

---

## 📖 Full Documentation

See [NEW_FEATURES_v3.0.md](NEW_FEATURES_v3.0.md) for:
- Complete API reference
- Database schema
- All endpoint documentation
- Code examples

See [IMPLEMENTATION_COMPLETE_v3.md](IMPLEMENTATION_COMPLETE_v3.md) for:
- Architecture overview
- File structure
- Security features
- Testing guides

---

## ✅ Checklist

- [ ] `npm install` - Install dependencies
- [ ] `.env` file created - With ADMIN_PASSWORD and JWT_SECRET
- [ ] `node server.js` - Server runs without errors
- [ ] http://localhost:3000 - Page loads
- [ ] /login.html - Login page accessible
- [ ] Admin login works - With ADMIN_EMAIL/ADMIN_PASSWORD
- [ ] AI Chat loads - (if API key configured)
- [ ] Downloader loads - (if logged in)
- [ ] Theme toggle works - Light/dark mode
- [ ] Logout works - Returns to login page

---

## 🎉 You're Ready!

```
    ✨ Welcome to Headless-web v3.0 ✨
    
    Features:
    ✅ 7 Browsing Modes (Fast, Reader, Text, Live, Snapshot, PDF, Desktop)
    ✅ 🔐 Authentication (PostgreSQL + Admin Fallback)
    ✅ 🤖 AI Chat (Gemini, GPT, Grok, DeepSeek, Copilot)
    ✅ 🕷️  Web Scraper (Extract content, images, links)
    ✅ ⬇️  Media Downloader (YouTube, images, social media)
    
    Server: http://localhost:3000
    Status: Ready to use! 🚀
```

---

**Having issues?** Check the logs:
```bash
# Show last 50 lines
Get-Content server_output.txt -Tail 50

# Monitor in real-time
Get-Content -Wait -Path server_output.txt
```

Happy browsing! 🌐
