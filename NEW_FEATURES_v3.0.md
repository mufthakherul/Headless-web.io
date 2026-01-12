# 🚀 Headless-web.io v3.0 - NEW FEATURES GUIDE

## 🎉 Major Updates in v3.0

This release adds **three major new feature categories** beyond the original roadmap:

1. **🔐 Authentication System** - PostgreSQL-based login with admin fallback
2. **🤖 AI Chat Integration** - Multi-provider AI chat (5 providers)
3. **🕷️ Web Scraper & Media Downloader** - Extract content and download media

---

## 🔐 Authentication System

### Features
- **PostgreSQL Database**: Secure user management with hashed passwords (bcrypt)
- **Admin Fallback**: Admin can login via environment variables even when database is down
- **JWT Tokens**: 7-day expiring tokens with secure HTTP-only cookies
- **Session Management**: Dual storage (PostgreSQL + in-memory) for reliability
- **User Statistics**: Track chat messages and downloads per user

### Setup

#### 1. Install PostgreSQL
```bash
# Windows (using Chocolatey)
choco install postgresql

# Or download from https://www.postgresql.org/download/

# Create database
psql -U postgres
CREATE DATABASE headless_web;
\q
```

#### 2. Configure Environment Variables
```env
# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=headless_web
DB_USER=postgres
DB_PASSWORD=your_password

# Admin Credentials (works even without database)
ADMIN_EMAIL=admin@headless-web.io
ADMIN_PASSWORD=change_this_secure_password

# JWT Configuration
JWT_SECRET=your_64_character_random_hex_string
JWT_EXPIRES_IN=7d
```

#### 3. Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### API Endpoints

#### Register New User
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "johndoe"
}
```

#### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

# Response:
{
  "success": true,
  "token": "jwt_token_here",
  "sessionId": "session_id",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Check Authentication
```bash
GET /auth/check
Authorization: Bearer <token>
# or use cookies automatically
```

#### Logout
```bash
POST /auth/logout
Authorization: Bearer <token>
```

#### Get User Statistics
```bash
GET /auth/stats
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "stats": {
    "chatCount": 25,
    "downloadCount": 10,
    "totalDownloadedBytes": 1024000
  }
}
```

---

## 🤖 AI Chat Integration

### Supported Providers

1. **Google Gemini** (`gemini`)
   - Models: `gemini-pro`, `gemini-pro-vision`
   - Best for: General conversations, vision tasks

2. **OpenAI GPT** (`openai`)
   - Models: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
   - Best for: Advanced reasoning, coding

3. **xAI Grok** (`grok`)
   - Models: `grok-beta`
   - Best for: Real-time information, humor

4. **DeepSeek** (`deepseek`)
   - Models: `deepseek-chat`, `deepseek-coder`
   - Best for: Coding, technical tasks

5. **GitHub Copilot** (`copilot`)
   - Models: `copilot-chat`
   - Best for: Code completion, development

### Setup

#### 1. Get API Keys

- **Gemini**: https://aistudio.google.com/
- **OpenAI**: https://platform.openai.com/
- **Grok**: https://x.ai/
- **DeepSeek**: https://platform.deepseek.com/
- **Copilot**: https://github.com/settings/copilot

#### 2. Configure Environment
```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GROK_API_KEY=your_grok_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
COPILOT_API_KEY=your_github_copilot_api_key_here
```

### API Endpoints

#### List Available Providers
```bash
GET /ai/providers

# Response:
{
  "success": true,
  "providers": [
    {
      "name": "gemini",
      "available": true,
      "models": ["gemini-pro", "gemini-pro-vision"]
    },
    {
      "name": "openai",
      "available": true,
      "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"]
    }
  ]
}
```

#### Send Message
```bash
POST /ai/chat
Content-Type: application/json

{
  "provider": "gemini",
  "message": "Explain quantum computing",
  "model": "gemini-pro",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ],
  "sessionId": "optional-session-id"
}

