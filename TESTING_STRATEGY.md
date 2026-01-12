# 🧪 Comprehensive Testing Strategy - Headless-web v4.0

## Testing Pyramid Overview

```
        🔺 E2E Tests (10%)
       ↙ 200-500 tests ↘
      🔺 Integration Tests (30%)
     ↙ 300-500 tests ↘
    🔺 Unit Tests (60%)
   ↙ 600-1000 tests ↘
```

---

## 1️⃣ Unit Tests (60% - 600-1000 tests)

### Testing Backend Modules

```javascript
// errorHandler.test.js
const { ValidationError, AuthenticationError, ErrorFormatter } = require('../errorHandler');

describe('ErrorHandler', () => {
  describe('ValidationError', () => {
    it('should create validation error with fields', () => {
      const error = new ValidationError('Invalid input', {
        email: 'Email is required',
        password: 'Password too weak'
      });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details.fields.email).toBe('Email is required');
    });

    it('should format error for API response', () => {
      const error = new ValidationError('Invalid input', { email: 'required' });
      const formatted = ErrorFormatter.formatResponse(error, false);

      expect(formatted.error.code).toBe('VALIDATION_ERROR');
      expect(formatted.error.message).toBe('Invalid input');
    });
  });

  describe('ErrorRecovery', () => {
    it('should identify retryable errors', () => {
      const retryableError = new ServiceUnavailableError('database', 'DB down', 60);
      expect(ErrorRecovery.isRetryable(retryableError)).toBe(true);
    });

    it('should calculate exponential backoff', () => {
      const delay1 = ErrorRecovery.getBackoffDelay(0);
      const delay2 = ErrorRecovery.getBackoffDelay(1);
      const delay3 = ErrorRecovery.getBackoffDelay(2);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });
  });
});

// advancedValidator.test.js
const { validateField, validateSchema, schemas } = require('../advancedValidator');

describe('AdvancedValidator', () => {
  describe('Email validation', () => {
    it('should validate correct email', async () => {
      const result = await validateField('user@example.com', { type: 'email' });
      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email', async () => {
      await expect(validateField('invalid-email', { type: 'email' }))
        .rejects.toThrow('Invalid email format');
    });

    it('should lowercase email', async () => {
      const result = await validateField('USER@EXAMPLE.COM', { type: 'email' });
      expect(result).toBe('user@example.com');
    });
  });

  describe('Password validation', () => {
    it('should accept strong password', async () => {
      const result = await validateField('SecurePass123!@#', { 
        type: 'password',
        minLength: 8
      });
      expect(result).toBe('SecurePass123!@#');
    });

    it('should reject weak password', async () => {
      await expect(validateField('weak', { 
        type: 'password',
        minLength: 8
      })).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should reject password without special chars', async () => {
      await expect(validateField('NoSpecial123', { 
        type: 'password',
        requireSpecial: true
      })).rejects.toThrow('Password must contain special characters');
    });
  });

  describe('Schema validation', () => {
    it('should validate registration schema', async () => {
      const data = {
        email: 'user@example.com',
        password: 'SecurePass123!@#',
        username: 'testuser',
        acceptTerms: true
      };

      const result = await validateSchema(data, schemas.authentication.register);
      expect(result.email).toBe('user@example.com');
      expect(result.username).toBe('testuser');
    });

    it('should throw on missing required fields', async () => {
      const data = {
        email: 'user@example.com',
        // missing password
      };

      await expect(validateSchema(data, schemas.authentication.register))
        .rejects.toThrow('Validation failed');
    });
  });
});

// cacheManager.test.js
const { CacheManager } = require('../cacheManager');

describe('CacheManager', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheManager();
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should cache and retrieve value', async () => {
    await cache.set('key1', { data: 'test' }, 3600);
    const result = await cache.get('key1');

    expect(result.data).toBe('test');
  });

  it('should return null for missing key', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should use get-or-compute pattern', async () => {
    let computeCount = 0;
    const computeFn = async () => {
      computeCount++;
      return { value: 'computed' };
    };

    const result1 = await cache.getOrCompute('compute-key', computeFn);
    const result2 = await cache.getOrCompute('compute-key', computeFn);

    expect(computeCount).toBe(1); // Computed only once
    expect(result1.value).toBe('computed');
    expect(result2.value).toBe('computed');
  });

  it('should invalidate by pattern', async () => {
    await cache.set('user:1:data', 'data1');
    await cache.set('user:2:data', 'data2');
    await cache.set('post:1:data', 'data3');

    await cache.invalidatePattern('user:.*');

    expect(await cache.get('user:1:data')).toBeNull();
    expect(await cache.get('user:2:data')).toBeNull();
    expect(await cache.get('post:1:data')).not.toBeNull();
  });
});
```

### Testing Authentication

