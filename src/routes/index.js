const express = require('express');

/**
 * Main Routes class that handles authentication setup and route organization
 * Provides session management, CSRF protection, and route protection functionality
 */
class Routes {
    /**
     * Setup authentication system with session middleware and CSRF protection
     * @param {Express} app - Express application instance
     * @param {Object} options - Configuration options
     * @param {string[]} options.protectedPaths - Array of paths to protect
     * @param {boolean} options.enableAuth - Enable/disable authentication
     * @param {string} options.sessionSecret - Session secret key
     * @param {string} options.csrfSecret - CSRF secret key
     */
    static setupAuthentication(app, options = {}) {
        const {
            protectedPaths = [],
            enableAuth = true,
            sessionSecret = process.env.SESSION_SECRET || 'default-dev-secret',
            csrfSecret = process.env.CSRF_SECRET || 'default-csrf-secret'
        } = options;

        console.log('Initializing Routes authentication system...');
        console.log(`Authentication enabled: ${enableAuth}`);
        console.log(`Protected paths: ${protectedPaths.length} paths`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

        // Check environment-based authentication settings
        const authDisabled = process.env.DISABLE_AUTH === 'true';
        const isDevelopment = process.env.NODE_ENV === 'development';

        if (!enableAuth || authDisabled) {
            console.log('⚠️  Authentication disabled - all routes are accessible');

            // Still setup authentication routes for testing/development
            if (isDevelopment) {
                const AuthRoutes = require('./authRoutes');
                const authRoutes = new AuthRoutes();
                authRoutes.setupRoutes(app, '/api/auth');
                console.log('🔧 Authentication routes available for development testing');
            }

            return;
        }

        try {
            // Configure session middleware
            this.configureSession(app, { sessionSecret });

            // Setup CSRF protection
            this.setupCSRFProtection(app, { csrfSecret });

            // Setup authentication routes (lazy load to avoid circular dependency)
            const AuthRoutes = require('./authRoutes');
            const authRoutes = new AuthRoutes();
            authRoutes.setupRoutes(app, '/api/auth');

            // Apply route protection
            this.protectRoutes(app, protectedPaths);

            console.log('✅ Authentication system configured successfully');
        } catch (error) {
            console.error('❌ Failed to setup authentication:', error.message);

            // In development, log the error but don't crash
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️  Continuing without authentication in development mode');
                return;
            }

            throw error;
        }
    }

    /**
     * Configure Express session middleware
     * @param {Express} app - Express application instance
     * @param {Object} options - Session configuration options
     */
    static configureSession(app, options = {}) {
        const { sessionSecret } = options;

        try {
            const session = require('express-session');

            const sessionConfig = {
                secret: sessionSecret,
                resave: false,
                saveUninitialized: false,
                cookie: {
                    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                    httpOnly: true, // Prevent XSS attacks
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    sameSite: 'strict' // CSRF protection
                },
                name: 'sessionId' // Don't use default session name
            };

            // Apply session middleware
            app.use(session(sessionConfig));

            console.log('📝 Session middleware configured and applied');
        } catch (error) {
            console.error('Failed to configure session:', error.message);
            throw error;
        }
    }

    /**
     * Setup CSRF protection middleware
     * @param {Express} app - Express application instance
     * @param {Object} options - CSRF configuration options
     */
    static setupCSRFProtection(app, options = {}) {
        const { csrfSecret } = options;

        try {
            const csrf = require('csurf');

            // CSRF protection using session (not cookies) since we have session middleware
            const csrfConfig = {
                ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
                value: (req) => {
                    return req.body._csrf ||
                        req.query._csrf ||
                        req.headers['x-csrf-token'] ||
                        req.headers['x-xsrf-token'];
                }
            };

            // Apply CSRF protection middleware
            app.use(csrf(csrfConfig));

            console.log('🛡️  CSRF protection middleware configured and applied');
        } catch (error) {
            console.error('Failed to setup CSRF protection:', error.message);
            throw error;
        }
    }

    /**
     * Apply route protection to specified paths
     * @param {Express} app - Express application instance
     * @param {string[]} protectedPaths - Array of paths to protect
     */
    static protectRoutes(app, protectedPaths = []) {
        if (!protectedPaths.length) {
            console.log('No protected paths specified');
            return;
        }

        try {
            // Create authentication middleware
            const authMiddleware = this.createAuthMiddleware();

            // Apply protection to each specified path
            protectedPaths.forEach(path => {
                app.use(path, authMiddleware);
                console.log(`🔒 Protected route: ${path}`);
            });

            console.log(`✅ Route protection applied to ${protectedPaths.length} paths`);
        } catch (error) {
            console.error('Failed to protect routes:', error.message);
            throw error;
        }
    }

