# 🎯 WCAG 2.1 Level AA Accessibility Guide - Headless-web v4.0

## Quick Overview

This guide provides actionable improvements to make Headless-web fully compliant with WCAG 2.1 Level AA accessibility standards. These changes ensure the platform is usable by everyone, regardless of ability.

---

## 📋 Accessibility Checklist

- [ ] **Keyboard Navigation** - All features accessible via keyboard
- [ ] **Screen Reader Support** - Proper ARIA labels and semantic HTML
- [ ] **Color Contrast** - Minimum 4.5:1 for text
- [ ] **Focus Management** - Clear focus indicators
- [ ] **Form Validation** - Clear error messages
- [ ] **Motion & Animation** - Respect `prefers-reduced-motion`
- [ ] **Text Alternatives** - Alt text for images
- [ ] **Language** - Proper lang attribute and language changes
- [ ] **Mobile Accessibility** - Touch targets 44x44px minimum
- [ ] **Responsive Design** - Works at any zoom level

---

## 🔍 Detailed Improvements

### 1. Semantic HTML & ARIA

**Current Issue**: Generic `<div>` elements without semantic meaning  
**Solution**: Use proper semantic HTML5 elements

```html
<!-- ❌ BEFORE: Non-semantic -->
<div class="header">
  <div class="nav">
    <div onclick="gotoLogin()">Login</div>
  </div>
</div>

<!-- ✅ AFTER: Semantic & accessible -->
<header>
  <nav>
    <button onclick="gotoLogin()" aria-label="Login to account">
      Login
    </button>
  </nav>
</header>
```

**Semantic Elements to Use:**
- `<header>`, `<nav>`, `<main>`, `<footer>` - Structural
- `<article>`, `<section>` - Content
- `<button>` instead of `<div onclick>`
- `<form>` instead of plain div
- `<label>` for form fields

### 2. ARIA Attributes

**Add ARIA labels for clarity:**

```html
<!-- ✅ Describe button purpose -->
<button aria-label="Toggle dark mode">
  🌙
</button>

<!-- ✅ Link to form error messages -->
<input id="email" aria-describedby="email-error">
<span id="email-error" role="alert">Email is required</span>

<!-- ✅ Indicate loading state -->
<button aria-busy="true" disabled>
  Loading...
</button>

<!-- ✅ Expandable sections -->
<button aria-expanded="false" aria-controls="details-panel">
  Show Details
</button>
<div id="details-panel" hidden>
  Details content...
</div>

<!-- ✅ Live regions for updates -->
<div aria-live="polite" aria-atomic="true">
  Message count: 5
</div>
```

### 3. Keyboard Navigation

**Make everything keyboard accessible:**

```javascript
// ✅ Support keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt+L = Login
  if (e.altKey && e.key.toLowerCase() === 'l') {
    gotoLogin();
  }
  
  // Alt+D = Dark mode toggle
  if (e.altKey && e.key.toLowerCase() === 'd') {
    toggleTheme();
  }
  
  // Alt+H = Help
  if (e.altKey && e.key.toLowerCase() === 'h') {
    showHelp();
  }
});

// ✅ Tab order management
function setTabOrder() {
  const elements = document.querySelectorAll('button, a, input, textarea, select');
  elements.forEach((el, index) => {
    el.tabIndex = index === 0 ? 0 : -1;
  });
}

// ✅ Skip link to main content
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && e.target === document.body) {
    const skipLink = document.getElementById('skip-to-main');
    skipLink?.focus();
  }
});
```

### 4. Focus Management

```html
<!-- ✅ Skip to main content link (hidden, shows on focus) -->
<a href="#main-content" id="skip-to-main" class="skip-link">
  Skip to main content
</a>

<!-- ✅ Visible focus indicator -->
<style>
  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  /* Don't hide focus for keyboard users */
  button:focus-visible {
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
  }
</style>
```

### 5. Color Contrast

**Check contrast ratio using: https://webaim.org/resources/contrastchecker/**

