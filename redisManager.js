/**
 * Redis Integration for Distributed Sessions
 * Provides session storage and rate limiting with Redis
 */

const Redis = require('ioredis');
const logger = require('./logger');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };
  }

  async initialize() {
    if (this.client) {
      return this.client;
    }

    try {
      this.client = new Redis(this.redisConfig);

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected', { 
          host: this.redisConfig.host, 
          port: this.redisConfig.port 
        });
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis error', { error: error.message });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.info('Redis connection closed');
      });

      // Test connection
      await this.client.ping();
      
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Redis', { error: error.message });
      this.client = null;
      throw error;
    }
  }

  // Session Management
  async setSession(sessionId, data, ttl = 3600) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.setex(key, ttl, JSON.stringify(data));
      logger.info('Session stored in Redis', { sessionId, ttl });
    } catch (error) {
      logger.error('Failed to set session in Redis', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }

  async getSession(sessionId) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get session from Redis', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }

  async deleteSession(sessionId) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      logger.info('Session deleted from Redis', { sessionId });
    } catch (error) {
      logger.error('Failed to delete session from Redis', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }

  async getAllSessions() {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const keys = await this.client.keys('session:*');
      const sessions = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to get all sessions from Redis', { 
        error: error.message 
      });
      throw error;
    }
  }

  // Rate Limiting
  async checkRateLimit(key, limit, windowSeconds) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const rateLimitKey = `ratelimit:${key}`;
      const current = await this.client.incr(rateLimitKey);

      if (current === 1) {
        await this.client.expire(rateLimitKey, windowSeconds);
      }

      return {
        count: current,
        limit: limit,
        remaining: Math.max(0, limit - current),
        exceeded: current > limit
      };
    } catch (error) {
      logger.error('Failed to check rate limit in Redis', { 
        key, 
        error: error.message 
      });
      throw error;
    }
  }

  async resetRateLimit(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const rateLimitKey = `ratelimit:${key}`;
      await this.client.del(rateLimitKey);
    } catch (error) {
      logger.error('Failed to reset rate limit in Redis', { 
        key, 
        error: error.message 
      });
      throw error;
    }
  }

  // Cache Management
  async setCache(key, value, ttl = 300) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.client.setex(cacheKey, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to set cache in Redis', { 
        key, 
        error: error.message 
      });
      throw error;
    }
  }

  async getCache(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const cacheKey = `cache:${key}`;
      const data = await this.client.get(cacheKey);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get cache from Redis', { 
        key, 
        error: error.message 
      });
      throw error;
    }
  }

  async deleteCache(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.client.del(cacheKey);
    } catch (error) {
      logger.error('Failed to delete cache from Redis', { 
        key, 
        error: error.message 
      });
      throw error;
    }
  }

  // Pub/Sub for distributed events
  async publish(channel, message) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to publish to Redis', { 
        channel, 
        error: error.message 
      });
      throw error;
    }
  }

  subscribe(channel, callback) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    const subscriber = this.client.duplicate();
    
    subscriber.subscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis channel', { 
          channel, 
          error: err.message 
        });
      } else {
        logger.info('Subscribed to Redis channel', { channel });
      }
    });

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          logger.error('Failed to parse Redis message', { 
            channel, 
            error: error.message 
          });
        }
      }
    });

    return subscriber;
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async getStats() {
    if (!this.isConnected) {
      return {
        connected: false
      };
    }

    try {
      const info = await this.client.info();
      const sessionKeys = await this.client.keys('session:*');
      const cacheKeys = await this.client.keys('cache:*');
      const rateLimitKeys = await this.client.keys('ratelimit:*');

      return {
        connected: true,
        sessions: sessionKeys.length,
        cacheEntries: cacheKeys.length,
        rateLimits: rateLimitKeys.length,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', { error: error.message });
      return {
        connected: this.isConnected,
        error: error.message
      };
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const parsed = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          parsed[key] = value;
        }
      }
    }

    return {
      version: parsed.redis_version,
      uptime: parsed.uptime_in_seconds,
      connectedClients: parsed.connected_clients,
      usedMemory: parsed.used_memory_human,
      totalKeys: parsed.db0
    };
  }

  async shutdown() {
    logger.info('Shutting down Redis manager');
    
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;