# Response:
{
  "success": true,
  "response": "Quantum computing is...",
  "usage": {
    "tokens": 150
  },
  "model": "gemini-pro"
}
```

#### Get Chat History (Authenticated)
```bash
GET /ai/history?sessionId=abc123&limit=50
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "history": [
    {
      "provider": "gemini",
      "model": "gemini-pro",
      "message": "Hello",
      "response": "Hi!",
      "tokens": 10,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Clear Chat History
```bash
DELETE /ai/history
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "abc123"
}
```

---

## 🕷️ Web Scraper & Media Downloader

### Features

- **Web Scraping**: Extract text, images, links, and metadata from any webpage
- **YouTube Downloader**: Download videos and audio in various qualities
- **Image Downloader**: Download images from any URL
- **Social Media Detection**: Automatically detect platform and extract metadata
- **Download History**: Track all downloads (authenticated users)
- **Progress Tracking**: Monitor download progress in real-time

### API Endpoints

#### Scrape Webpage
```bash
POST /scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "extractText": true,
    "extractImages": true,
    "extractLinks": true,
    "extractMetadata": true
  }
}

# Response:
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "metadata": {
      "description": "...",
      "og": { "title": "...", "image": "..." }
    },
    "text": {
      "headings": { "h1": [...], "h2": [...] },
      "paragraphs": [...]
    },
    "images": [
      { "url": "...", "alt": "...", "width": "..." }
    ],
    "links": [
      { "url": "...", "text": "..." }
    ]
  }
}
```

#### Download YouTube Video/Audio
```bash
POST /download/youtube
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": "video",  // or "audio"
  "quality": "highest" // or "high", "medium", "low"
}

# Response:
{
  "success": true,
  "downloadId": "abc123",
  "filename": "video_title_abc123.mp4",
  "filepath": "/path/to/downloads/video_title_abc123.mp4",
  "size": 5242880,
  "title": "Video Title",
  "duration": 240
}
```

#### Download Image
```bash
POST /download/image
Content-Type: application/json

{
  "url": "https://example.com/image.jpg"
}

# Response:
{
  "success": true,
  "downloadId": "def456",
  "filename": "image_def456.jpg",
  "filepath": "/path/to/downloads/image_def456.jpg",
  "size": 1024000,
  "contentType": "image/jpeg"
}
```

#### Get Download Status
```bash
GET /download/status/:downloadId

# Response:
{
  "found": true,
  "id": "abc123",
  "status": "downloading", // or "completed", "failed"
  "progress": 45,
  "downloadedBytes": 2359296,
  "totalBytes": 5242880
}
```

#### Get Download History (Authenticated)
```bash
GET /download/history?limit=50
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "history": [
    {
      "url": "...",
      "type": "youtube-video",
      "filename": "...",
      "size_bytes": 5242880,
      "status": "completed",
      "completed_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Extract Social Media Info
```bash
POST /scrape/social
Content-Type: application/json

{
  "url": "https://twitter.com/user/status/123456"
}

# Response:
{
  "success": true,
  "platform": "twitter",
  "data": {
    "title": "...",
    "metadata": { ... },
    "images": [ ... ]
  }
}
```

---

## 🗄️ Database Schema

The application automatically creates these tables on startup:

### `users`
```sql
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE
- username: VARCHAR(100)
- password_hash: VARCHAR(255)
- role: VARCHAR(50) DEFAULT 'user'
- created_at: TIMESTAMP DEFAULT NOW()
```

### `chat_history`
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER REFERENCES users(id)
- provider: VARCHAR(50)
- model: VARCHAR(100)
- message: TEXT
- response: TEXT
- tokens: INTEGER
- session_id: VARCHAR(255)
- created_at: TIMESTAMP DEFAULT NOW()
```

### `download_history`
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER REFERENCES users(id)
- url: TEXT
- type: VARCHAR(50)
- filename: VARCHAR(255)
- size_bytes: BIGINT
- status: VARCHAR(50)
- created_at: TIMESTAMP DEFAULT NOW()
- completed_at: TIMESTAMP
```

### `user_sessions`
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER REFERENCES users(id)
- session_token: VARCHAR(255) UNIQUE
- ip_address: VARCHAR(100)
- user_agent: TEXT
- created_at: TIMESTAMP DEFAULT NOW()
- expires_at: TIMESTAMP
```

### `api_keys`
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER REFERENCES users(id)
- provider: VARCHAR(50)
- encrypted_key: TEXT
- created_at: TIMESTAMP DEFAULT NOW()
```

---

## 🎨 Frontend Integration (Coming Soon)

We're building beautiful UI components for:
- **Login/Register Page** - Modern authentication interface
- **AI Chat Interface** - Chat with multiple AI providers
- **Downloader Dashboard** - Download manager with progress tracking
- **Scraper UI** - Visual web scraping interface

---

## 🔧 Testing

### Test Authentication
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","username":"testuser"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Test AI Chat
```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"provider":"gemini","message":"Hello AI!","model":"gemini-pro"}'
```

### Test Web Scraper
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

---

## 🚀 Deployment

### Render.com
1. Add PostgreSQL database addon
2. Set environment variables in dashboard
3. Deploy from GitHub

### Vercel
Note: AI and download features work, but PostgreSQL requires external database (e.g., Neon, Supabase).

---

## 📝 Next Steps

1. ✅ Backend infrastructure complete
2. ⏳ Create login.html UI
3. ⏳ Create ai-chat.html interface
4. ⏳ Create downloader.html interface
5. ⏳ Update main index.html navigation
6. ⏳ Test complete workflow
7. ⏳ Deploy to production

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🆘 Support

- Issues: https://github.com/yourusername/headless-web.io/issues
- Discussions: https://github.com/yourusername/headless-web.io/discussions
