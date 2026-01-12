/**
 * Authentication Module
 * 
 * Handles user authentication with PostgreSQL and fallback admin login
 * Supports JWT tokens and session management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('./database');
const logger = require('./logger');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@headless-web.io';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change in production!

class AuthManager {
    constructor() {
        this.sessions = new Map(); // In-memory sessions as fallback
        this.SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    /**
     * Hash password
     */
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }

    /**
     * Compare password with hash
     */
    async comparePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Generate JWT token
     */
    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            logger.warn('Token verification failed', { error: error.message });
            return null;
        }
    }

    /**
     * Admin fallback login (when DB is down)
     */
    async adminFallbackLogin(email, password) {
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            const adminUser = {
                id: -1, // Special ID for admin
                email: ADMIN_EMAIL,
                username: 'Admin',
                role: 'admin',
                fallback: true
            };

            const token = this.generateToken(adminUser);
            const sessionId = crypto.randomBytes(32).toString('hex');

            // Store in memory
            this.sessions.set(sessionId, {
                user: adminUser,
                token,
                createdAt: Date.now(),
                expiresAt: Date.now() + this.SESSION_TIMEOUT
            });

            logger.info('Admin fallback login successful', { email });

            return {
                success: true,
                user: adminUser,
                token,
                sessionId,
                message: 'Logged in with admin fallback (database disconnected)'
            };
        }

        return {
            success: false,
            error: 'Invalid admin credentials'
        };
    }

    /**
     * User login
     */
    async login(email, password, ipAddress, userAgent) {
        try {
            // Check if database is connected
            if (!database.isConnected()) {
                logger.warn('Database disconnected, attempting fallback login');
                return await this.adminFallbackLogin(email, password);
            }

            // Query user from database
            const result = await database.query(
                'SELECT * FROM users WHERE email = $1 AND is_active = true',
                [email]
            );

            if (result.rows.length === 0) {
                // Try fallback admin login
                return await this.adminFallbackLogin(email, password);
            }

            const user = result.rows[0];

            // Verify password
            const isValid = await this.comparePassword(password, user.password_hash);

            if (!isValid) {
                logger.warn('Invalid login attempt', { email, ipAddress });
                return {
                    success: false,
                    error: 'Invalid email or password'
                };
            }

            // Generate token
            const token = this.generateToken(user);
            const sessionId = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT);

            // Store session in database
            await database.query(
                `INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
                [user.id, sessionId, ipAddress, userAgent, expiresAt]
            );

            // Update last login
            await database.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            logger.info('User login successful', {
                userId: user.id,
                email: user.email,
                ipAddress
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                },
                token,
                sessionId,
                expiresAt
            };
        } catch (error) {
            logger.error('Login failed', {
                error: error.message,
                email
            });

            // Fallback to admin login on error
            if (email === ADMIN_EMAIL) {
                return await this.adminFallbackLogin(email, password);
            }

            return {
                success: false,
                error: 'Login failed. Please try again.'
            };
        }
    }

    /**
     * Register new user
     */
    async register(email, password, username = null) {
        try {
            if (!database.isConnected()) {
                return {
                    success: false,
                    error: 'Database not available. Cannot register new users.'
                };
            }

            // Check if user exists
            const existingUser = await database.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                return {
                    success: false,
                    error: 'Email already registered'
                };
            }

            // Hash password
            const passwordHash = await this.hashPassword(password);

            // Insert user
            const result = await database.query(
                `INSERT INTO users (email, password_hash, username, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, username, role, created_at`,
                [email, passwordHash, username, 'user']
            );

            const user = result.rows[0];

            logger.info('User registered successfully', {
                userId: user.id,
                email: user.email
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    createdAt: user.created_at
                }
            };
        } catch (error) {
            logger.error('Registration failed', {
                error: error.message,
                email
            });

            return {
                success: false,
                error: 'Registration failed. Please try again.'
            };
        }
    }

    /**
     * Logout user
     */
    async logout(sessionId, token) {
        try {
            // Remove from memory sessions
            this.sessions.delete(sessionId);

            // Remove from database if connected
            if (database.isConnected() && sessionId) {
                await database.query(
                    'DELETE FROM user_sessions WHERE session_token = $1',
                    [sessionId]
                );
            }

            logger.info('User logged out', { sessionId });

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            logger.error('Logout failed', {
                error: error.message,
                sessionId
            });

            return {
                success: false,
                error: 'Logout failed'
            };
        }
    }

    /**
     * Verify session
     */
    async verifySession(token, sessionId) {
        try {
            // Verify JWT token
            const decoded = this.verifyToken(token);

            if (!decoded) {
                return {
                    valid: false,
                    error: 'Invalid token'
                };
            }

            // Check memory sessions (fallback)
            if (this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId);
                if (session.expiresAt > Date.now()) {
                    return {
                        valid: true,
                        user: session.user
                    };
                }
                this.sessions.delete(sessionId);
                return {
                    valid: false,
                    error: 'Session expired'
                };
            }

            // Check database session
            if (database.isConnected() && sessionId) {
                const result = await database.query(
                    `SELECT us.*, u.email, u.username, u.role, u.is_active
           FROM user_sessions us
           JOIN users u ON us.user_id = u.id
           WHERE us.session_token = $1 AND us.expires_at > CURRENT_TIMESTAMP`,
                    [sessionId]
                );

                if (result.rows.length === 0) {
                    return {
                        valid: false,
                        error: 'Session not found or expired'
                    };
                }

                const session = result.rows[0];

                if (!session.is_active) {
                    return {
                        valid: false,
                        error: 'User account is inactive'
                    };
                }

                return {
                    valid: true,
                    user: {
                        id: session.user_id,
                        email: session.email,
                        username: session.username,
                        role: session.role
                    }
                };
            }

            // Token is valid but no session found - allow with token data only
            return {
                valid: true,
                user: {
                    id: decoded.id,
                    email: decoded.email,
                    username: decoded.username,
                    role: decoded.role
                }
            };
        } catch (error) {
            logger.error('Session verification failed', {
                error: error.message
            });

            return {
                valid: false,
                error: 'Session verification failed'
            };
        }
    }

    /**
     * Cleanup expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            // Clean memory sessions
            const now = Date.now();
            for (const [sessionId, session] of this.sessions.entries()) {
                if (session.expiresAt < now) {
                    this.sessions.delete(sessionId);
                }
            }

            // Clean database sessions
            if (database.isConnected()) {
                const result = await database.query(
                    'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP'
                );

                logger.debug('Cleaned up expired sessions', {
                    deletedCount: result.rowCount
                });
            }
        } catch (error) {
            logger.error('Session cleanup failed', {
                error: error.message
            });
        }
    }

    /**
     * Initialize admin user if not exists
     */
    async initializeAdminUser() {
        try {
            if (!database.isConnected()) {
                logger.warn('Database not connected, admin user initialization skipped');
                return;
            }

            // Check if admin exists
            const result = await database.query(
                'SELECT id FROM users WHERE email = $1',
                [ADMIN_EMAIL]
            );

            if (result.rows.length === 0) {
                // Create admin user
                const passwordHash = await this.hashPassword(ADMIN_PASSWORD);

                await database.query(
                    `INSERT INTO users (email, password_hash, username, role)
           VALUES ($1, $2, $3, $4)`,
                    [ADMIN_EMAIL, passwordHash, 'Admin', 'admin']
                );

                logger.info('Admin user created successfully', { email: ADMIN_EMAIL });
            }
        } catch (error) {
            logger.warn('Admin user initialization failed', {
                error: error.message
            });
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId) {
        try {
            if (!database.isConnected()) {
                return null;
            }

            const stats = await database.query(
                `SELECT 
          (SELECT COUNT(*) FROM chat_history WHERE user_id = $1) as chat_count,
          (SELECT COUNT(*) FROM download_history WHERE user_id = $1) as download_count,
          (SELECT SUM(size_bytes) FROM download_history WHERE user_id = $1 AND status = 'completed') as total_downloaded
         `,
                [userId]
            );

            return stats.rows[0] || null;
        } catch (error) {
            logger.error('Failed to get user stats', {
                error: error.message,
                userId
            });
            return null;
        }
    }
}

// Export singleton instance
module.exports = new AuthManager();
