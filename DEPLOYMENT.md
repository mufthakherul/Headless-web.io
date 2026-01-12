# Deployment Guide

This guide covers how to deploy Headless-web Gateway to various platforms.

## Vercel Deployment

Headless-web Gateway can be deployed to Vercel as a serverless application.

### Prerequisites

- Vercel account (sign up at https://vercel.com)
- Vercel CLI (optional): `npm install -g vercel`

### Quick Deploy

1. **Via Vercel Dashboard:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will automatically detect the Node.js project
   - Click "Deploy"

2. **Via Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

### Configuration

The project includes a `vercel.json` configuration file that sets up:
- Serverless function routing
- Environment variables
- Build settings

### Environment Variables

Set these environment variables in Vercel dashboard (optional):

- `NODE_ENV`: Set to `production` (automatically set by Vercel)
- `USE_REDIS`: Set to `false` for serverless (default)
- `CORS_ORIGIN`: Set allowed origins for CORS (default: `*`)

### Limitations on Vercel

⚠️ **Important:** Some features have limitations in serverless environments:

1. **WebSocket Support**: Limited in serverless functions
   - WebSocket connections may not work reliably
   - Consider using polling or SSE for real-time updates

2. **Playwright/Live Mode**: Resource intensive
   - May hit memory/time limits on free tier
   - Consider upgrading to Pro for better performance
   - Alternatively, disable live mode for Vercel deployments

3. **Session Persistence**: In-memory storage only
   - Sessions don't persist between function invocations
   - Consider using Redis or external storage for production

4. **File System**: Temporary storage only
   - Snapshots and cookies are stored temporarily
   - Files may be lost between invocations
   - Use cloud storage (S3, R2) for persistent data

### Recommended Configuration for Vercel

For the best experience on Vercel, consider:

1. **Use Basic Features Only:**
   - Proxy mode ✅
   - Reader mode ✅
   - Text-only mode ✅
   - PDF generation ⚠️ (may timeout)
   - Snapshot mode ⚠️ (limited storage)
   - Live mode ❌ (not recommended)

2. **External Services:**
   - Use Redis Cloud for session storage
   - Use S3/R2 for file storage
   - Use separate WebSocket service if needed

### Testing Locally

Before deploying, test with Vercel's dev environment:

```bash
npm install -g vercel
vercel dev
```

This simulates the serverless environment locally.

## Alternative Deployment Options

### Traditional Server Deployment

For full feature support, deploy to a traditional server:

#### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start server.js --name headless-web

# Configure startup script
pm2 startup
pm2 save
```

#### Using Docker

```bash
# Build image
docker build -t headless-web .

# Run container
docker run -d -p 3000:3000 --name headless-web headless-web
```

#### Using systemd

Create `/etc/systemd/system/headless-web.service`:

```ini
[Unit]
Description=Headless-web Gateway
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/headless-web
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl enable headless-web
systemctl start headless-web
```

### Cloud Platforms

#### AWS EC2 / DigitalOcean / Linode

1. Set up a Linux server (Ubuntu 22.04 recommended)
2. Install Node.js 18+
3. Clone the repository
4. Install dependencies: `npm install`
5. Configure environment variables
6. Start with PM2 (see above)

#### Heroku

```bash
# Install Heroku CLI
heroku create my-headless-web

# Set config
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

#### Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect and deploy
3. Configure environment variables in dashboard

## Performance Optimization

### For Production Deployments

1. **Enable Redis:**
   ```bash
   export USE_REDIS=true
   export REDIS_URL=redis://your-redis-server:6379
   ```

2. **Use a CDN:**
   - Serve static files through CloudFlare or similar
   - Cache API responses where appropriate

3. **Configure Rate Limiting:**
   - Adjust rate limits based on your traffic
   - Consider implementing IP whitelisting

4. **Monitor Resources:**
   - Use PM2 monitoring or external services
   - Set up alerts for high memory/CPU usage

## Security Considerations

1. **Environment Variables:**
   - Never commit `.env` files
   - Use platform-specific secret management

2. **SSRF Protection:**
   - Already enabled by default
   - Review security.js for customization

3. **HTTPS:**
   - Always use HTTPS in production
   - Vercel provides this automatically
   - For self-hosted, use Let's Encrypt

4. **Access Control:**
   - Consider adding authentication
   - Implement API key validation if needed

## Troubleshooting

### Vercel 500 Error

If you see "FUNCTION_INVOCATION_FAILED":

1. Check function logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify `vercel.json` configuration
4. Check for memory/timeout issues
5. Disable resource-intensive features

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Playwright Installation

If Playwright fails to install:

```bash
# Install system dependencies
npx playwright install-deps

# Install browsers
npx playwright install
```

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/mufthakherul/Headless-web.io/issues)
- Documentation: See `/api/docs` endpoint
- Health Check: Visit `/health` endpoint