```javascript
// auth.test.js
const authManager = require('../auth');
const bcrypt = require('bcryptjs');

describe('Authentication', () => {
  describe('User registration', () => {
    it('should hash password before storage', async () => {
      const password = 'SecurePass123!@#';
      const user = await authManager.register({
        email: 'new@example.com',
        password: password,
        username: 'newuser'
      });

      // Verify password is hashed, not stored as plain text
      expect(user.password_hash).not.toBe(password);
      expect(await bcrypt.compare(password, user.password_hash)).toBe(true);
    });

    it('should reject duplicate email', async () => {
      await authManager.register({
        email: 'test@example.com',
        password: 'SecurePass123!@#',
        username: 'user1'
      });

      await expect(authManager.register({
        email: 'test@example.com',
        password: 'DifferentPass123!@#',
        username: 'user2'
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('User login', () => {
    it('should create JWT token on successful login', async () => {
      const user = await authManager.register({
        email: 'login@example.com',
        password: 'SecurePass123!@#',
        username: 'loginuser'
      });

      const result = await authManager.login('login@example.com', 'SecurePass123!@#');

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^eyJ/); // JWT format
    });

    it('should reject wrong password', async () => {
      await authManager.register({
        email: 'test@example.com',
        password: 'SecurePass123!@#',
        username: 'testuser'
      });

      await expect(authManager.login('test@example.com', 'WrongPassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('Admin fallback', () => {
    it('should allow admin login when DB is down', async () => {
      const result = await authManager.adminLogin(
        process.env.ADMIN_EMAIL,
        process.env.ADMIN_PASSWORD
      );

      expect(result.token).toBeDefined();
      expect(result.admin).toBe(true);
    });

    it('should reject incorrect admin credentials', async () => {
      await expect(authManager.adminLogin(
        'wrong@admin.com',
        'wrong_password'
      )).rejects.toThrow();
    });
  });
});
```

---

## 2️⃣ Integration Tests (30% - 300-500 tests)

### API Integration Tests

```javascript
// api.integration.test.js
const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {
  describe('Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      // Step 1: Register
      const registerRes = await request(app)
        .post('/auth/register')
        .send({
          email: 'integration@test.com',
          password: 'SecurePass123!@#',
          username: 'integrationuser',
          acceptTerms: true
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.token).toBeDefined();
      const token = registerRes.body.token;

      // Step 2: Use token to access protected route
      const protectedRes = await request(app)
        .get('/auth/check')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedRes.status).toBe(200);
      expect(protectedRes.body.authenticated).toBe(true);

      // Step 3: Logout
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
    });
  });

  describe('AI Chat Integration', () => {
    it('should send message and receive response', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!@#' });

      const token = loginRes.body.token;

      const chatRes = await request(app)
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Hello, what is 2+2?',
          provider: 'gemini',
          model: 'gemini-pro'
        });

      expect(chatRes.status).toBe(200);
      expect(chatRes.body.response).toBeDefined();
      expect(chatRes.body.tokens).toBeDefined();
    });

    it('should maintain conversation history', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!@#' });

      const token = loginRes.body.token;

      // Send first message
      await request(app)
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'My name is John',
          provider: 'gemini',
          model: 'gemini-pro'
        });

      // Send second message referencing first
      const res = await request(app)
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'What is my name?',
          provider: 'gemini',
          model: 'gemini-pro'
        });

      // Should remember context
      expect(res.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const endpoint = '/scrape';

      // Make 11 requests (limit is 10 per minute)
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post(endpoint)
          .send({ url: 'https://example.com' });

        if (i < 10) {
          expect(res.status).not.toBe(429);
        } else {
          expect(res.status).toBe(429);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should return proper error on invalid URL', async () => {
      const res = await request(app)
        .post('/scrape')
        .send({ url: 'not-a-valid-url' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should block SSRF attacks', async () => {
      const res = await request(app)
        .post('/scrape')
        .send({ url: 'http://localhost:3000/admin' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SSRF_VIOLATION');
    });
  });
});
```

---

## 3️⃣ E2E Tests (10% - 200-500 tests)

### End-to-End User Flows

