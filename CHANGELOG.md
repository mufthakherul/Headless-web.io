# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-01-12

### Added

#### HTML Files Moved to Root
- **Moved `index.html` and `live.html` to root directory**: Better organization and accessibility
- Updated server.js to serve HTML files from root directory
- Fixed "Failed to load stats: Unexpected token '<'" error by proper routing

#### Frontend Enhancement Features
- **📜 Browsing History**: Automatic tracking of visited URLs with localStorage persistence
  - View history with timestamps and modes
  - Quick access to previously visited sites
  - One-click bookmark from history
  - Clear history functionality
- **⭐ Bookmarks Management**: Save and organize favorite websites
  - Add custom names to bookmarks
  - Quick access from bookmarks panel
  - Remove bookmarks functionality
- **⚙️ User Settings Panel**: Customize application behavior
  - Auto-save history preference
  - Notification settings
  - Theme preference storage
- **📤 Export/Import Data**: Backup and restore user data
  - Export browsing history, bookmarks, and settings as JSON
  - Import data from previous exports
  - Clear all data option with confirmation
- **Enhanced Navigation Bar**: Added History, Bookmarks, and Settings buttons
- **Improved Modal System**: Better modal management with outside-click closing

#### Server-Side Enhancements
- **Session Management API**:
  - `GET /sessions/list` - List all active sessions with metadata
  - `DELETE /sessions/:sessionId` - Delete specific sessions
  - `POST /sessions/cleanup` - Manual cleanup of stale sessions
- **Automatic Session Cleanup**: 
  - Sessions expire after 30 minutes of inactivity
  - Sessions auto-delete after 24 hours maximum age
  - Cleanup runs every 5 minutes automatically
- **Response Caching System**:
  - LRU cache for static content responses
  - Configurable cache size (default: 100 items)
  - 5-minute TTL for cached responses
  - `GET /cache/stats` - View cache statistics
  - `POST /cache/clear` - Clear response cache
- **Enhanced Health Endpoint**: Added cache size and session count to health check
- **Performance Monitoring**: Track session ages, idle times, and cache efficiency

#### Project Restructuring
- **New `/web` directory**: Moved HTML files from `/public` to `/web` for better organization
- Separated web assets from other files for cleaner codebase structure

#### Vercel Deployment Support
- Added `vercel.json` configuration for serverless deployment
- Added `.vercelignore` to optimize deployments
- Modified server.js to support both standalone and serverless environments
- Created comprehensive `DEPLOYMENT.md` guide

#### Docker Support
- Added `Dockerfile` for containerized deployments
- Added `.dockerignore` for optimized container builds
- Included Playwright/Chromium setup in Docker image
- Added health check configuration

#### Enhanced Security
- **Helmet.js integration**: Comprehensive HTTP security headers
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: SAMEORIGIN
  - Strict-Transport-Security
  - X-XSS-Protection
  - And more...
- Enhanced error messages without exposing sensitive data
- Request ID generation for error tracking

#### Performance Improvements
- **Compression middleware**: Gzip/Brotli compression for all responses
- Request/response metrics tracking
- Response time headers (X-Response-Time)
- Memory usage monitoring

#### API Enhancements
- **New `/api/docs` endpoint**: Complete interactive API documentation
  - All endpoints documented with examples
  - Parameter descriptions and types
  - Security information
  - Feature list
- **New `/metrics` endpoint**: Detailed performance metrics
  - Request counts by method and status
  - Top endpoints by usage
  - Average response times
  - Error rates
  - Memory usage statistics
- **Enhanced `/stats` endpoint**: Now includes request metrics and formatted uptime
- **Enhanced `/health` endpoint**: More detailed health information

#### CORS Support
- Added CORS middleware for API access
- Configurable via `CORS_ORIGIN` environment variable
- Supports credentials for authenticated requests

#### Better Error Handling
- Improved 404 messages with helpful suggestions
- Enhanced error responses with request IDs
- Environment-aware error details (production vs development)
- Better logging for debugging

#### UI Improvements
- Added "API Docs" button to main UI
- Improved navigation layout
- Better organization of utility buttons

#### Developer Experience
- Comprehensive deployment documentation
- Docker support for easy development setup
- Better code organization
- Enhanced logging middleware

### Changed
- **Static file serving**: Now serves from `/web` instead of `/public`
- **Route handling**: Updated all HTML file paths to use `/web` directory
- **GitHub Actions workflow**: Updated to build from `/web` directory
- **Error responses**: Now include more helpful information
- **Stats endpoint**: Enhanced with request metrics and better formatting

### Technical Improvements
- Request metrics tracking system
- Response time measurement
- Path-based request analytics
- Memory usage reporting
- Uptime formatting helper
- Serverless environment detection
- Graceful shutdown only in non-serverless environments

### Documentation
- Created `DEPLOYMENT.md` with comprehensive deployment guides
- Updated `README.md` with deployment section
- Added Vercel deployment button
- Documented API endpoints
- Added changelog

### Security
- All security headers properly configured
- SSRF protection maintained
- Rate limiting maintained
- Session validation maintained
- Enhanced error handling without data leakage

## [2.0.0] - Previous Version

### Features
- Multiple browsing modes (Proxy, Reader, Text-only, Live, Snapshot)
- Playwright integration for live sessions
- WebSocket support
- PDF generation
- Cookie management
- Session management
- Rate limiting
- SSRF protection
- Comprehensive logging

---

## Upgrade Notes

### From 2.0.0 to 2.1.0

#### Breaking Changes
- Static files now served from `/web` instead of `/public`
- If you have custom integrations accessing `/public`, update paths to `/web`

#### Migration Steps
1. Pull the latest changes
2. Run `npm install` to get new dependencies (helmet, compression, cors)
3. Update any custom references to `/public` to `/web`
4. (Optional) Configure CORS_ORIGIN environment variable if needed
5. Review new deployment options in DEPLOYMENT.md

#### New Environment Variables (Optional)
- `CORS_ORIGIN`: Configure allowed CORS origins (default: '*')
- `VERCEL`: Automatically set by Vercel (used for serverless detection)

#### New Dependencies
- `helmet` (^8.x): Security headers
- `compression` (^1.x): Response compression
- `cors` (^2.x): CORS support

---

For more information, see [DEPLOYMENT.md](DEPLOYMENT.md) and [README.md](README.md).