    /**
     * Create authentication middleware function
     * @returns {Function} Express middleware function
     */
    static createAuthMiddleware() {
        return (req, res, next) => {
            // Check if authentication is disabled via environment variable
            if (process.env.DISABLE_AUTH === 'true') {
                console.log('🔓 Authentication bypassed - disabled via DISABLE_AUTH');
                return next();
            }

            try {
                // Check session-based authentication
                const authResult = this.checkAuthentication(req);

                if (!authResult.isAuthenticated) {
                    console.log(`🚫 Authentication failed: ${authResult.reason}`);
                    return res.status(401).json({
                        success: false,
                        error: 'Authentication required',
                        code: 'UNAUTHORIZED',
                        timestamp: new Date().toISOString()
                    });
                }

                // Validate CSRF token for state-changing requests
                if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
                    const csrfResult = this.validateCSRFToken(req);

                    if (!csrfResult.isValid) {
                        console.log(`🛡️  CSRF validation failed: ${csrfResult.reason}`);
                        return res.status(419).json({
                            success: false,
                            error: 'CSRF token validation failed',
                            code: 'CSRF_TOKEN_MISMATCH',
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // Add authentication info to request
                req.auth = {
                    isAuthenticated: true,
                    user: authResult.user,
                    sessionId: authResult.sessionId
                };

                console.log(`✅ Authentication successful for user: ${authResult.user?.id || 'anonymous'}`);
                next();
            } catch (error) {
                console.error('❌ Authentication middleware error:', error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Authentication system error',
                    code: 'AUTH_SYSTEM_ERROR',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Check if request is authenticated
     * @param {Request} req - Express request object
     * @returns {Object} Authentication result with status and details
     */
    static checkAuthentication(req) {
        // Environment-based authentication bypass
        if (process.env.DISABLE_AUTH === 'true') {
            return {
                isAuthenticated: true,
                user: { id: 'dev-user', role: 'admin' },
                sessionId: 'dev-session',
                reason: 'Authentication disabled'
            };
        }

        try {
            // Check for session data (when session middleware is available)
            if (req.session) {
                // Validate session
                if (req.session.user && req.session.authenticated === true) {
                    // Check session expiry
                    const now = Date.now();
                    const sessionExpiry = req.session.expiresAt || (now + 24 * 60 * 60 * 1000);

                    if (now > sessionExpiry) {
                        return {
                            isAuthenticated: false,
                            reason: 'Session expired'
                        };
                    }

                    // Update session activity
                    req.session.lastActivity = now;

                    return {
                        isAuthenticated: true,
                        user: req.session.user,
                        sessionId: req.session.id,
                        reason: 'Valid session'
                    };
                }
            }

            // Check for basic authentication header (fallback)
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Basic ')) {
                const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
                const [username, password] = credentials.split(':');

                // Simple credential check (in production, this would hash and compare)
                const validCredentials = this.validateCredentials(username, password);

                if (validCredentials) {
                    return {
                        isAuthenticated: true,
                        user: { id: username, role: 'user' },
                        sessionId: 'basic-auth',
                        reason: 'Basic authentication'
                    };
                }
            }

            // Check for API key authentication
            const apiKey = req.headers['x-api-key'] || (req.query && req.query.apiKey);
            if (apiKey) {
                const validApiKey = this.validateApiKey(apiKey);

                if (validApiKey) {
                    return {
                        isAuthenticated: true,
                        user: { id: 'api-user', role: 'api' },
                        sessionId: 'api-key',
                        reason: 'API key authentication'
                    };
                }
            }

            return {
                isAuthenticated: false,
                reason: 'No valid authentication found'
            };
        } catch (error) {
            console.error('Authentication check error:', error.message);
            return {
                isAuthenticated: false,
                reason: 'Authentication system error'
            };
        }
    }

    /**
     * Generate CSRF token for forms
     * @param {Request} req - Express request object
     * @returns {string} CSRF token
     */
    static generateCSRFToken(req) {
        try {
            // When session middleware is available, use session-based token
            if (req.session) {
                if (!req.session.csrfToken) {
                    // Generate a new token based on session ID and timestamp
                    const sessionId = req.session.id || 'no-session';
                    const timestamp = Date.now();
                    const secret = process.env.CSRF_SECRET || 'default-csrf-secret';

                    // Simple token generation (in production, use crypto.randomBytes)
                    req.session.csrfToken = Buffer.from(`${sessionId}-${timestamp}-${secret}`).toString('base64');
                }
                return req.session.csrfToken;
            }

            // Fallback token generation for development
            const userAgent = req.headers['user-agent'] || 'unknown';
            const timestamp = Date.now();
            const secret = process.env.CSRF_SECRET || 'default-csrf-secret';

            return Buffer.from(`${userAgent}-${timestamp}-${secret}`).toString('base64').slice(0, 32);
        } catch (error) {
            console.error('CSRF token generation error:', error.message);
            return 'fallback-csrf-token';
        }
    }

    /**
     * Validate CSRF token from request
     * @param {Request} req - Express request object
     * @returns {Object} CSRF validation result
     */
    static validateCSRFToken(req) {
        try {
            // Skip CSRF validation if disabled
            if (process.env.DISABLE_CSRF === 'true' || process.env.NODE_ENV === 'development') {
                return {
                    isValid: true,
                    reason: 'CSRF validation disabled'
                };
            }

            // Extract CSRF token from various sources
            const token = req.body._csrf ||
                req.query._csrf ||
                req.headers['x-csrf-token'] ||
                req.headers['x-xsrf-token'];

            if (!token) {
                return {
                    isValid: false,
                    reason: 'CSRF token missing'
                };
            }

            // When session middleware is available, validate against session token
            if (req.session && req.session.csrfToken) {
                const isValid = token === req.session.csrfToken;
                return {
                    isValid,
                    reason: isValid ? 'Valid CSRF token' : 'Invalid CSRF token'
                };
            }

            // Fallback validation for development (simple token check)
            const expectedToken = this.generateCSRFToken(req);
            const isValid = token === expectedToken;

            return {
                isValid,
                reason: isValid ? 'Valid CSRF token (fallback)' : 'Invalid CSRF token (fallback)'
            };
        } catch (error) {
            console.error('CSRF validation error:', error.message);
            return {
                isValid: false,
                reason: 'CSRF validation system error'
            };
        }
    }

    /**
     * Validate user credentials (basic authentication)
     * @param {string} username - Username to validate
     * @param {string} password - Password to validate
     * @returns {boolean} Credential validity
     */
    static validateCredentials(username, password) {
        // In production, this would check against a database with hashed passwords
        // For development, use simple environment-based credentials
        const validUsername = process.env.AUTH_USERNAME || 'admin';
        const validPassword = process.env.AUTH_PASSWORD || 'password';

        return username === validUsername && password === validPassword;
    }

    /**
     * Validate API key
     * @param {string} apiKey - API key to validate
     * @returns {boolean} API key validity
     */
    static validateApiKey(apiKey) {
        // In production, this would check against a database of valid API keys
        const validApiKeys = (process.env.VALID_API_KEYS || '').split(',').filter(key => key.trim());

        if (validApiKeys.length === 0) {
            // Default API key for development
            return apiKey === 'dev-api-key-12345';
        }

        return validApiKeys.includes(apiKey);
    }

    /**
     * Create login middleware for authentication endpoints
     * @returns {Function} Express middleware function
     */
    static createLoginMiddleware() {
        return (req, res, next) => {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Username and password required',
                    code: 'MISSING_CREDENTIALS'
                });
            }

            const isValid = this.validateCredentials(username, password);

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Set session data (when session middleware is available)
            if (req.session) {
                req.session.authenticated = true;
                req.session.user = { id: username, role: 'user' };
                req.session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                req.session.lastActivity = Date.now();
            }

            req.auth = {
                isAuthenticated: true,
                user: { id: username, role: 'user' }
            };

            next();
        };
    }

    /**
     * Create logout middleware
     * @returns {Function} Express middleware function
     */
    static createLogoutMiddleware() {
        return (req, res, next) => {
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destruction error:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Logout failed',
                            code: 'LOGOUT_ERROR'
                        });
                    }

                    res.clearCookie('sessionId');
                    res.json({
                        success: true,
                        message: 'Logged out successfully'
                    });
                });
            } else {
                res.json({
                    success: true,
                    message: 'Logged out successfully'
                });
            }
        };
    }

    /**
     * Create rate limiting middleware for authentication endpoints
     * @param {Object} options - Rate limiting options
     * @returns {Function} Express middleware function
     */
    static createRateLimitMiddleware(options = {}) {
        const {
            windowMs = 15 * 60 * 1000, // 15 minutes
            maxAttempts = 5,
            skipSuccessfulRequests = true
        } = options;

        // Simple in-memory rate limiting (in production, use Redis)
        const attempts = new Map();

        return (req, res, next) => {
            const clientId = req.ip || req.connection.remoteAddress || 'unknown';
            const now = Date.now();

            // Clean up old entries
            for (const [key, data] of attempts.entries()) {
                if (now - data.firstAttempt > windowMs) {
                    attempts.delete(key);
                }
            }

            const clientAttempts = attempts.get(clientId) || { count: 0, firstAttempt: now };

            // Check if client has exceeded rate limit
            if (clientAttempts.count >= maxAttempts) {
                const timeRemaining = windowMs - (now - clientAttempts.firstAttempt);

                return res.status(429).json({
                    success: false,
                    error: 'Too many authentication attempts',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil(timeRemaining / 1000),
                    timestamp: new Date().toISOString()
                });
            }

            // Increment attempt count
            clientAttempts.count++;
            attempts.set(clientId, clientAttempts);

            // Reset counter on successful authentication (if enabled)
            const originalEnd = res.end;
            res.end = function (chunk, encoding) {
                if (skipSuccessfulRequests && res.statusCode < 400) {
                    attempts.delete(clientId);
                }
                originalEnd.call(this, chunk, encoding);
            };

            next();
        };
    }

    /**
     * Get authentication status for a request
     * @param {Request} req - Express request object
     * @returns {Object} Authentication status information
     */
    static getAuthStatus(req) {
        const authResult = this.checkAuthentication(req);

        return {
            isAuthenticated: authResult.isAuthenticated,
            user: authResult.user || null,
            csrfToken: this.generateCSRFToken(req),
            sessionId: authResult.sessionId || null,
            authMethod: authResult.reason || 'none'
        };
    }
}

module.exports = Routes;
