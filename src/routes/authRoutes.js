const express = require('express');
const Routes = require('./index');

/**
 * Authentication routes module
 * Handles login, logout, and authentication status endpoints
 */
class AuthRoutes {
  /**
   * Create authentication router with all auth endpoints
   * @returns {express.Router} Express router with authentication routes
   */
  static createRouter() {
    const router = express.Router();

    // Login endpoint
    router.post('/login', Routes.createLoginMiddleware(), (req, res) => {
      const authStatus = Routes.getAuthStatus(req);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: authStatus.user,
          csrfToken: authStatus.csrfToken,
          sessionId: authStatus.sessionId
        },
        timestamp: new Date().toISOString()
      });
    });

    // Logout endpoint
    router.post('/logout', Routes.createLogoutMiddleware());

    // Authentication status endpoint
    router.get('/status', (req, res) => {
      const authStatus = Routes.getAuthStatus(req);
      
      res.json({
        success: true,
        data: authStatus,
        timestamp: new Date().toISOString()
      });
    });

    // CSRF token endpoint
    router.get('/csrf-token', (req, res) => {
      const csrfToken = Routes.generateCSRFToken(req);
      
      res.json({
        success: true,
        data: {
          csrfToken: csrfToken
        },
        timestamp: new Date().toISOString()
      });
    });

    // Session validation endpoint
    router.get('/validate', Routes.createAuthMiddleware(), (req, res) => {
      const authData = req.auth || { user: null, sessionId: null };
      
      res.json({
        success: true,
        message: 'Session is valid',
        data: {
          user: authData.user,
          sessionId: authData.sessionId
        },
        timestamp: new Date().toISOString()
      });
    });

    // Password change endpoint (protected)
    router.post('/change-password', Routes.createAuthMiddleware(), (req, res) => {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password required',
          code: 'MISSING_PASSWORDS'
        });
      }

      // Validate current password
      const username = req.auth?.user?.id || 'admin';
      const isCurrentValid = Routes.validateCredentials(username, currentPassword);
      
      if (!isCurrentValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // In production, this would update the password in the database
      // For now, just return success
      res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      });
    });

    return router;
  }

  /**
   * Setup authentication routes on the main app
   * @param {Express} app - Express application instance
   * @param {string} basePath - Base path for auth routes (default: '/api/auth')
   */
  static setupRoutes(app, basePath = '/api/auth') {
    const authRouter = this.createRouter();
    app.use(basePath, authRouter);
    
    console.log(`🔐 Authentication routes configured at ${basePath}`);
    console.log(`   POST ${basePath}/login - User login`);
    console.log(`   POST ${basePath}/logout - User logout`);
    console.log(`   GET  ${basePath}/status - Authentication status`);
    console.log(`   GET  ${basePath}/csrf-token - Get CSRF token`);
    console.log(`   GET  ${basePath}/validate - Validate session`);
    console.log(`   POST ${basePath}/change-password - Change password`);
  }
}

module.exports = AuthRoutes;