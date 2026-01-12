/**
 * Input Validation Module
 * Provides utility functions for validating and sanitizing user input
 */

/**
 * Validate URL format and length
 */
function isValidURL(urlString, maxLength = 2048) {
    if (!urlString || typeof urlString !== 'string') {
        return false;
    }

    if (urlString.length > maxLength) {
        return false;
    }

    try {
        new URL(urlString);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate session ID format
 */
function isValidSessionID(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
        return false;
    }

    // Session IDs should start with 'session_' or 'snap_' and be reasonable length
    return /^(session_|snap_)[a-f0-9]{32,}$/.test(sessionId);
}

/**
 * Sanitize string to prevent XSS
 */
function sanitizeString(str, maxLength = 1024) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    // Truncate if too long
    let sanitized = str.substring(0, maxLength);

    // HTML escape special characters
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

    return sanitized;
}

/**
 * Validate and extract JSON payload
 */
function validateJSONPayload(req, requiredFields = []) {
    const errors = {};

    // Check content-type
    if (req.is('application/json') === false && req.is('application/json; charset=utf-8') === false) {
        if (Object.keys(req.body).length > 0) {
            errors.contentType = 'Content-Type must be application/json';
        }
    }

    // Check required fields
    for (const field of requiredFields) {
        if (!req.body[field]) {
            errors[field] = `${field} is required`;
        }
    }

    // Check body size (limit 1MB)
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 1024 * 1024) {
        errors.bodySize = 'Request body exceeds maximum size of 1MB';
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Validate pagination parameters
 */
function validatePagination(page, limit, maxLimit = 100) {
    const errors = {};

    if (page !== undefined) {
        const pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) {
            errors.page = 'page must be a positive integer';
        }
    }

    if (limit !== undefined) {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > maxLimit) {
            errors.limit = `limit must be between 1 and ${maxLimit}`;
        }
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Validate screenshot format
 */
function isValidScreenshotFormat(format) {
    return ['png', 'jpeg', 'jpg', 'webp'].includes(format?.toLowerCase());
}

/**
 * Validate viewport dimensions
 */
function isValidViewport(viewport) {
    if (!viewport || typeof viewport !== 'object') {
        return false;
    }

    const { width, height } = viewport;
    return (
        Number.isInteger(width) && width > 0 && width <= 4096 &&
        Number.isInteger(height) && height > 0 && height <= 4096
    );
}

module.exports = {
    isValidURL,
    isValidSessionID,
    sanitizeString,
    validateJSONPayload,
    validatePagination,
    isValidScreenshotFormat,
    isValidViewport
};
