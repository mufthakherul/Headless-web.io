/**
 * Advanced Input Validation & Sanitization
 * Provides schema-based validation, sanitization, and custom rules
 * @module advancedValidator
 */

const { ValidationError, SSRFError, PayloadTooLargeError } = require('./errorHandler');

/**
 * Field type validators
 */
const fieldValidators = {
    // String validation
    string: (value, rules = {}) => {
        if (typeof value !== 'string') {
            throw new ValidationError('Must be a string', { field: 'string' });
        }

        const { min, max, pattern, enum: enumVals, transform } = rules;

        if (min && value.length < min) {
            throw new ValidationError(`Minimum length is ${min}`, { field: 'string' });
        }
        if (max && value.length > max) {
            throw new ValidationError(`Maximum length is ${max}`, { field: 'string' });
        }
        if (pattern && !pattern.test(value)) {
            throw new ValidationError(`Format is invalid`, { field: 'string' });
        }
        if (enumVals && !enumVals.includes(value)) {
            throw new ValidationError(`Must be one of: ${enumVals.join(', ')}`, { field: 'string' });
        }

        if (transform === 'lowercase') return value.toLowerCase();
        if (transform === 'uppercase') return value.toUpperCase();
        if (transform === 'trim') return value.trim();

        return value;
    },

    // Email validation
    email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            throw new ValidationError('Invalid email format', { field: 'email' });
        }
        return value.toLowerCase().trim();
    },

    // Password validation
    password: (value, rules = {}) => {
        const { minLength = 8, requireSpecial = true, requireNumbers = true, requireUppercase = true } = rules;

        if (value.length < minLength) {
            throw new ValidationError(`Password must be at least ${minLength} characters`, { field: 'password' });
        }

        if (requireNumbers && !/\d/.test(value)) {
            throw new ValidationError('Password must contain numbers', { field: 'password' });
        }

        if (requireUppercase && !/[A-Z]/.test(value)) {
            throw new ValidationError('Password must contain uppercase letters', { field: 'password' });
        }

        if (requireSpecial && !/[!@#$%^&*]/.test(value)) {
            throw new ValidationError('Password must contain special characters (!@#$%^&*)', { field: 'password' });
        }

        return value;
    },

    // URL validation with SSRF check
    url: async (value, rules = {}) => {
        try {
            const url = new URL(value);

            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new SSRFError('Only HTTP and HTTPS protocols allowed', value);
            }

            return url.toString();
        } catch (error) {
            if (error instanceof SSRFError) throw error;
            throw new ValidationError('Invalid URL format', { field: 'url', value: '***REDACTED***' });
        }
    },

    // Number validation
    number: (value, rules = {}) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            throw new ValidationError('Must be a valid number', { field: 'number' });
        }

        const { min, max, integer = false } = rules;

        if (integer && !Number.isInteger(num)) {
            throw new ValidationError('Must be an integer', { field: 'number' });
        }
        if (min !== undefined && num < min) {
            throw new ValidationError(`Minimum value is ${min}`, { field: 'number' });
        }
        if (max !== undefined && num > max) {
            throw new ValidationError(`Maximum value is ${max}`, { field: 'number' });
        }

        return num;
    },

    // Boolean validation
    boolean: (value) => {
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        throw new ValidationError('Must be a boolean', { field: 'boolean' });
    },

    // Array validation
    array: (value, rules = {}) => {
        if (!Array.isArray(value)) {
            throw new ValidationError('Must be an array', { field: 'array' });
        }

        const { min, max, items } = rules;

        if (min && value.length < min) {
            throw new ValidationError(`Minimum items is ${min}`, { field: 'array' });
        }
        if (max && value.length > max) {
            throw new ValidationError(`Maximum items is ${max}`, { field: 'array' });
        }

        if (items) {
            return value.map((item, index) => {
                try {
                    return validateField(item, items);
                } catch (error) {
                    throw new ValidationError(`Item ${index} is invalid: ${error.message}`, { field: 'array', index });
                }
            });
        }

        return value;
    },

    // Enum validation
    enum: (value, rules = {}) => {
        const { values } = rules;
        if (!values.includes(value)) {
            throw new ValidationError(`Must be one of: ${values.join(', ')}`, { field: 'enum', values });
        }
        return value;
    },

    // Date validation
    date: (value, rules = {}) => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new ValidationError('Invalid date format', { field: 'date' });
        }

        const { min, max } = rules;

        if (min && date < new Date(min)) {
            throw new ValidationError(`Date must be after ${min}`, { field: 'date' });
        }
        if (max && date > new Date(max)) {
            throw new ValidationError(`Date must be before ${max}`, { field: 'date' });
        }

        return date;
    }
};

/**
 * Sanitization functions
 */
