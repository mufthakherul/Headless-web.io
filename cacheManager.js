/**
 * Advanced Multi-Layer Caching System
 * Combines memory, Redis, and HTTP caching for optimal performance
 * @module cacheManager
 */

const crypto = require('crypto');

/**
 * Multi-layer cache with memory → Redis → Database fallback
 */
class CacheManager {
    constructor(redisClient = null, options = {}) {
        this.redis = redisClient;
        this.memory = new Map();

        this.options = {
            maxMemoryItems: options.maxMemoryItems || 1000,
            defaultTTL: options.defaultTTL || 3600, // 1 hour
            cleanupInterval: options.cleanupInterval || 5 * 60 * 1000, // 5 minutes
            enableCompression: options.enableCompression !== false,
            ...options
        };

        // Start cleanup interval
        this.cleanupTimer = setInterval(() => this.cleanup(), this.options.cleanupInterval);
    }

    /**
     * Compute cache key
     */
    static computeKey(prefix, ...parts) {
        const combined = [prefix, ...parts].filter(p => p).join(':');
        return combined.replace(/\s+/g, '_');
    }

    /**
     * Get from cache with multi-layer fallback
     */
    async get(key) {
        try {
            // L1: Memory cache (fastest)
            if (this.memory.has(key)) {
                const cached = this.memory.get(key);
                if (!this.isExpired(cached)) {
                    return this.deserialize(cached.value);
                }
                this.memory.delete(key);
            }

            // L2: Redis cache (fast, distributed)
            if (this.redis) {
                const redisData = await this.redis.get(key);
                if (redisData) {
                    const deserialized = this.deserialize(redisData);
                    // Promote to memory
                    this.memory.set(key, {
                        value: redisData,
                        expiry: Date.now() + (this.options.defaultTTL * 1000)
                    });
                    return deserialized;
                }
            }

            return null;
        } catch (error) {
            console.error('Cache GET error:', error);
            return null;
        }
    }

    /**
     * Set in cache with multi-layer storage
     */
    async set(key, value, ttl = null) {
        try {
            ttl = ttl || this.options.defaultTTL;
            const serialized = this.serialize(value);
            const expiry = Date.now() + (ttl * 1000);

            // L1: Memory cache
            if (this.memory.size < this.options.maxMemoryItems) {
                this.memory.set(key, {
                    value: serialized,
                    expiry
                });
            } else {
                // Evict oldest if at capacity
                const firstKey = this.memory.keys().next().value;
                this.memory.delete(firstKey);
                this.memory.set(key, { value: serialized, expiry });
            }

            // L2: Redis cache
            if (this.redis) {
                await this.redis.setex(key, ttl, serialized);
            }

            return true;
        } catch (error) {
            console.error('Cache SET error:', error);
            return false;
        }
    }

