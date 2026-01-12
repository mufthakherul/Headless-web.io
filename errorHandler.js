/**
 * Advanced Error Handling System
 * Provides custom error classes, error formatting, and recovery strategies
 * @module errorHandler
 */

/**
 * Base custom error class
 */
class HeadlessError extends Error {
    constructor(message, code, statusCode = 500, details = {}) {
        super(message);
        this.name = 'HeadlessError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.requestId = details.requestId || null;
    }

    toJSON() {
        return {
            error: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            timestamp: this.timestamp,
            requestId: this.requestId
        };
    }
}

/**
 * Validation error - 400 Bad Request
 */
class ValidationError extends HeadlessError {
    constructor(message, fields = {}, details = {}) {
        super(message, 'VALIDATION_ERROR', 400, {
            fields,
            ...details
        });
        this.name = 'ValidationError';
    }
}

/**
 * Authentication error - 401 Unauthorized
 */
class AuthenticationError extends HeadlessError {
    constructor(message = 'Authentication failed', reason = 'INVALID_CREDENTIALS', details = {}) {
        super(message, `AUTH_${reason}`, 401, details);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization error - 403 Forbidden
 */
class AuthorizationError extends HeadlessError {
    constructor(message = 'Permission denied', requiredRole = null, details = {}) {
        super(message, 'AUTHORIZATION_ERROR', 403, {
            requiredRole,
            ...details
        });
        this.name = 'AuthorizationError';
    }
}

/**
 * Not found error - 404 Not Found
 */
class NotFoundError extends HeadlessError {
    constructor(resource, id = null, details = {}) {
        super(`${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND', 404, {
            resource,
            id,
            ...details
        });
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict error - 409 Conflict
 */
class ConflictError extends HeadlessError {
    constructor(message, resource = null, reason = null, details = {}) {
        super(message, 'CONFLICT', 409, {
            resource,
            reason,
            ...details
        });
        this.name = 'ConflictError';
    }
}

/**
 * Rate limit error - 429 Too Many Requests
 */
class RateLimitError extends HeadlessError {
    constructor(message = 'Rate limit exceeded', retryAfter = 60, details = {}) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, {
            retryAfter,
            ...details
        });
        this.name = 'RateLimitError';
    }
}

/**
 * Service unavailable error - 503 Service Unavailable
 */
class ServiceUnavailableError extends HeadlessError {
    constructor(service, message = null, retryAfter = 60, details = {}) {
        super(
            message || `Service '${service}' temporarily unavailable`,
            `SERVICE_UNAVAILABLE_${service.toUpperCase()}`,
            503,
            {
                service,
                retryAfter,
                ...details
            }
        );
        this.name = 'ServiceUnavailableError';
    }
}

/**
 * Database error - 500 Internal Server Error
 */
class DatabaseError extends HeadlessError {
    constructor(message = 'Database operation failed', operation = null, details = {}) {
        super(message, 'DATABASE_ERROR', 500, {
            operation,
            isDevelopment: process.env.NODE_ENV === 'development',
            ...details
        });
        this.name = 'DatabaseError';
    }
}

/**
 * External API error - 502 Bad Gateway
 */
class ExternalAPIError extends HeadlessError {
    constructor(apiName, statusCode = null, message = null, details = {}) {
        super(
            message || `Error communicating with ${apiName}`,
            `EXTERNAL_API_ERROR_${apiName.toUpperCase()}`,
            502,
            {
                apiName,
                apiStatusCode: statusCode,
                ...details
            }
        );
        this.name = 'ExternalAPIError';
    }
}

/**
 * Timeout error - 504 Gateway Timeout
 */
class TimeoutError extends HeadlessError {
    constructor(operation = 'Operation', timeoutMs = null, details = {}) {
        super(
            `${operation} timed out`,
            'TIMEOUT',
            504,
            {
                operation,
                timeoutMs,
                ...details
            }
        );
        this.name = 'TimeoutError';
    }
}

/**
 * SSRF error - 400 Bad Request
 */
class SSRFError extends HeadlessError {
    constructor(reason = 'URL blocked for security', url = null, details = {}) {
        super(reason, 'SSRF_VIOLATION', 400, {
            url: url ? '***REDACTED***' : null,
            ...details
        });
        this.name = 'SSRFError';
    }
}

/**
 * Validation failed error handler
 */
class PayloadTooLargeError extends HeadlessError {
    constructor(maxSize, currentSize, details = {}) {
        super(
            `Payload exceeds maximum size of ${maxSize} bytes`,
            'PAYLOAD_TOO_LARGE',
            413,
            {
                maxSize,
                currentSize,
                ...details
            }
        );
        this.name = 'PayloadTooLargeError';
    }
}

/**
 * Resource quota exceeded
 */
class QuotaExceededError extends HeadlessError {
    constructor(resource, limit, current = null, details = {}) {
        super(
            `${resource} quota exceeded (limit: ${limit}${current ? `, current: ${current}` : ''})`,
            'QUOTA_EXCEEDED',
            429,
            {
                resource,
                limit,
                current,
                ...details
            }
        );
        this.name = 'QuotaExceededError';
    }
}

/**
 * Error formatter for HTTP responses
 */
class ErrorFormatter {
    /**
     * Format error for API response
     */
    static formatResponse(error, isDevelopment = false) {
        if (error instanceof HeadlessError) {
            return {
                success: false,
                error: {
                    name: error.name,
                    code: error.code,
                    message: error.message,
                    statusCode: error.statusCode,
                    ...(isDevelopment && { details: error.details }),
                    ...(isDevelopment && error.stack && { stack: error.stack.split('\n') }),
                    timestamp: error.timestamp,
                    ...(error.requestId && { requestId: error.requestId })
                }
            };
        }

        // Handle standard JavaScript errors
        return {
            success: false,
            error: {
                name: error.name || 'Error',
                code: 'INTERNAL_ERROR',
                message: isDevelopment ? error.message : 'An unexpected error occurred',
                statusCode: 500,
                ...(isDevelopment && { details: { originalError: error.message } }),
                ...(isDevelopment && error.stack && { stack: error.stack.split('\n') }),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Format error for logging
     */
    static formatLog(error, context = {}) {
        return {
            timestamp: new Date().toISOString(),
            name: error.name,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            stack: error.stack,
            context,
            details: error.details
        };
    }

    /**
     * Format error for monitoring/alerting
     */
    static formatAlert(error, severity = 'error') {
        const isCritical = error.statusCode >= 500;

        return {
            severity: isCritical ? 'critical' : severity,
            title: `${error.name} (${error.code})`,
            message: error.message,
            timestamp: new Date().toISOString(),
            tags: {
                errorType: error.name,
                errorCode: error.code,
                statusCode: error.statusCode
            }
        };
    }
}

/**
 * Error recovery strategies
 */
class ErrorRecovery {
    /**
     * Determine if operation is retryable
     */
    static isRetryable(error) {
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.statusCode);
    }

    /**
     * Calculate exponential backoff delay
     */
    static getBackoffDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
        const delay = baseDelay * Math.pow(2, attempt);
        return Math.min(delay, maxDelay) + Math.random() * 1000;
    }

    /**
     * Suggest recovery action
     */
    static getSuggestion(error) {
        const suggestions = {
            'VALIDATION_ERROR': 'Please check your input and try again',
            'AUTH_INVALID_CREDENTIALS': 'Incorrect email or password',
            'AUTH_EXPIRED_TOKEN': 'Your session expired. Please login again',
            'AUTHORIZATION_ERROR': 'You do not have permission to perform this action',
            'NOT_FOUND': 'The requested resource does not exist',
            'CONFLICT': 'This resource already exists',
            'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait and try again',
            'SERVICE_UNAVAILABLE_DATABASE': 'Database is temporarily unavailable. Please try again later',
            'TIMEOUT': 'The operation took too long. Please try again',
            'SSRF_VIOLATION': 'This URL is not allowed for security reasons',
            'PAYLOAD_TOO_LARGE': 'Your request is too large. Please reduce the size and try again',
            'QUOTA_EXCEEDED': 'You have exceeded your resource quota'
        };

        return suggestions[error.code] || 'An error occurred. Please try again later';
    }
}

/**
 * Express error handling middleware
 */
function errorHandlingMiddleware(err, req, res, next) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;

    // Add request ID to error
    if (err instanceof HeadlessError) {
        err.requestId = requestId;
    }

    // Log error
    const logEntry = {
        ...ErrorFormatter.formatLog(err, {
            url: req.url,
            method: req.method,
            ip: req.ip,
            requestId
        })
    };

    if (err.statusCode >= 500) {
        console.error('[ERROR]', logEntry);
    } else {
        console.warn('[WARNING]', logEntry);
    }

    // Prepare response
    const statusCode = err.statusCode || 500;
    const response = ErrorFormatter.formatResponse(err, isDevelopment);

    // Add recovery suggestion
    response.suggestion = ErrorRecovery.getSuggestion(err);

    // Add retry info if applicable
    if (ErrorRecovery.isRetryable(err)) {
        response.retryable = true;
        response.retryAfter = err.details?.retryAfter || 60;
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Request-ID', requestId);

    if (err instanceof RateLimitError) {
        res.setHeader('Retry-After', err.details.retryAfter);
    }

    res.status(statusCode).json(response);
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Safe JSON parse with error handling
 */
function safeJSONParse(json, defaultValue = null) {
    try {
        return JSON.parse(json);
    } catch (error) {
        if (defaultValue !== null) return defaultValue;
        throw new ValidationError('Invalid JSON format', { json: '***REDACTED***' });
    }
}

module.exports = {
    // Error classes
    HeadlessError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    DatabaseError,
    ExternalAPIError,
    TimeoutError,
    SSRFError,
    PayloadTooLargeError,
    QuotaExceededError,

    // Error handling
    ErrorFormatter,
    ErrorRecovery,
    errorHandlingMiddleware,
    asyncHandler,
    safeJSONParse
};
