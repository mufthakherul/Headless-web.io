/**
 * Authentication Middleware
 * 
 * Middleware functions for protecting routes and verifying user authentication
 */

const authManager = require('./auth');
const logger = require('./logger');

/**
 * Authentication middleware - verifies JWT token and session
 */
async function authMiddleware(req, res, next) {
    try {
        // Get token from header or cookie
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided. Please login.'
            });
        }

        // Get session ID from cookie or header
        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

        // Verify session
        const verification = await authManager.verifySession(token, sessionId);

        if (!verification.valid) {
            return res.status(401).json({
                error: 'Invalid session',
                message: verification.error || 'Session expired or invalid'
            });
        }

        // Attach user to request
        req.user = verification.user;
        req.authenticated = true;

        next();
    } catch (error) {
        logger.error('Authentication middleware error', {
            error: error.message,
            path: req.path
        });

        res.status(500).json({
            error: 'Authentication error',
            message: 'Failed to verify authentication'
        });
    }
}

/**
 * Optional authentication middleware - doesn't block if not authenticated
 */
async function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : req.cookies?.token;

        if (token) {
            const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
            const verification = await authManager.verifySession(token, sessionId);

            if (verification.valid) {
                req.user = verification.user;
                req.authenticated = true;
            }
        }

        next();
    } catch (error) {
        logger.error('Optional auth middleware error', {
            error: error.message
        });
        next();
    }
}

/**
 * Admin role middleware - requires admin privileges
 */
function adminMiddleware(req, res, next) {
    if (!req.authenticated || !req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please login to access this resource'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }

    next();
}

/**
 * Check if user is authenticated (for client-side checks)
 */
async function checkAuth(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : req.cookies?.token;

        if (!token) {
            return res.json({
                authenticated: false,
                user: null
            });
        }

        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
        const verification = await authManager.verifySession(token, sessionId);

        if (verification.valid) {
            return res.json({
                authenticated: true,
                user: verification.user
            });
        }

        return res.json({
            authenticated: false,
            user: null
        });
    } catch (error) {
        logger.error('Check auth error', {
            error: error.message
        });

        return res.json({
            authenticated: false,
            user: null,
            error: error.message
        });
    }
}

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    adminMiddleware,
    checkAuth
};