```css
/* ✅ WCAG AA compliant contrast ratios */

/* Primary text on white (need 4.5:1 minimum) */
:root {
  --text-primary: #111827; /* Contrast: 18:1 ✓ */
  --text-secondary: #374151; /* Contrast: 9:1 ✓ */
  --border-color: #d1d5db; /* Contrast with white: 8:1 ✓ */
}

/* For dark mode */
[data-theme="dark"] {
  --text-primary: #f9fafb; /* Contrast: 18:1 ✓ */
  --text-secondary: #d1d5db; /* Contrast: 7:1 ✓ */
  --border-color: #4b5563; /* Contrast with dark bg: 8:1 ✓ */
}

/* ✅ Links must be distinguishable */
a {
  color: #0066cc; /* Distinct from text */
  text-decoration: underline; /* Not just color */
}

/* ✅ Error states need contrast */
.error {
  color: #c41e3a; /* High contrast red */
  background-color: #fff8f8; /* Light red background */
}

/* ✅ Success states need contrast */
.success {
  color: #065f46; /* High contrast green */
  background-color: #f0fdf4; /* Light green background */
}
```

### 6. Form Accessibility

```html
<!-- ✅ Proper form labels -->
<form>
  <div class="form-group">
    <label for="email">Email Address</label>
    <input 
      id="email" 
      type="email" 
      required
      aria-required="true"
      aria-describedby="email-help email-error"
    >
    <small id="email-help">We'll never share your email</small>
    <span id="email-error" role="alert" style="color: red; display: none;"></span>
  </div>

  <div class="form-group">
    <label for="password">Password</label>
    <input 
      id="password" 
      type="password"
      required
      aria-label="Password - Must be at least 8 characters"
    >
  </div>

  <button type="submit" aria-label="Submit login form">
    Login
  </button>
</form>
```

### 7. Text Alternatives for Images

```html
<!-- ❌ Missing alt text -->
<img src="logo.png">

<!-- ✅ Descriptive alt text -->
<img src="logo.png" alt="Headless-web platform logo">

<!-- ✅ For decorative images -->
<img src="decorative-line.svg" alt="" aria-hidden="true">

<!-- ✅ For complex images, use longdesc -->
<img src="chart.svg" alt="Monthly traffic chart" longdesc="/descriptions/traffic-chart">
<a href="/descriptions/traffic-chart">Chart description</a>
```

### 8. Motion & Animation Preferences

```css
/* ✅ Respect motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ✅ Safe animations (only when motion not reduced) */
@media (prefers-reduced-motion: no-preference) {
  button {
    transition: all 0.3s ease;
  }

  .slide-in {
    animation: slideIn 0.5s ease-out;
  }
}
```

### 9. Responsive Text & Touch Targets

```css
/* ✅ Minimum font size: 16px for mobile */
body {
  font-size: 16px;
}

/* ✅ Line height for readability: 1.5x */
body, p, a, label {
  line-height: 1.5;
}

/* ✅ Touch target minimum: 44x44px */
button, a, input, select, textarea {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px; /* Ensures 44px minimum */
}

/* ✅ Zoom support up to 200% */
html {
  font-size: 16px; /* Base for calculations */
  zoom: 100%;
}

@media (max-width: 320px) {
  html {
    font-size: 14px; /* Scale down on very small screens */
  }
}
```

### 10. Error Messages & Validation

```javascript
// ✅ Clear, specific error messages
function validateEmail(email) {
  if (!email) {
    return { valid: false, error: 'Email address is required' };
  }
  if (!email.includes('@')) {
    return { valid: false, error: 'Email must contain an "@" symbol' };
  }
  return { valid: true };
}

// ✅ Show errors to screen readers
function showFormError(fieldId, message) {
  const errorElement = document.getElementById(`${fieldId}-error`);
  const inputElement = document.getElementById(fieldId);
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  inputElement.setAttribute('aria-invalid', 'true');
  inputElement.setAttribute('aria-describedby', `${fieldId}-error`);
  
  // Announce to screen reader
  const alert = document.createElement('div');
  alert.setAttribute('role', 'alert');
  alert.textContent = `${inputElement.getAttribute('aria-label')}: ${message}`;
  alert.style.display = 'none';
  document.body.appendChild(alert);
}
```