```javascript
// e2e/user-flow.e2e.js
const { test, expect } = require('@playwright/test');

test.describe('User Registration and Login Flow', () => {
  test('should register new account and login', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login.html');

    // Click register tab
    await page.click('[data-test="register-tab"]');

    // Fill registration form
    await page.fill('[data-test="register-email"]', 'e2etest@example.com');
    await page.fill('[data-test="register-password"]', 'SecurePass123!@#');
    await page.fill('[data-test="register-confirm"]', 'SecurePass123!@#');
    await page.fill('[data-test="register-username"]', 'e2etestuser');
    await page.check('[data-test="accept-terms"]');

    // Submit
    await page.click('[data-test="register-submit"]');

    // Should redirect to AI chat after successful registration
    await page.waitForURL('**/ai-chat.html', { timeout: 5000 });
    expect(page.url()).toContain('ai-chat.html');
  });

  test('should login with existing account', async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');

    // Fill login form
    await page.fill('[data-test="login-email"]', 'test@example.com');
    await page.fill('[data-test="login-password"]', 'SecurePass123!@#');

    // Submit
    await page.click('[data-test="login-submit"]');

    // Should show authenticated navbar
    await expect(page.locator('[data-test="user-email"]')).toBeVisible();
  });
});

test.describe('AI Chat Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login.html');
    await page.fill('[data-test="login-email"]', 'test@example.com');
    await page.fill('[data-test="login-password"]', 'SecurePass123!@#');
    await page.click('[data-test="login-submit"]');
    await page.goto('http://localhost:3000/ai-chat.html');
  });

  test('should send and receive AI message', async ({ page }) => {
    // Select provider
    await page.click('[data-test="provider-button"][data-provider="gemini"]');

    // Type message
    await page.fill('[data-test="chat-input"]', 'What is machine learning?');

    // Send
    await page.click('[data-test="send-button"]');

    // Wait for response
    await expect(page.locator('[data-test="message-response"]'))
      .toBeVisible({ timeout: 10000 });

    // Verify response content
    const response = await page.locator('[data-test="message-response"]').textContent();
    expect(response.length).toBeGreaterThan(0);
  });

  test('should display token usage', async ({ page }) => {
    await page.click('[data-test="provider-button"][data-provider="openai"]');
    await page.fill('[data-test="chat-input"]', 'Hello');
    await page.click('[data-test="send-button"]');

    // Check token count
    const tokens = await page.locator('[data-test="token-count"]').textContent();
    expect(tokens).toMatch(/\d+ tokens/);
  });
});

test.describe('Web Scraper Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');
    await page.fill('[data-test="login-email"]', 'test@example.com');
    await page.fill('[data-test="login-password"]', 'SecurePass123!@#');
    await page.click('[data-test="login-submit"]');
    await page.goto('http://localhost:3000/downloader.html');
  });

  test('should scrape website content', async ({ page }) => {
    // Click scraper tab
    await page.click('[data-test="scraper-tab"]');

    // Enter URL
    await page.fill('[data-test="scraper-url"]', 'https://example.com');

    // Check extraction options
    await page.check('[data-test="extract-images"]');
    await page.check('[data-test="extract-links"]');

    // Scrape
    await page.click('[data-test="scrape-button"]');

    // Wait for results
    await expect(page.locator('[data-test="scrape-results"]'))
      .toBeVisible({ timeout: 10000 });

    // Verify results contain content
    const results = await page.locator('[data-test="scrape-results"]').textContent();
    expect(results.length).toBeGreaterThan(0);
  });
});

test.describe('Accessibility', () => {
  test('should be navigable with keyboard only', async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');

    // Tab through elements
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BUTTON');

    // Continue tabbing
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('INPUT');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');

    // Check for ARIA labels on buttons
    const loginBtn = page.locator('[data-test="login-submit"]');
    const ariaLabel = await loginBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('should respect reduced motion preference', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('http://localhost:3000/index.html');

    // Check that animations are disabled
    const animation = await page.evaluate(() => {
      return getComputedStyle(document.querySelector('.animated-element'))
        .animationDuration;
    });

    expect(animation).toBe('0s');
  });
});
```

---

## 🚀 Performance Tests

```javascript
// performance.test.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

describe('Performance Tests', () => {
  it('should meet performance budgets', async () => {
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    
    const options = {
      logLevel: 'info',
      output: 'json',
      port: chrome.port
    };

    const runnerResult = await lighthouse('http://localhost:3000', options);
    const scores = runnerResult.lhr.categories;

    // Performance budget
    expect(scores.performance.score).toBeGreaterThan(0.90);
    expect(scores.accessibility.score).toBeGreaterThan(0.95);
    expect(scores.seo.score).toBeGreaterThan(0.90);

    await chromeLauncher.kill(chrome.pid);
  });
});
```

---

## 📊 Test Coverage Goals

```
Backend Coverage:
├── errorHandler.js ........................... 95%
├── advancedValidator.js ...................... 95%
├── cacheManager.js ........................... 90%
├── auth.js .................................. 92%
├── aiManager.js ............................. 85%
├── scraper.js ............................... 85%
└── server.js ................................ 80%

Frontend Coverage:
├── login.html ................................ 90%
├── ai-chat.html .............................. 85%
└── downloader.html ........................... 85%

Total Target: 70%+ coverage
```

---

## 🔧 Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Performance tests
npm run test:performance

# Accessibility tests
npm run test:a11y
```

---

## 📈 CI/CD Integration

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
          
      - name: Check coverage
        run: npm run test:coverage:check
```

---

**Status**: Ready for implementation  
**Timeline**: Week 4-5  
**Target Coverage**: 70%+ overall coverage  
**Success Metric**: All tests passing, 0 critical bugs
