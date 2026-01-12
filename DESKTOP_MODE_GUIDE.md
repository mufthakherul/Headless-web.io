# 🖥️ Desktop Mode - Quick Guide

Welcome to Desktop Mode! This is an enhanced browsing experience with full page captures and advanced controls.

## Getting Started

### 1. Starting a Desktop Session
1. Go to the home page (http://localhost:3000 or your Render URL)
2. Paste your target URL in the input field
3. Select "Desktop Mode" from the mode selector
4. Click "Browse" or press `Ctrl+Enter`
5. A new window will open with the Desktop viewer

### 2. Main Controls

#### Capture & Navigation
- **📸 Capture** (`Ctrl+S`) - Take a full page screenshot
- **🔄 Refresh** (`F5`) - Refresh the page capture
- **↔️ Resize** - Change viewport dimensions (320-3840 x 240-2160)

#### View & Settings
- **📊 Stats** - Toggle statistics sidebar
- **🌙** - Toggle dark/light theme
- **✕ Close** (`Ctrl+W`) - End the session

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+S** | Capture screenshot |
| **F5** | Refresh page |
| **Ctrl+R** | Apply viewport resize |
| **Ctrl+W** | Close session |

## Features

### 📸 Screenshot Capture
- Full page JPEG captures
- Automatic render time tracking
- Up to 1920x1080 resolution
- Optimized for bandwidth

### 📐 Viewport Resizing
- Mobile: 375x667 (iPhone)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080 (Standard)
- Custom sizes from 320x240 to 3840x2160

### 📊 Real-time Statistics
- **Captures**: Total screenshots taken
- **Avg Render**: Average render time per capture
- **Data Captured**: Total bandwidth used
- **Duration**: Session uptime
- **Page Metrics**: Load time, resources, memory

### 🌓 Theme Support
- Automatic dark/light detection
- Persistent theme preference
- Easy toggle button
- Eye-friendly colors

## Tips & Tricks

### Capture Different Layouts
```
1. Resize to 375x667 (Mobile)
2. Capture screenshot
3. Resize to 768x1024 (Tablet)
4. Capture screenshot again
5. Resize to 1920x1080 (Desktop)
6. Capture final screenshot
```

### Performance Monitoring
1. Click "📊 Stats" to open sidebar
2. Watch metrics update in real-time
3. Monitor "Avg Render" time
4. Check "Duration" for session length

### Quick Workflow
```
1. Paste URL
2. Press Ctrl+Enter (submit)
3. Window opens automatically
4. Press Ctrl+S to capture
5. Use Resize controls to test layouts
6. Close with Ctrl+W when done
```

## Common Tasks

### Capture for Different Screen Sizes
1. Resize viewport to target size
2. Press Ctrl+S to capture
3. Right-click on image → Save as

### View Page Performance
1. Click "📊 Stats" button
2. Check "Page Metrics" section
3. Monitor real-time load times
4. See resource usage

### Switch Themes
1. Click "🌙" button (top right)
2. Theme persists across sessions
3. Works with your OS preference

### End Session
1. Press Ctrl+W, or
2. Click "✕ Close" button
3. Session is automatically cleaned up

## Advanced Usage

### Viewport Presets
```
Mobile:     375 × 667
iPhone 12:  390 × 844
Tablet:     768 × 1024
iPad:       1024 × 1366
Desktop:    1920 × 1080
Ultra:      2560 × 1440
4K:         3840 × 2160
```

### Best Practices
✅ Do:
- Capture at common breakpoints
- Monitor render times for optimization
- Use dark mode in low light
- Close sessions when done

❌ Don't:
- Leave sessions open indefinitely
- Request extremely large viewports
- Capture same page repeatedly without reason
- Ignore timeout warnings

## Session Limits

- **Session Duration**: 2 hours (auto-cleanup)
- **Max Viewport Width**: 3840px
- **Max Viewport Height**: 2160px
- **Min Viewport Width**: 320px
- **Min Viewport Height**: 240px
- **Capture History**: Last 20 captures tracked
- **Max Data Per Capture**: ~2-3MB (JPEG)

## Troubleshooting

### Blank Canvas
**Issue**: Screenshot not appearing
- **Solution**: Click "🔄 Refresh" button
- **Check**: Browser console for errors

### Resize Not Working
**Issue**: Viewport resize fails
- **Solution**: Check dimensions are within 320-3840 x 240-2160
- **Try**: Use preset values first (1920x1080)

### Slow Rendering
**Issue**: Captures take too long
- **Tip**: Complex pages render slower
- **Check**: Monitor render time in status bar
- **Optimize**: Reduce viewport size

### Session Closed
**Issue**: "Session not found" error
- **Reason**: Session expired after 2 hours
- **Solution**: Start a new session from home page

## Comparison with Other Modes

| Feature | Desktop | Live | Snapshot |
|---------|---------|------|----------|
| Interactive | ✅ | ✅ | ❌ |
| Real-time | ✅ | ✅ | ❌ |
| Full Captures | ✅ | ❌ | ❌ |
| Metrics | ✅ | ❌ | ❌ |
| Resize | ✅ | ❌ | ❌ |
| JS Execution | ✅ | ✅ | ❌ |
| Duration | 2h | 30m | ✅ |
| CPU Usage | High | High | Low |

## API Reference (Advanced)

### Start Session
```bash
POST /desktop/start
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "url": "https://example.com"
}
```

### Capture Screenshot
```bash
GET /desktop/capture?sid=desktop_xxx
```

### Resize Viewport
```bash
POST /desktop/resize
Content-Type: application/json

{
  "sid": "desktop_xxx",
  "width": 1920,
  "height": 1080
}
```

### Get Statistics
```bash
GET /desktop/stats?sid=desktop_xxx
```

### Close Session
```bash
POST /desktop/close
Content-Type: application/json

{
  "sid": "desktop_xxx"
}
```

## Getting Help

- 📚 See [DESKTOP_MODE_IMPLEMENTATION.md](DESKTOP_MODE_IMPLEMENTATION.md) for technical details
- 💬 Check [API.md](docs/API.md) for complete API reference
- 🐛 Report issues on [GitHub](https://github.com/mufthakherul/Headless-web.io)

## Feature Requests

Have ideas for Desktop Mode improvements?
1. Viewport presets
2. Screenshot history
3. Download management
4. Network throttling
5. JavaScript console

Open an issue or PR on GitHub!

---

**Happy Browsing! 🚀**
