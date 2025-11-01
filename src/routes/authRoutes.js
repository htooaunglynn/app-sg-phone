const express = require('express');
const AuthController = require('../controllers/authController');

/**
 * Authentication routes module
 * Handles login, logout, registration, and authentication endpoints
 */
class AuthRoutes {
    constructor() {
        this.authController = new AuthController();
    }

    /**
     * Create authentication router with all auth endpoints
     * @returns {express.Router} Express router with authentication routes
     */
    createRouter() {
        const router = express.Router();

        // Registration endpoint
        router.post('/register', this.authController.register.bind(this.authController));

        // Login endpoint
        router.post('/login', this.authController.login.bind(this.authController));

        // Logout endpoint
        router.post('/logout', this.authController.logout.bind(this.authController));

        // Authentication status endpoint
        router.get('/status', this.authController.getAuthStatus.bind(this.authController));

        // CSRF token endpoint
        router.get('/csrf-token', this.authController.getCsrfToken.bind(this.authController));

        // Session validation endpoint (protected)
        router.get('/validate',
            this.authController.authenticate(),
            (req, res) => {
                res.json({
                    success: true,
                    message: 'Session is valid',
                    data: {
                        user: req.user,
                        sessionInfo: req.sessionInfo
                    },
                    timestamp: new Date().toISOString()
                });
            }
        );

        // User profile endpoints (protected)
        router.get('/profile',
            this.authController.authenticate(),
            this.authController.getProfile.bind(this.authController)
        );

        router.put('/profile',
            this.authController.authenticate(),
            this.authController.updateProfile.bind(this.authController)
        );

        // Password change endpoint (protected)
        router.post('/change-password',
            this.authController.authenticate(),
            this.authController.changePassword.bind(this.authController)
        );

        // Authentication statistics (for monitoring)
        router.get('/stats', this.authController.getAuthStats.bind(this.authController));

        return router;
    }

    /**
     * Setup authentication routes on the main app
     * @param {Express} app - Express application instance
     * @param {string} basePath - Base path for auth routes (default: '/api/auth')
     */
    setupRoutes(app, basePath = '/api/auth') {
        const authRouter = this.createRouter();
        app.use(basePath, authRouter);

        console.log(`🔐 Authentication routes configured at ${basePath}`);
        console.log(`   POST ${basePath}/register - User registration`);
        console.log(`   POST ${basePath}/login - User login`);
        console.log(`   POST ${basePath}/logout - User logout`);
        console.log(`   GET  ${basePath}/status - Authentication status`);
        console.log(`   GET  ${basePath}/csrf-token - Get CSRF token`);
        console.log(`   GET  ${basePath}/validate - Validate session`);
        console.log(`   GET  ${basePath}/profile - Get user profile`);
        console.log(`   PUT  ${basePath}/profile - Update user profile`);
        console.log(`   POST ${basePath}/change-password - Change password`);
        console.log(`   GET  ${basePath}/stats - Authentication statistics`);
    }

    /**
     * Get authentication middleware for protecting routes
     * @returns {Function} Authentication middleware
     */
    getAuthMiddleware() {
        return this.authController.authenticate();
    }

    /**
     * Get optional authentication middleware
     * @returns {Function} Optional authentication middleware
     */
    getOptionalAuthMiddleware() {
        return this.authController.optionalAuthenticate();
    }
}

module.exports = AuthRoutes;
