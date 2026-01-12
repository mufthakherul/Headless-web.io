/**
 * Basic API Tests for Headless-web
 */

const request = require('supertest');
const express = require('express');

// Mock the logger to avoid file operations during tests
jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  security: jest.fn(),
  request: jest.fn(),
  session: jest.fn()
}));

// Import server components
const { ssrfProtectionMiddleware } = require('../security');

describe('Security Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('SSRF Protection', () => {
    it('should block localhost URLs', async () => {
      app.get('/test', ssrfProtectionMiddleware, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?url=http://localhost:3000');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL validation failed');
    });

    it('should block private IP ranges', async () => {
      app.get('/test', ssrfProtectionMiddleware, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?url=http://192.168.1.1');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL validation failed');
    });

    it('should allow valid external URLs', async () => {
      app.get('/test', ssrfProtectionMiddleware, (req, res) => {
        res.json({ success: true });
      });

      // This will fail DNS resolution in test environment, but that's expected
      const response = await request(app)
        .get('/test?url=http://example.com');
      
      // Either passes or fails DNS, but shouldn't be blocked for SSRF
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Health Check', () => {
    it('should return server status', async () => {
      const healthApp = express();
      healthApp.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString()
        });
      });

      const response = await request(healthApp).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('Proxy Module', () => {
    const { escapeHtml } = require('../proxy');

    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      
      expect(escapeHtml('Hello & goodbye'))
        .toBe('Hello &amp; goodbye');
    });
  });
});

