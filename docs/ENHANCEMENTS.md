# Headless-web - Enhanced Documentation

## Badges

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Security](https://img.shields.io/badge/security-SSRF%20protected-blue)]()
[![Rate Limiting](https://img.shields.io/badge/rate%20limiting-active-green)]()

## Screenshots

### Current User Interface

![Headless-web Gateway UI](https://github.com/user-attachments/assets/1350f496-ad9b-4411-8e9f-5556850ee179)

**Features shown:**
- ✅ Clean, modern interface with gradient design
- ✅ URL input with SSRF protection validation
- ✅ 7 browsing modes selector
  - ⚡ Fast (Proxy) - Lowest cost, quick load
  - 🚀 Fast+ (Optimized) - Better performance
  - 📖 Reader - Extract main content
  - 📝 Text-only - Minimal view
  - 📸 Snapshot - View-only render
  - 🎮 Live (Interactive) - Real browser session
  - 🖥️ Full Desktop - Maximum compatibility
- ✅ Auto mode toggle for intelligent fallback
- ✅ Compatible with older browsers (Chrome 75+)
- ✅ Responsive design for mobile and desktop

## Recent Improvements (Latest Release)

### ✅ Security Enhancements
- **SSRF Protection**: Comprehensive protection against Server-Side Request Forgery
  - Blocks private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  - Blocks localhost and link-local addresses
  - Blocks cloud metadata endpoints (169.254.169.254)
  - DNS resolution validation
- **Rate Limiting**: Active protection against abuse
  - 60 requests per minute per IP
  - 10 session creations per minute per IP
  - Automatic cleanup of expired rate limit entries
- **Session Management**: Cryptographically secure session IDs (32 bytes of randomness)
- **Input Validation**: All routes validate session IDs and URLs

### ✅ Project Infrastructure
- **GitHub Actions Workflow**: Automated deployment to GitHub Pages
- **MIT License**: Added open source license
- **Contributing Guidelines**: Comprehensive contribution documentation
- **Security Modules**: Separated security logic into dedicated modules
  - `security.js` - SSRF protection and URL validation
  - `rateLimit.js` - Rate limiting middleware

### ✅ Documentation
- Enhanced README with implementation status
- Screenshots section added
- Contributing guidelines
- Security best practices documented

## Deployment

### GitHub Pages
This project is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

**Live Demo**: [https://mufthakherul.github.io/Headless-web.io/](https://mufthakherul.github.io/Headless-web.io/)

The deployment workflow:
1. Runs on every push to `main` or manual trigger
2. Builds the project with Node.js 18
3. Creates build artifacts
4. Deploys to GitHub Pages

See `.github/workflows/pages-deploy.yml` for the complete workflow configuration.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development workflow
- Coding standards
- Types of contributions welcome
- Security guidelines
- Pull request process

## Security

This project implements multiple security layers:

1. **SSRF Protection** - Validates all user-supplied URLs
2. **Rate Limiting** - Prevents abuse and DOS attacks
3. **Session Isolation** - Secure session management
4. **Input Validation** - All inputs are validated

If you discover a security vulnerability, please report it responsibly by contacting the maintainers directly rather than opening a public issue.

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          Express Server                  │
│  ┌────────────────────────────────┐     │
│  │  Security Middleware Layer     │     │
│  │  - SSRF Protection             │     │
│  │  - Rate Limiting               │     │
│  │  - Session Validation          │     │
│  └────────────────────────────────┘     │
│  ┌────────────────────────────────┐     │
│  │  Route Handlers                │     │
│  │  - /go (create session)        │     │
│  │  - /proxy (fast mode)          │     │
│  │  - /reader (reader mode)       │     │
│  │  - /text (text-only mode)      │     │
│  │  - /live/* (interactive mode)  │     │
│  │  - /snapshot/* (snapshot mode) │     │
│  │  - /desktop (full desktop)     │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Future Integration Layer (Planned)     │
│  - HTTP Proxy Engine                    │
│  - Playwright/Puppeteer                 │
│  - Content Extraction (Readability)     │
│  - Guacamole/noVNC                      │
└─────────────────────────────────────────┘
```

## Technology Stack

**Current:**
- Node.js (v14+)
- Express.js
- Vanilla JavaScript (ES6+)
- HTML5/CSS3

**Planned:**
- Playwright/Puppeteer (for Live mode)
- Readability.js (for Reader mode)
- Guacamole/noVNC (for Remote Desktop mode)
- Redis (for session storage in production)

## Performance & Scalability

**Current State:**
- In-memory session storage (suitable for development/small scale)
- In-memory rate limiting (suitable for single instance)

**Production Recommendations:**
- Use Redis for session storage and rate limiting
- Implement horizontal scaling behind a load balancer
- Add caching layer for frequently accessed content
- Consider CDN for static assets
- Monitor resource usage per mode (especially Live and Desktop modes)

## Roadmap

See the [Implementation Status](README.md#implementation-status) section in the main README for the complete roadmap.

**Next Major Milestones:**
1. ✅ Security hardening (COMPLETED)
2. 🚧 Basic Proxy Implementation (IN PROGRESS)
3. ⏳ Content Extraction Modes (PLANNED)
4. ⏳ Headless Browser Integration (PLANNED)
5. ⏳ Remote Desktop Mode (PLANNED)

## FAQ

**Q: Is this production-ready?**
A: No, this is currently a development scaffold with security features. Core browsing functionality is not yet implemented.

**Q: Can I use this to bypass restrictions?**
A: This tool is designed for legitimate use cases like accessing websites on constrained devices. Please respect website terms of service and local laws.

**Q: How secure is it?**
A: We've implemented SSRF protection and rate limiting. However, as features are added, continuous security review is needed.

**Q: Can I self-host this?**
A: Yes! Clone the repo, run `npm install` and `npm start`. See the Quick Start section in the main README.

**Q: Does it support HTTPS websites?**
A: URL validation accepts HTTPS URLs. Actual proxying will require proper SSL handling (planned for Phase 2).

## Support

- 📚 Check the [documentation](docs/) folder
- 🐛 Report bugs via [GitHub Issues](https://github.com/mufthakherul/Headless-web.io/issues)
- 💬 Ask questions in [Discussions](https://github.com/mufthakherul/Headless-web.io/discussions)
- 🤝 Contribute via [Pull Requests](CONTRIBUTING.md)

## Acknowledgments

This project draws inspiration from:
- Web proxy projects and techniques
- Browser automation tools (Playwright, Puppeteer)
- Remote desktop solutions (Guacamole, noVNC)
- Content extraction tools (Readability)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for better web accessibility**
