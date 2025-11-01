const User = require('../models/User');
const crypto = require('crypto');

/**
 * Authentication Service
 * Handles user registration, login, session management, and security
 */
class AuthService {
    constructor() {
        this.userModel = new User();
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes

        // In-memory storage for rate limiting (in production, use Redis)
        this.loginAttempts = new Map();
        this.activeSessions = new Map();
    }

    /**
     * Register a new user
     * @param {Object} userData - User registration data
     * @param {string} userData.name - User's full name
     * @param {string} userData.email - User's email address
     * @param {string} userData.password - User's password
     * @param {string} userData.confirmPassword - Password confirmation
     * @param {Object} deviceInfo - Device and location information
     * @returns {Object} Registration result
     */
    async register(userData, deviceInfo = {}) {
        try {
            const { name, email, password, confirmPassword } = userData;

            // Validation
            this.validateRegistrationData({ name, email, password, confirmPassword });

            // Create user
            const user = await this.userModel.createUser({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password,
                device: deviceInfo.device,
                ip_address: deviceInfo.ip_address,
                location: deviceInfo.location
            });

            // Log successful registration
            await this.userModel.logLoginAttempt(user.id, {
                ...deviceInfo,
                result: 'success'
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    status: user.status
                },
                message: 'User registered successfully'
            };
        } catch (error) {
            console.error('Registration error:', error);

            return {
                success: false,
                error: error.message || 'Registration failed',
                code: this.getErrorCode(error)
            };
        }
    }

    /**
     * Authenticate user login
     * @param {Object} credentials - Login credentials
     * @param {string} credentials.email - User's email
     * @param {string} credentials.password - User's password
     * @param {Object} deviceInfo - Device and location information
     * @returns {Object} Authentication result
     */
    async login(credentials, deviceInfo = {}) {
        try {
            const { email, password } = credentials;
            const clientId = deviceInfo.ip_address || 'unknown';

            // Check rate limiting
            if (this.isRateLimited(clientId)) {
                return {
                    success: false,
                    error: 'Too many login attempts. Please try again later.',
                    code: 'RATE_LIMITED',
                    retryAfter: this.getRateLimitRetryTime(clientId)
                };
            }

            // Validation
            if (!email || !password) {
                this.recordFailedAttempt(clientId);
                return {
                    success: false,
                    error: 'Email and password are required',
                    code: 'MISSING_CREDENTIALS'
                };
            }

            // Authenticate user
            const user = await this.userModel.validateCredentials(email.toLowerCase().trim(), password);

            if (!user) {
                this.recordFailedAttempt(clientId);

                // Log failed attempt
                const tempUser = await this.userModel.findByEmail(email.toLowerCase().trim());
                if (tempUser) {
                    await this.userModel.logLoginAttempt(tempUser.id, {
                        ...deviceInfo,
                        result: 'failed'
                    });
                }

                return {
                    success: false,
                    error: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                };
            }

            // Generate session token
            const sessionToken = this.generateSessionToken();
            const sessionData = {
                userId: user.id,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    status: user.status
                },
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + this.sessionTimeout),
                deviceInfo
            };

            // Store session
            this.activeSessions.set(sessionToken, sessionData);

            // Update user's last seen and login token
            await this.userModel.updateLastSeen(user.id, sessionToken, deviceInfo);

            // Log successful login
            await this.userModel.logLoginAttempt(user.id, {
                ...deviceInfo,
                result: 'success'
            });

            // Clear failed attempts for this client
            this.clearFailedAttempts(clientId);