    /**
     * Get or compute (cache-aside pattern)
     */
    async getOrCompute(key, computeFn, ttl = null) {
        try {
            // Try to get from cache
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }

            // Compute value
            const value = await computeFn();

            // Store in cache
            await this.set(key, value, ttl);

            return value;
        } catch (error) {
            console.error('Cache GET_OR_COMPUTE error:', error);
            // Return value anyway, let calling code handle cache miss
            return await computeFn();
        }
    }

    /**
     * Delete from cache
     */
    async delete(key) {
        try {
            this.memory.delete(key);
            if (this.redis) {
                await this.redis.del(key);
            }
            return true;
        } catch (error) {
            console.error('Cache DELETE error:', error);
            return false;
        }
    }

    /**
     * Invalidate by pattern
     */
    async invalidatePattern(pattern) {
        try {
            // Memory cache
            const regex = new RegExp(pattern);
            for (const [key] of this.memory) {
                if (regex.test(key)) {
                    this.memory.delete(key);
                }
            }

            // Redis cache
            if (this.redis) {
                const keys = await this.redis.keys(pattern);
                if (keys.length) {
                    await this.redis.del(...keys);
                }
            }

            return true;
        } catch (error) {
            console.error('Cache INVALIDATE_PATTERN error:', error);
            return false;
        }
    }

    /**
     * Clear all cache
     */
    async clear() {
        try {
            this.memory.clear();
            if (this.redis) {
                await this.redis.flushdb();
            }
            return true;
        } catch (error) {
            console.error('Cache CLEAR error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memoryItems: this.memory.size,
            maxMemoryItems: this.options.maxMemoryItems,
            memoryUsage: process.memoryUsage(),
            redisConnected: !!this.redis
        };
    }

    /**
     * Check if cached item is expired
     */
    isExpired(cached) {
        return cached.expiry && Date.now() > cached.expiry;
    }

    /**
     * Serialize value
     */
    serialize(value) {
        return JSON.stringify(value);
    }

    /**
     * Deserialize value
     */
    deserialize(value) {
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    /**
     * Cleanup expired items
     */
    cleanup() {
        const before = this.memory.size;
        for (const [key, cached] of this.memory) {
            if (this.isExpired(cached)) {
                this.memory.delete(key);
            }
        }
        const after = this.memory.size;
        if (after < before) {
            console.log(`[Cache] Cleaned up ${before - after} expired items`);
        }
    }

    /**
     * Shutdown cache
     */
    shutdown() {
        clearInterval(this.cleanupTimer);
    }
}

/**
 * HTTP Cache Control Helper
 */
class HTTPCacheControl {
    /**
     * Generate Cache-Control header
     */
    static generateHeader(options = {}) {
        const {
            isPublic = true,
            maxAge = 3600,
            sMaxAge = null,
            mustRevalidate = false,
            noCache = false,
            noStore = false,
            immutable = false,
            staleWhileRevalidate = null,
            staleIfError = null
        } = options;

        const directives = [];

        if (noStore) directives.push('no-store');
        if (noCache) directives.push('no-cache');

        directives.push(isPublic ? 'public' : 'private');

        if (maxAge !== null) directives.push(`max-age=${maxAge}`);
        if (sMaxAge !== null) directives.push(`s-maxage=${sMaxAge}`);
        if (mustRevalidate) directives.push('must-revalidate');
        if (immutable) directives.push('immutable');
        if (staleWhileRevalidate) directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
        if (staleIfError) directives.push(`stale-if-error=${staleIfError}`);

        return directives.join(', ');
    }

    /**
     * Middleware to set cache headers based on route
     */
    static middleware(cacheConfig = {}) {
        return (req, res, next) => {
            // Default config for different route patterns
            const config = {
                static: { maxAge: 31536000, immutable: true }, // 1 year
                api: { maxAge: 60, isPublic: false }, // 1 minute
                html: { maxAge: 300, isPublic: true }, // 5 minutes
                ...cacheConfig
            };

            // Determine cache config based on path
            let cacheConfig_item = config.api;

            if (req.path.match(/\.(js|css|png|jpg|gif|woff|svg)$/i)) {
                cacheConfig_item = config.static;
            } else if (req.path.match(/\.(html|htm)$/i)) {
                cacheConfig_item = config.html;
            }

            const header = HTTPCacheControl.generateHeader(cacheConfig_item);
            res.setHeader('Cache-Control', header);

            // Add ETag for conditional requests
            const etagValue = crypto.createHash('md5').update(req.url).digest('hex');
            res.setHeader('ETag', `"${etagValue}"`);

            next();
        };
    }
}

/**
 * Cache decorator for async functions
 */
function cacheDecorator(ttl = 3600, cacheManager = null) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args) {
            if (!cacheManager) return originalMethod.apply(this, args);

            const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
            const cached = await cacheManager.get(cacheKey);

            if (cached !== null) {
                return cached;
            }

            const result = await originalMethod.apply(this, args);
            await cacheManager.set(cacheKey, result, ttl);
            return result;
        };

        return descriptor;
    };
}

/**
 * Request-level caching middleware
 */
function requestCacheMiddleware(cacheManager, options = {}) {
    const { cacheMethods = ['GET'], cacheErrorResponses = false } = options;

    return async (req, res, next) => {
        // Only cache GET requests by default
        if (!cacheMethods.includes(req.method)) {
            return next();
        }

        const cacheKey = `http:${req.method}:${req.url}`;

        // Try to get from cache
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            return res.json(cached);
        }

        // Intercept res.json to cache response
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cacheManager.set(cacheKey, data, 60);
                res.setHeader('X-Cache', 'MISS');
            } else if (cacheErrorResponses && res.statusCode < 500) {
                cacheManager.set(cacheKey, data, 10);
            }

            return originalJson(data);
        };

        next();
    };
}

module.exports = {
    CacheManager,
    HTTPCacheControl,
    cacheDecorator,
    requestCacheMiddleware
};
