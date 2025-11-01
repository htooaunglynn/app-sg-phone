const AuthService = require('../services/authService');

/**
 * Authentication Controller
 * Handles HTTP requests for user authentication, registration, and profile management
 */
class AuthController {
    constructor() {
        this.authService = new AuthService();

        // Setup periodic session cleanup (every 30 minutes)
        setInterval(() => {
            this.authService.cleanupExpiredSessions();
        }, 30 * 60 * 1000);
    }

    /**
     * User registration endpoint
     * POST /auth/register
     */
    async register(req, res) {
        try {
            const { name, email, password, confirmPassword } = req.body;

            // Get device and location info from request
            const deviceInfo = this.extractDeviceInfo(req);

            // Register user
            const result = await this.authService.register(
                { name, email, password, confirmPassword },
                deviceInfo
            );

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error,
                    code: result.code,
                    timestamp: new Date().toISOString()
                });
            }

            // Auto-login after successful registration
            const loginResult = await this.authService.login(
                { email, password },
                deviceInfo
            );

            if (loginResult.success) {
                // Set session cookie
                this.setSessionCookie(res, loginResult.sessionToken, loginResult.expiresAt);

                // Store session in request session if available
                if (req.session) {
                    req.session.authenticated = true;
                    req.session.user = loginResult.user;
                    req.session.sessionToken = loginResult.sessionToken;
                    req.session.expiresAt = loginResult.expiresAt;
                }
            }

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                user: result.user,
                sessionToken: loginResult.success ? loginResult.sessionToken : undefined,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Registration endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Registration failed',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * User login endpoint
     * POST /auth/login
     */
    async login(req, res) {
        try {
            const { email, password, rememberMe } = req.body;

            // Get device and location info from request
            const deviceInfo = this.extractDeviceInfo(req);

            // Authenticate user
            const result = await this.authService.login({ email, password }, deviceInfo);

            if (!result.success) {
                const statusCode = result.code === 'RATE_LIMITED' ? 429 : 401;

                return res.status(statusCode).json({
                    success: false,
                    error: result.error,
                    code: result.code,
                    retryAfter: result.retryAfter,
                    timestamp: new Date().toISOString()
                });
            }

            // Set session cookie
            const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined; // 30 days if remember me
            this.setSessionCookie(res, result.sessionToken, result.expiresAt, cookieMaxAge);

            // Store session in request session if available
            if (req.session) {
                req.session.authenticated = true;
                req.session.user = result.user;
                req.session.sessionToken = result.sessionToken;
                req.session.expiresAt = result.expiresAt;
            }

            res.json({
                success: true,
                message: result.message,
                user: result.user,
                sessionToken: result.sessionToken,
                expiresAt: result.expiresAt,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Login endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Login failed',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * User logout endpoint
     * POST /auth/logout
     */
    async logout(req, res) {
        try {
            const sessionToken = this.extractSessionToken(req);

            // Logout user
            const result = await this.authService.logout(sessionToken);

            // Clear session cookie
            this.clearSessionCookie(res);

            // Clear request session if available
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destruction error:', err);
                    }
                });
            }

            res.json({
                success: true,
                message: result.message || 'Logged out successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Logout endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Logout failed',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get current user profile
     * GET /auth/profile
     */
    async getProfile(req, res) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                    timestamp: new Date().toISOString()
                });
            }

            const result = await this.authService.getUserProfile(userId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    error: result.error,
                    code: result.code,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                data: {
                    user: result.user,
                    loginHistory: result.loginHistory,
                    stats: result.stats
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get profile endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get profile',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Update user profile
     * PUT /auth/profile
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            const { name, device, location } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                    timestamp: new Date().toISOString()
                });
            }

            const result = await this.authService.updateProfile(userId, {
                name,
                device,
                location
            });

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error,
                    code: result.code,
                    timestamp: new Date().toISOString()
                });
            }

            // Update session user data
            if (req.session && req.session.user) {
                req.session.user.name = result.user.name;
            }

            res.json({
                success: true,
                message: result.message,
                user: result.user,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Update profile endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update profile',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Change user password
     * POST /auth/change-password
     */
    async changePassword(req, res) {
        try {
            const userId = req.user?.id;
            const { currentPassword, newPassword, confirmPassword } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                    timestamp: new Date().toISOString()
                });
            }

            const result = await this.authService.changePassword(
                userId,
                currentPassword,
                newPassword,
                confirmPassword
            );

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error,
                    code: result.code,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: result.message,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Change password endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to change password',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Check authentication status
     * GET /auth/status
     */
    async getAuthStatus(req, res) {
        try {
            const sessionToken = this.extractSessionToken(req);

            if (!sessionToken) {
                return res.json({
                    success: true,
                    data: {
                        isAuthenticated: false,
                        user: null,
                        csrfToken: this.authService.generateCSRFToken()
                    },
                    timestamp: new Date().toISOString()
                });
            }

            const validation = this.authService.validateSession(sessionToken);

            if (!validation.isValid) {
                // Clear invalid session cookie
                this.clearSessionCookie(res);

                return res.json({
                    success: true,
                    data: {
                        isAuthenticated: false,
                        user: null,
                        csrfToken: this.authService.generateCSRFToken(),
                        reason: validation.error
                    },
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                data: {
                    isAuthenticated: true,
                    user: validation.session.user,
                    csrfToken: this.authService.generateCSRFToken(sessionToken),
                    sessionInfo: {
                        createdAt: validation.session.createdAt,
                        expiresAt: validation.session.expiresAt
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Auth status endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get auth status',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get CSRF token
     * GET /auth/csrf-token
     */
    getCsrfToken(req, res) {
        try {
            const sessionToken = this.extractSessionToken(req);
            const csrfToken = this.authService.generateCSRFToken(sessionToken);

            res.json({
                success: true,
                data: {
                    csrfToken
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('CSRF token endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get CSRF token',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Authentication middleware
     * Validates session and adds user info to request
     */
    authenticate() {
        return (req, res, next) => {
            try {
                const sessionToken = this.extractSessionToken(req);

                if (!sessionToken) {
                    return res.status(401).json({
                        success: false,
                        error: 'Authentication required',
                        code: 'NO_TOKEN',
                        timestamp: new Date().toISOString()
                    });
                }

                const validation = this.authService.validateSession(sessionToken);

                if (!validation.isValid) {
                    // Clear invalid session cookie
                    this.clearSessionCookie(res);

                    return res.status(401).json({
                        success: false,
                        error: validation.error,
                        code: validation.code,
                        timestamp: new Date().toISOString()
                    });
                }

                // Add user info to request
                req.user = validation.session.user;
                req.sessionToken = sessionToken;
                req.sessionInfo = {
                    createdAt: validation.session.createdAt,
                    expiresAt: validation.session.expiresAt
                };

                next();

            } catch (error) {
                console.error('Authentication middleware error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Authentication failed',
                    code: 'AUTH_ERROR',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Optional authentication middleware
     * Adds user info to request if authenticated, but doesn't block unauthenticated requests
     */
    optionalAuthenticate() {
        return (req, res, next) => {
            try {
                const sessionToken = this.extractSessionToken(req);

                if (sessionToken) {
                    const validation = this.authService.validateSession(sessionToken);

                    if (validation.isValid) {
                        req.user = validation.session.user;
                        req.sessionToken = sessionToken;
                        req.sessionInfo = {
                            createdAt: validation.session.createdAt,
                            expiresAt: validation.session.expiresAt
                        };
                    } else {
                        // Clear invalid session cookie
                        this.clearSessionCookie(res);
                    }
                }

                next();

            } catch (error) {
                console.error('Optional authentication middleware error:', error);
                // Don't block request on error, just continue without user info
                next();
            }
        };
    }

    /**
     * Extract device and location information from request
     * @param {Request} req - Express request object
     * @returns {Object} Device information
     */
    extractDeviceInfo(req) {
        return {
            ip_address: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
            device: req.headers['user-agent'] || 'Unknown',
            location: req.headers['x-location'] || null // If you implement geolocation
        };
    }

    /**
     * Extract session token from request
     * @param {Request} req - Express request object
     * @returns {string|null} Session token
     */
    extractSessionToken(req) {
        // Try to get token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }

        // Try to get token from cookie
        if (req.cookies && req.cookies.sessionToken) {
            return req.cookies.sessionToken;
        }

        // Try to get token from session
        if (req.session && req.session.sessionToken) {
            return req.session.sessionToken;
        }

        return null;
    }

    /**
     * Set session cookie
     * @param {Response} res - Express response object
     * @param {string} sessionToken - Session token
     * @param {Date} expiresAt - Session expiration date
     * @param {number} maxAge - Cookie max age in milliseconds
     */
    setSessionCookie(res, sessionToken, expiresAt, maxAge) {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: maxAge || (expiresAt ? expiresAt.getTime() - Date.now() : undefined)
        };

        res.cookie('sessionToken', sessionToken, cookieOptions);
    }

    /**
     * Clear session cookie
     * @param {Response} res - Express response object
     */
    clearSessionCookie(res) {
        res.clearCookie('sessionToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
    }

    /**
     * Get authentication statistics (for admin/monitoring)
     */
    getAuthStats(req, res) {
        try {
            const stats = {
                activeSessions: this.authService.getActiveSessionsCount(),
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Auth stats endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get auth stats',
                code: 'SERVER_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = AuthController;