            return {
                success: true,
                user: sessionData.user,
                sessionToken,
                expiresAt: sessionData.expiresAt,
                message: 'Login successful'
            };
        } catch (error) {
            console.error('Login error:', error);

            return {
                success: false,
                error: error.message || 'Login failed',
                code: this.getErrorCode(error)
            };
        }
    }

    /**
     * Logout user and invalidate session
     * @param {string} sessionToken - Session token to invalidate
     * @returns {Object} Logout result
     */
    async logout(sessionToken) {
        try {
            if (!sessionToken) {
                return {
                    success: false,
                    error: 'Session token required',
                    code: 'MISSING_TOKEN'
                };
            }

            const session = this.activeSessions.get(sessionToken);

            if (session) {
                // Clear user's login token in database
                await this.userModel.clearLoginToken(session.userId);

                // Remove session from memory
                this.activeSessions.delete(sessionToken);
            }

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            console.error('Logout error:', error);

            return {
                success: false,
                error: error.message || 'Logout failed',
                code: 'LOGOUT_ERROR'
            };
        }
    }

    /**
     * Validate session token
     * @param {string} sessionToken - Session token to validate
     * @returns {Object} Session validation result
     */
    validateSession(sessionToken) {
        try {
            if (!sessionToken) {
                return {
                    isValid: false,
                    error: 'Session token required',
                    code: 'MISSING_TOKEN'
                };
            }

            const session = this.activeSessions.get(sessionToken);

            if (!session) {
                return {
                    isValid: false,
                    error: 'Invalid session token',
                    code: 'INVALID_TOKEN'
                };
            }

            // Check if session has expired
            if (new Date() > session.expiresAt) {
                this.activeSessions.delete(sessionToken);
                return {
                    isValid: false,
                    error: 'Session has expired',
                    code: 'SESSION_EXPIRED'
                };
            }

            return {
                isValid: true,
                session: {
                    userId: session.userId,
                    user: session.user,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt
                }
            };
        } catch (error) {
            console.error('Session validation error:', error);

            return {
                isValid: false,
                error: 'Session validation failed',
                code: 'VALIDATION_ERROR'
            };
        }
    }

    /**
     * Change user password
     * @param {number} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @param {string} confirmPassword - New password confirmation
     * @returns {Object} Password change result
     */
    async changePassword(userId, currentPassword, newPassword, confirmPassword) {
        try {
            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                return {
                    success: false,
                    error: 'All password fields are required',
                    code: 'MISSING_PASSWORDS'
                };
            }

            if (newPassword !== confirmPassword) {
                return {
                    success: false,
                    error: 'New passwords do not match',
                    code: 'PASSWORD_MISMATCH'
                };
            }

            this.validatePassword(newPassword);

            // Get user
            const user = await this.userModel.findById(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }

            // Validate current password
            const isValidPassword = await this.userModel.validateCredentials(user.email, currentPassword);
            if (!isValidPassword) {
                return {
                    success: false,
                    error: 'Current password is incorrect',
                    code: 'INVALID_CURRENT_PASSWORD'
                };
            }

            // Update password
            await this.userModel.updatePassword(userId, newPassword);

            return {
                success: true,
                message: 'Password changed successfully'
            };
        } catch (error) {
            console.error('Password change error:', error);

            return {
                success: false,
                error: error.message || 'Password change failed',
                code: this.getErrorCode(error)
            };
        }
    }

    /**
     * Get user profile with login history
     * @param {number} userId - User ID
     * @returns {Object} User profile data
     */
    async getUserProfile(userId) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }

            const loginHistory = await this.userModel.getLoginHistory(userId, 10);

            return {
                success: true,
                user,
                loginHistory,
                stats: {
                    totalLogins: loginHistory.length,
                    lastLogin: loginHistory[0]?.login_time || null,
                    successfulLogins: loginHistory.filter(log => log.result === 'success').length,
                    failedLogins: loginHistory.filter(log => log.result === 'failed').length
                }
            };
        } catch (error) {
            console.error('Get profile error:', error);

            return {
                success: false,
                error: error.message || 'Failed to get user profile',
                code: this.getErrorCode(error)
            };
        }
    }

    /**
     * Update user profile
     * @param {number} userId - User ID
     * @param {Object} profileData - Profile data to update
     * @returns {Object} Profile update result
     */
    async updateProfile(userId, profileData) {
        try {
            // Validate profile data
            if (profileData.name && profileData.name.trim().length < 2) {
                return {
                    success: false,
                    error: 'Name must be at least 2 characters long',
                    code: 'INVALID_NAME'
                };
            }

            const updatedUser = await this.userModel.updateProfile(userId, profileData);

            return {
                success: true,
                user: updatedUser,
                message: 'Profile updated successfully'
            };
        } catch (error) {
            console.error('Profile update error:', error);

            return {
                success: false,
                error: error.message || 'Profile update failed',
                code: this.getErrorCode(error)
            };
        }
    }

    /**
     * Generate secure session token
     * @returns {string} Session token
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate CSRF token for a session
     * @param {string} sessionToken - Session token
     * @returns {string} CSRF token
     */
    generateCSRFToken(sessionToken) {
        if (!sessionToken) {
            return crypto.randomBytes(16).toString('hex');
        }

        return crypto
            .createHmac('sha256', process.env.CSRF_SECRET || 'default-csrf-secret')
            .update(sessionToken)
            .digest('hex')
            .slice(0, 32);
    }

    /**
     * Validate registration data
     * @param {Object} data - Registration data
     */
    validateRegistrationData(data) {
        const { name, email, password, confirmPassword } = data;

        if (!name || name.trim().length < 2) {
            throw new Error('Name must be at least 2 characters long');
        }

        if (!this.isValidEmail(email)) {
            throw new Error('Please provide a valid email address');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        this.validatePassword(password);
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     */
    validatePassword(password) {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (!/(?=.*[a-z])/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }

        if (!/(?=.*[A-Z])/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        if (!/(?=.*\d)/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (!/(?=.*[@$!%*?&])/.test(password)) {
            throw new Error('Password must contain at least one special character (@$!%*?&)');
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if client is rate limited
     * @param {string} clientId - Client identifier (IP address)
     * @returns {boolean} Is rate limited
     */
    isRateLimited(clientId) {
        const attempts = this.loginAttempts.get(clientId);

        if (!attempts) {
            return false;
        }

        // Clean up old attempts
        if (Date.now() - attempts.firstAttempt > this.lockoutDuration) {
            this.loginAttempts.delete(clientId);
            return false;
        }

        return attempts.count >= this.maxLoginAttempts;
    }

    /**
     * Record failed login attempt
     * @param {string} clientId - Client identifier
     */
    recordFailedAttempt(clientId) {
        const now = Date.now();
        const attempts = this.loginAttempts.get(clientId);

        if (!attempts) {
            this.loginAttempts.set(clientId, {
                count: 1,
                firstAttempt: now
            });
        } else {
            if (now - attempts.firstAttempt > this.lockoutDuration) {
                // Reset if lockout period has passed
                this.loginAttempts.set(clientId, {
                    count: 1,
                    firstAttempt: now
                });
            } else {
                attempts.count++;
            }
        }
    }

    /**
     * Clear failed attempts for client
     * @param {string} clientId - Client identifier
     */
    clearFailedAttempts(clientId) {
        this.loginAttempts.delete(clientId);
    }

    /**
     * Get retry time for rate limited client
     * @param {string} clientId - Client identifier
     * @returns {number} Seconds until retry allowed
     */
    getRateLimitRetryTime(clientId) {
        const attempts = this.loginAttempts.get(clientId);

        if (!attempts) {
            return 0;
        }

        const timeRemaining = this.lockoutDuration - (Date.now() - attempts.firstAttempt);
        return Math.ceil(timeRemaining / 1000);
    }

    /**
     * Get error code from error object
     * @param {Error} error - Error object
     * @returns {string} Error code
     */
    getErrorCode(error) {
        if (error.message.includes('already exists')) {
            return 'USER_EXISTS';
        }
        if (error.message.includes('password')) {
            return 'INVALID_PASSWORD';
        }
        if (error.message.includes('email')) {
            return 'INVALID_EMAIL';
        }
        if (error.message.includes('name')) {
            return 'INVALID_NAME';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Clean up expired sessions (should be called periodically)
     */
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [token, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                this.activeSessions.delete(token);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired sessions`);
        }
    }

    /**
     * Get active sessions count
     * @returns {number} Number of active sessions
     */
    getActiveSessionsCount() {
        return this.activeSessions.size;
    }
}

module.exports = AuthService;
