/**
 * Database Configuration & Connection Manager
 * 
 * PostgreSQL database setup with fallback support
 * Manages connection pooling and health checks
 */

const { Pool } = require('pg');
const logger = require('./logger');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.connected = false;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'headless_web',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 20, // Maximum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        };
    }

    /**
     * Initialize database connection
     */
    async initialize() {
        try {
            this.pool = new Pool(this.config);

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.connected = true;
            logger.info('PostgreSQL database connected successfully', {
                host: this.config.host,
                database: this.config.database
            });

            // Create tables if they don't exist
            await this.createTables();

            return true;
        } catch (error) {
            this.connected = false;
            logger.warn('Database connection failed - running in fallback mode', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Create necessary database tables
     */
    async createTables() {
        if (!this.connected) return;

        try {
            // Users table
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          username VARCHAR(100),
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);

            // AI Chat history table
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          provider VARCHAR(50) NOT NULL,
          model VARCHAR(100),
          message TEXT NOT NULL,
          response TEXT,
          tokens_used INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          session_id VARCHAR(255)
        )
      `);

            // Download history table
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS download_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          type VARCHAR(50),
          filename VARCHAR(255),
          size_bytes BIGINT,
          status VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        )
      `);

            // User sessions table
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // API keys table (for AI providers)
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          key_name VARCHAR(100),
          encrypted_key TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used TIMESTAMP
        )
      `);

            // Create indexes for better performance
            await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
        CREATE INDEX IF NOT EXISTS idx_download_history_user ON download_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      `);

            logger.info('Database tables created/verified successfully');
        } catch (error) {
            logger.error('Failed to create database tables', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Execute a query with error handling
     */
    async query(text, params = []) {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            logger.debug('Query executed', {
                duration: `${duration}ms`,
                rows: result.rowCount
            });

            return result;
        } catch (error) {
            logger.error('Query failed', {
                error: error.message,
                query: text
            });
            throw error;
        }
    }

    /**
     * Get a client for transaction
     */
    async getClient() {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }
        return await this.pool.connect();
    }

    /**
     * Check if database is connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Health check
     */
    async healthCheck() {
        if (!this.connected || !this.pool) {
            return { status: 'disconnected', error: 'Database not initialized' };
        }

        try {
            const result = await this.pool.query('SELECT NOW(), current_database()');
            return {
                status: 'connected',
                database: result.rows[0].current_database,
                timestamp: result.rows[0].now
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Shutdown database connection
     */
    async shutdown() {
        if (this.pool) {
            try {
                await this.pool.end();
                this.connected = false;
                logger.info('Database connection closed');
            } catch (error) {
                logger.error('Error closing database connection', {
                    error: error.message
                });
            }
        }
    }
}

// Export singleton instance
module.exports = new DatabaseManager();