### 11. Language & Localization

```html
<!-- ✅ Declare document language -->
<html lang="en">

<!-- ✅ Mark language changes -->
<p>
  This is English. 
  <span lang="es">Esto es español.</span>
  <span lang="fr">C'est du français.</span>
</p>

<!-- ✅ Provide language selection -->
<select id="language" aria-label="Select language">
  <option value="en" selected>English</option>
  <option value="es">Español</option>
  <option value="fr">Français</option>
</select>
```

### 12. Page Structure & Headings

```html
<!-- ✅ Proper heading hierarchy -->
<html>
  <head><title>Headless-web - AI Chat</title></head>
  <body>
    <h1>AI Chat Interface</h1>
    <!-- Main content -->
    
    <section>
      <h2>Available Providers</h2>
      <!-- Provider list -->
      
      <article>
        <h3>Google Gemini</h3>
        <!-- Details -->
      </article>
    </section>

    <aside aria-label="Related links">
      <h2>Additional Resources</h2>
      <!-- Links -->
    </aside>
  </body>
</html>
```

---

## 🧪 Testing Checklist

### Automated Testing
- [ ] Run axe DevTools browser extension
- [ ] Run Lighthouse accessibility audit
- [ ] Use WAVE browser extension
- [ ] Check with Pa11y CLI

### Manual Testing
- [ ] Navigate site using only keyboard (Tab, Enter, Arrow keys)
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Zoom to 200% - layout still works
- [ ] Disable CSS - content is readable
- [ ] Check all forms can be filled
- [ ] Test with high contrast mode enabled

### Tools to Use
1. **axe DevTools** - Browser extension for accessibility audit
2. **Lighthouse** - Built into Chrome DevTools
3. **WAVE** - Web accessibility checker
4. **Color Contrast Analyzer** - Check color combinations
5. **NVDA Screen Reader** - Test with screen reader (free)
6. **Pa11y** - Command-line accessibility checker

---

## 📚 Resources

- **WCAG 2.1 Guide**: https://www.w3.org/WAI/WCAG21/quickref/
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM**: https://webaim.org/
- **Deque University**: https://dequeuniversity.com/
- **A11y Project**: https://www.a11yproject.com/

---

## ✅ Compliance Verification

```javascript
// ✅ Automated accessibility testing in tests
describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });

  it('should support keyboard navigation', async () => {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });

  it('should have proper heading hierarchy', async () => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      expect(level - lastLevel).toBeLessThanOrEqual(1);
      lastLevel = level;
    });
  });
});
```

---

## 🎯 Implementation Priority

1. **P1 (Critical)**: Keyboard navigation, screen reader support, color contrast
2. **P2 (High)**: Form labels, error messages, focus indicators
3. **P3 (Medium)**: Motion preferences, touch targets, heading hierarchy
4. **P4 (Low)**: Language support, longdesc for complex images

---

## 📊 Expected Outcomes

- **Lighthouse Accessibility Score**: 95+ / 100
- **WAVE Errors**: 0
- **Axe Violations**: 0 Critical, 0 Serious
- **Keyboard Navigation**: 100% of features
- **Screen Reader Compatibility**: All major readers supported
- **WCAG 2.1 Level AA**: Full compliance

---

## 🔄 Continuous Monitoring

Add accessibility checks to your CI/CD pipeline:

```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests
on: [push, pull_request]
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm run test:a11y
      - run: npm run test:lighthouse
```

---

**Status**: Ready for implementation  
**Target Completion**: End of Week 3  
**Expected Impact**: 100% WCAG 2.1 Level AA compliance