const sanitizers = {
    /**
     * HTML entity encode to prevent XSS
     */
    htmlEscape: (str) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        return str.replace(/[&<>"'\/]/g, char => map[char]);
    },

    /**
     * Remove potentially dangerous HTML tags
     */
    stripHTML: (str) => {
        return str.replace(/<[^>]*>/g, '');
    },

    /**
     * Trim whitespace
     */
    trim: (str) => str.trim(),

    /**
     * Remove special characters
     */
    removeSpecial: (str) => {
        return str.replace(/[^a-zA-Z0-9\s-]/g, '');
    },

    /**
     * Normalize spacing
     */
    normalizeSpaces: (str) => {
        return str.replace(/\s+/g, ' ').trim();
    },

    /**
     * Convert to safe slug
     */
    toSlug: (str) => {
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }
};

/**
 * Validate a single field
 */
async function validateField(value, fieldSchema) {
    if (value === undefined || value === null) {
        if (fieldSchema.required) {
            throw new ValidationError('This field is required', { field: fieldSchema.name || 'unknown' });
        }
        return undefined;
    }

    const { type, ...rules } = fieldSchema;
    const validator = fieldValidators[type];

    if (!validator) {
        throw new Error(`Unknown validator type: ${type}`);
    }

    // Handle async validators
    if (type === 'url') {
        return await validator(value, rules);
    }

    return validator(value, rules);
}

/**
 * Validate entire schema
 */
async function validateSchema(data, schema) {
    const errors = {};
    const validated = {};

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        try {
            const value = data[fieldName];
            validated[fieldName] = await validateField(value, { ...fieldSchema, name: fieldName });
        } catch (error) {
            if (error instanceof ValidationError) {
                errors[fieldName] = error.message;
            } else {
                errors[fieldName] = error.message;
            }
        }
    }

    if (Object.keys(errors).length > 0) {
        throw new ValidationError('Validation failed', errors);
    }

    return validated;
}

/**
 * Pre-defined schemas
 */
const schemas = {
    authentication: {
        register: {
            email: {
                type: 'email',
                required: true
            },
            password: {
                type: 'password',
                required: true,
                minLength: 8,
                requireSpecial: true,
                requireNumbers: true,
                requireUppercase: true
            },
            username: {
                type: 'string',
                required: true,
                min: 3,
                max: 32,
                pattern: /^[a-zA-Z0-9_-]+$/
            },
            acceptTerms: {
                type: 'boolean',
                required: true
            }
        },

        login: {
            email: {
                type: 'email',
                required: true
            },
            password: {
                type: 'string',
                required: true
            },
            rememberMe: {
                type: 'boolean'
            }
        },

        changePassword: {
            currentPassword: {
                type: 'string',
                required: true
            },
            newPassword: {
                type: 'password',
                required: true,
                minLength: 8
            },
            confirmPassword: {
                type: 'string',
                required: true
            }
        }
    },

    content: {
        proxy: {
            url: {
                type: 'url',
                required: true
            },
            mode: {
                type: 'enum',
                required: true,
                values: ['fast', 'reader', 'live', 'snapshot', 'text', 'pdf', 'desktop']
            },
            quality: {
                type: 'enum',
                values: ['low', 'medium', 'high', 'maximum']
            }
        },

        scrape: {
            url: {
                type: 'url',
                required: true
            },
            extractImages: {
                type: 'boolean'
            },
            extractLinks: {
                type: 'boolean'
            },
            extractMetadata: {
                type: 'boolean'
            }
        },

        download: {
            url: {
                type: 'url',
                required: true
            },
            type: {
                type: 'enum',
                required: true,
                values: ['video', 'audio', 'image']
            },
            quality: {
                type: 'enum',
                values: ['low', 'medium', 'high', 'maximum']
            }
        },

        aiChat: {
            message: {
                type: 'string',
                required: true,
                min: 1,
                max: 10000
            },
            provider: {
                type: 'enum',
                required: true,
                values: ['gemini', 'openai', 'grok', 'deepseek', 'copilot']
            },
            model: {
                type: 'string',
                required: true
            }
        }
    },

    pagination: {
        page: {
            type: 'number',
            integer: true,
            min: 1
        },
        limit: {
            type: 'number',
            integer: true,
            min: 1,
            max: 100
        },
        sort: {
            type: 'string',
            pattern: /^-?[a-zA-Z0-9_]+$/
        }
    }
};

/**
 * Size limit validator
 */
function validatePayloadSize(payload, maxSizeBytes = 1048576) { // 1MB default
    const size = JSON.stringify(payload).length;
    if (size > maxSizeBytes) {
        throw new PayloadTooLargeError(maxSizeBytes, size);
    }
    return payload;
}

/**
 * Request body validator middleware
 */
function validateBody(schema) {
    return async (req, res, next) => {
        try {
            // Check payload size
            validatePayloadSize(req.body);

            // Validate schema
            req.validatedBody = await validateSchema(req.body, schema);
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Request query validator middleware
 */
function validateQuery(schema) {
    return async (req, res, next) => {
        try {
            req.validatedQuery = await validateSchema(req.query, schema);
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = {
    // Validators
    fieldValidators,
    sanitizers,

    // Functions
    validateField,
    validateSchema,
    validatePayloadSize,

    // Middleware
    validateBody,
    validateQuery,

    // Schemas
    schemas
};
