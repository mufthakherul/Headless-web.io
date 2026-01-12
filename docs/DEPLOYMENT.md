# Production Deployment Guide

This guide covers deploying Headless-web to production environments.

## Prerequisites

- Node.js 14 or higher
- npm or yarn
- Reverse proxy (NGINX/Apache) recommended
- SSL certificate (for HTTPS)
- (Optional) Redis for session/rate limit storage
- (Optional) Process manager (PM2, systemd)

## Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone and Install

```bash
# Clone repository
git clone https://github.com/mufthakherul/Headless-web.io.git
cd Headless-web.io

# Install dependencies
npm ci --production

# Create logs directory
mkdir -p logs
```

### 3. Environment Configuration

Create a `.env` file:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Logging
LOG_LEVEL=info

# Optional: Redis (for production scale)
# REDIS_URL=redis://localhost:6379

# Optional: Session Configuration
# SESSION_SECRET=your-super-secret-key-here
```

### 4. Start with PM2

```bash
# Start application
pm2 start server.js --name headless-web

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# Monitor
pm2 monit
```

### 5. NGINX Reverse Proxy

Create `/etc/nginx/sites-available/headless-web`:

```nginx
upstream headless_web {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy Configuration
    location / {
        proxy_pass http://headless_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Logs
    access_log /var/log/nginx/headless-web-access.log;
    error_log /var/log/nginx/headless-web-error.log;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/headless-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 'Nginx Full'

# Optionally allow SSH
sudo ufw allow OpenSSH

# Enable firewall
sudo ufw enable
```

## Production Checklist

### Security

- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure trusted proxy in Express
- [ ] Set up rate limiting with Redis (for multi-instance)
- [ ] Implement IP whitelisting/blacklisting
- [ ] Regular security audits with `npm audit`
- [ ] Keep dependencies updated
- [ ] Review and restrict CORS if needed
- [ ] Set up fail2ban for SSH

### Performance

- [ ] Enable gzip compression in NGINX
- [ ] Set up caching headers
- [ ] Monitor memory usage (PM2)
- [ ] Configure log rotation
- [ ] Optimize session storage (use Redis)
- [ ] Set resource limits

### Monitoring

- [ ] Set up application monitoring (PM2 Plus, New Relic, etc.)
- [ ] Configure log aggregation
- [ ] Set up error alerting
- [ ] Monitor disk space
- [ ] Track response times
- [ ] Set up uptime monitoring

### Backup & Recovery

- [ ] Regular database/session backups (if using Redis)
- [ ] Log archival strategy
- [ ] Disaster recovery plan
- [ ] Test recovery procedures

## PM2 Commands

```bash
# View logs
pm2 logs headless-web

# Restart application
pm2 restart headless-web

# Stop application
pm2 stop headless-web

# Monitor
pm2 monit

# Show status
pm2 status

# View detailed info
pm2 show headless-web
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `NODE_ENV` | Environment | development | No |
| `LOG_LEVEL` | Logging level | info | No |
| `REDIS_URL` | Redis connection URL | - | No |

## Scaling Considerations

### Horizontal Scaling

When running multiple instances:

1. **Use Redis for sessions and rate limiting**
   ```javascript
   // Install: npm install redis connect-redis
   // Configure in server.js
   ```

2. **Load Balancer Configuration**
   - Use NGINX upstream with multiple backends
   - Enable sticky sessions if needed
   - Health checks on `/health` endpoint

3. **Shared Storage**
   - Logs should go to centralized logging
   - Session data in Redis
   - Static assets on CDN

### Vertical Scaling

- Increase Node.js memory limit: `node --max-old-space-size=4096 server.js`
- Monitor with `pm2 monit`
- Adjust worker processes based on CPU cores

## Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs headless-web --lines 100

# Check process status
pm2 status

# Try running directly
node server.js
```

### High memory usage

```bash
# Check memory
pm2 monit

# Restart if needed
pm2 restart headless-web

# Check for memory leaks
node --inspect server.js
```

### Rate limiting issues

- Check IP forwarding configuration in NGINX
- Verify `X-Forwarded-For` header is set
- Consider moving rate limiting to Redis

### SSRF protection blocking valid URLs

- Check DNS resolution
- Review security.js configuration
- Check firewall rules

## Maintenance

### Log Rotation

Create `/etc/logrotate.d/headless-web`:

```
/path/to/Headless-web/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Updates

```bash
# Pull latest changes
cd /path/to/Headless-web
git pull origin main

# Install dependencies
npm ci --production

# Restart application
pm2 restart headless-web
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# Restart after fixes
pm2 restart headless-web
```

## Performance Tuning

### NGINX Optimizations

```nginx
# Add to http block in nginx.conf

# Enable gzip
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

# Connection limits
keepalive_timeout 65;
keepalive_requests 100;

# Buffer sizes
client_body_buffer_size 10K;
client_header_buffer_size 1k;
client_max_body_size 8m;
large_client_header_buffers 2 1k;
```

### Node.js Optimizations

```bash
# PM2 cluster mode (use all CPU cores)
pm2 start server.js -i max --name headless-web

# Or specify number of instances
pm2 start server.js -i 4 --name headless-web
```

## Security Hardening

### Additional Security Measures

1. **Implement rate limiting at NGINX level**
2. **Set up ModSecurity or similar WAF**
3. **Enable CSP headers**
4. **Implement request logging and analysis**
5. **Use fail2ban to block malicious IPs**
6. **Regular security audits**

### Monitoring Suspicious Activity

```bash
# Monitor failed requests
tail -f logs/error.log | grep 'SECURITY'

# Check rate limit triggers
grep 'Rate limit exceeded' logs/combined.log
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/mufthakherul/Headless-web.io/issues
- Documentation: See docs/ folder

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [NGINX Documentation](https://nginx.org/en/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
