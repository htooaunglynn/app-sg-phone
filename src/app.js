const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import configuration utility
const config = require('./utils/config');

// Import authentication system
const Routes = require('./routes');


// Import controllers
const UploadController = require('./controllers/uploadController');
const ExportController = require('./controllers/exportController');
const StatsController = require('./controllers/statsController');

// Import models for database initialization
const CheckTable = require('./models/CheckTable');

// Import database manager for connection management
const databaseManager = require('./utils/database');

// Import services for dual-table workflow
const PDFProcessor = require('./services/pdfProcessor');
const singaporePhoneValidator = require('./services/singaporePhoneValidator');
const phoneValidationProcessor = require('./services/phoneValidationProcessor');

class Application {
    constructor() {
        this.app = express();
        this.config = config;
        this.port = config.server.port;

        // Initialize services for dual-table workflow
        this.pdfProcessor = new PDFProcessor();
        this.singaporePhoneValidator = singaporePhoneValidator;
        this.phoneValidationProcessor = phoneValidationProcessor;

        // Initialize controllers
        this.uploadController = new UploadController();
        this.exportController = new ExportController();
        this.statsController = new StatsController();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Enable CORS for all routes
        this.app.use(cors({
            origin: this.config.server.corsOrigin,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
            credentials: true // Enable cookies
        }));

        // Parse JSON bodies
        this.app.use(express.json({ limit: '1mb' }));

        // Parse URL-encoded bodies
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

        // Parse cookies
        this.app.use(cookieParser());

        // Setup authentication system (session middleware, CSRF protection)
        this.setupAuthentication();

        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, '../public')));

        // Performance monitoring middleware
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            const timestamp = new Date().toISOString();

            // Log request
            console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);

            // Monitor response time
            res.on('finish', () => {
                const responseTime = Date.now() - startTime;
                if (responseTime > 1000) { // Log slow requests
                    console.warn(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
                }
            });

            next();
        });

        // Enhanced security headers (updated for authentication)
        this.app.use((req, res, next) => {
            // Basic security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');

            // Enhanced security headers
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

            // Content Security Policy (updated for authentication forms)
            const csp = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
                "media-src 'none'",
                "object-src 'none'",
                "child-src 'none'",
                "worker-src 'none'",
                "frame-src 'none'",
                "base-uri 'self'",
                "form-action 'self'"
            ].join('; ');

            res.setHeader('Content-Security-Policy', csp);

            next();
        });

        // Rate limiting middleware for file uploads
        this.app.use('/upload', (req, res, next) => {
            const clientId = req.ip || req.connection.remoteAddress;
            const now = Date.now();

            if (!this.rateLimitMap) {
                this.rateLimitMap = new Map();
            }

            const clientData = this.rateLimitMap.get(clientId) || { count: 0, resetTime: now + 3600000 }; // 1 hour window

            if (now > clientData.resetTime) {
                clientData.count = 0;
                clientData.resetTime = now + 3600000;
            }

            if (clientData.count >= this.config.security.maxFilesPerHour) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded. Too many file uploads.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
                });
            }

            clientData.count++;
            this.rateLimitMap.set(clientId, clientData);

            next();
        });
    }

    /**
     * Setup authentication system with session middleware and CSRF protection
     */
    setupAuthentication() {
        try {
            console.log('Setting up authentication system...');

            // Setup authentication with protected routes
            Routes.setupAuthentication(this.app, {
                protectedPaths: [
                    '/upload',
                    '/export',
                    '/check',
                    '/files',
                    '/stats',
                    '/system',
                    '/api'
                ],
                enableAuth: process.env.DISABLE_AUTH !== 'true'
            });

            // Setup new authentication routes
            const AuthRoutes = require('./routes/authRoutes');
            this.authRoutes = new AuthRoutes();
            this.authRoutes.setupRoutes(this.app, '/api/auth');

            console.log('✅ Authentication system setup completed');
        } catch (error) {
            console.error('❌ Failed to setup authentication system:', error);
            // Don't throw error to allow application to start without auth in development
            if (this.config.isProduction()) {
                throw error;
            }
        }
    }

    /**
     * Authentication middleware for HTML pages - redirects to login if not authenticated
     */
    requireAuthentication(req, res, next) {
        // Skip authentication if disabled
        if (process.env.DISABLE_AUTH === 'true') {
            return next();
        }

        try {
            // Check authentication using the Routes class method
            const authResult = Routes.checkAuthentication(req);

            if (!authResult.isAuthenticated) {
                console.log(`🚫 Unauthenticated access attempt to ${req.path} - redirecting to login`);
                
                // For AJAX requests, return JSON error
                if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                    return res.status(401).json({
                        success: false,
                        error: 'Authentication required',
                        code: 'UNAUTHORIZED',
                        redirectTo: '/login'
                    });
                }

                // For regular page requests, redirect to login
                return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
            }

            // Add authentication info to request
            req.auth = {
                isAuthenticated: true,
                user: authResult.user,
                sessionId: authResult.sessionId
            };

            console.log(`✅ Authenticated access to ${req.path} by user: ${authResult.user?.id || 'anonymous'}`);
            next();
        } catch (error) {
            console.error('❌ Authentication middleware error:', error.message);
            
            // For AJAX requests, return JSON error
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(500).json({
                    success: false,
                    error: 'Authentication system error',
                    code: 'AUTH_SYSTEM_ERROR'
                });
            }

            // For regular requests, redirect to login with error
            return res.redirect('/login?error=auth_system_error');
        }
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Authentication routes (must come before other routes)
        this.app.get('/login', (req, res) => {
            // If user is already authenticated, redirect to intended page or home
            if (process.env.DISABLE_AUTH !== 'true') {
                const authResult = Routes.checkAuthentication(req);
                if (authResult.isAuthenticated) {
                    const redirectTo = req.query.redirect || '/';
                    return res.redirect(redirectTo);
                }
            }
            res.sendFile(path.join(__dirname, '../public/login.html'));
        });

        this.app.get('/register', (req, res) => {
            // If user is already authenticated, redirect to intended page or home
            if (process.env.DISABLE_AUTH !== 'true') {
                const authResult = Routes.checkAuthentication(req);
                if (authResult.isAuthenticated) {
                    const redirectTo = req.query.redirect || '/';
                    return res.redirect(redirectTo);
                }
            }
            res.sendFile(path.join(__dirname, '../public/register.html'));
        });

        // Simple login endpoint for basic authentication
        this.app.post('/api/auth/login', (req, res) => {
            const { email, password } = req.body;

            console.log('Login attempt:', { email, hasPassword: !!password, hasSession: !!req.session });

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password required',
                    code: 'MISSING_CREDENTIALS'
                });
            }

            // Use email as username for the Routes class validation
            const isValid = Routes.validateCredentials(email, password);
            console.log('Credential validation result:', isValid);

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Set session data
            if (req.session) {
                req.session.authenticated = true;
                req.session.user = { id: email, role: 'user', email: email };
                req.session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                req.session.lastActivity = Date.now();
                console.log('Session data set:', req.session);
            } else {
                console.log('No session available');
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: { id: email, role: 'user', email: email }
            });
        });

        // Simple logout endpoint
        this.app.post('/api/auth/logout', (req, res) => {
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destruction error:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Logout failed'
                        });
                    }
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
        });

        // Simple auth status endpoint
        this.app.get('/api/auth/status', (req, res) => {
            const authResult = Routes.checkAuthentication(req);
            
            // Debug session info
            console.log('Auth status check:', {
                hasSession: !!req.session,
                sessionAuth: req.session?.authenticated,
                sessionUser: req.session?.user,
                authResult: authResult
            });
            
            res.json({
                success: true,
                data: {
                    isAuthenticated: authResult.isAuthenticated,
                    user: authResult.user || null
                }
            });
        });

        // Root route - serve main application (protected)
        this.app.get('/', this.requireAuthentication.bind(this), (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.get('/profile', this.requireAuthentication.bind(this), (req, res) => {
            res.sendFile(path.join(__dirname, '../public/profile.html'));
        });

        // Check Table Records page route - redirect to main page for backward compatibility
        this.app.get('/check-records', (req, res) => {
            res.redirect(301, '/');
        });

        // File Manager page route (protected)
        this.app.get('/file-manager', this.requireAuthentication.bind(this), (req, res) => {
            res.sendFile(path.join(__dirname, '../public/file-manager.html'));
        });

        // Monitoring Dashboard page route (protected)
        this.app.get('/monitoring', this.requireAuthentication.bind(this), (req, res) => {
            res.sendFile(path.join(__dirname, '../public/monitoring-dashboard.html'));
        });

        // Health check route (simple)
        this.app.get('/ping', (req, res) => {
            res.status(200).json({
                success: true,
                message: 'Server is running',
                timestamp: new Date().toISOString()
            });
        });

        // Monitoring and metrics routes
        const monitoringRoutes = require('./routes/monitoringRoutes');
        this.app.use('/api/monitoring', monitoringRoutes);

        // Upload routes
        this.app.post('/upload',
            this.uploadController.getUploadMiddleware(),
            this.uploadController.handleMulterError.bind(this.uploadController),
            this.uploadController.handleUpload.bind(this.uploadController)
        );

        this.app.get('/upload/status',
            this.uploadController.getUploadStatus.bind(this.uploadController)
        );

        // Excel-specific processing endpoints
        this.app.get('/processing-status/:fileId',
            this.uploadController.getProcessingStatus.bind(this.uploadController)
        );

        // HTML extraction report page
        this.app.get('/extraction-report/:fileId', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/extraction-report.html'));
        });

        // JSON API for extraction report data
        this.app.get('/api/extraction-report/:fileId',
            this.uploadController.getExtractionReport.bind(this.uploadController)
        );

        this.app.get('/worksheet-info/:fileId',
            this.uploadController.getWorksheetInfo.bind(this.uploadController)
        );

        this.app.get('/column-mapping/:fileId',
            this.uploadController.getColumnMapping.bind(this.uploadController)
        );

        // Export routes
        this.app.get('/export/:start/:end',
            this.exportController.exportByRange.bind(this.exportController)
        );

        this.app.get('/export/all',
            this.exportController.exportAll.bind(this.exportController)
        );

        this.app.get('/export/validate/:start/:end',
            this.exportController.validateExportRange.bind(this.exportController)
        );

        this.app.get('/export/recommendations/:start/:end',
            this.exportController.getExportRecommendations.bind(this.exportController)
        );

        this.app.get('/export/info',
            this.exportController.getExportInfo.bind(this.exportController)
        );

        // Check table management routes
        this.app.get('/check',
            this.exportController.getCheckRecords.bind(this.exportController)
        );

        this.app.put('/check/:id',
            this.exportController.updateCheckRecord.bind(this.exportController)
        );

        // File management routes
        this.app.get('/files',
            this.uploadController.listUploadedFiles.bind(this.uploadController)
        );

        this.app.get('/files/:filename',
            this.uploadController.downloadFile.bind(this.uploadController)
        );

        this.app.delete('/files/:filename',
            this.uploadController.deleteFile.bind(this.uploadController)
        );

        this.app.post('/files/archive',
            this.uploadController.archiveOldFiles.bind(this.uploadController)
        );

        this.app.post('/files/cleanup-failed',
            this.uploadController.cleanupFailedFiles.bind(this.uploadController)
        );

        // Backup table management routes
        this.app.get('/backup-records',
            this.uploadController.getBackupRecords.bind(this.uploadController)
        );

        this.app.get('/backup-records/:id',
            this.uploadController.getBackupRecord.bind(this.uploadController)
        );

        this.app.put('/backup-records/:id/company-info',
            this.uploadController.updateBackupRecordCompanyInfo.bind(this.uploadController)
        );

        // Statistics and utility routes
        this.app.get('/stats',
            this.statsController.getStats.bind(this.statsController)
        );

        this.app.get('/health',
            this.statsController.getHealthCheck.bind(this.statsController)
        );

        this.app.get('/system',
            this.statsController.getSystemInfo.bind(this.statsController)
        );

        this.app.get('/api',
            this.statsController.getApiInfo.bind(this.statsController)
        );

        // Development/testing routes
        if (process.env.NODE_ENV !== 'production') {
            this.app.post('/reset',
                this.statsController.resetDatabase.bind(this.statsController)
            );
        }

        // 404 handler for API routes
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found',
                code: 'NOT_FOUND',
                path: req.path
            });
        });

        // 404 handler for all other routes
        this.app.use('*', (req, res) => {
            // For non-API routes, serve the main application
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(__dirname, '../public/index.html'));
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Endpoint not found',
                    code: 'NOT_FOUND',
                    path: req.path
                });
            }
        });
    }

    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);

            // Don't send error details in production
            const isDevelopment = this.config.isDevelopment();

            // Handle specific error types
            if (error.name === 'ValidationError') {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: this.config.isDevelopment() ? error.message : undefined
                });
            }

            if (error.name === 'UnauthorizedError') {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED'
                });
            }

            if (error.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    error: 'Resource not found',
                    code: 'NOT_FOUND'
                });
            }

            if (error.code === 'EACCES') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    code: 'FORBIDDEN'
                });
            }

            // Database errors
            if (error.code && error.code.startsWith('ER_')) {
                return res.status(500).json({
                    success: false,
                    error: 'Database error occurred',
                    code: 'DATABASE_ERROR',
                    details: isDevelopment ? error.message : undefined
                });
            }

            // Generic server error
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'SERVER_ERROR',
                details: isDevelopment ? error.message : undefined,
                stack: isDevelopment ? error.stack : undefined
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            // In production, you might want to restart the process
            if (this.config.isProduction()) {
                process.exit(1);
            }
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            // In production, you might want to restart the process
            if (this.config.isProduction()) {
                process.exit(1);
            }
        });
    }

    /**
     * Initialize database and start server
     */
    async start() {
        try {
            console.log('Starting Singapore Phone Detect application...');

            // Print configuration summary
            this.config.printSummary();

            // Perform startup health checks
            await this.performStartupChecks();

            // Initialize dual-table database schema
            console.log('Initializing dual-table database schema...');
            await this.initializeDualTableSchema();
            console.log('Dual-table database schema initialized successfully');

            // Authentication system is already set up in setupAuthentication()

            // Start the server
            this.server = this.app.listen(this.port, this.config.server.host, () => {
                console.log(`✅ Server running on ${this.config.server.host}:${this.port}`);
                console.log(`🌍 Environment: ${this.config.server.environment}`);
                console.log(`🔗 Access the application at: http://localhost:${this.port}`);
                console.log('\n📡 API endpoints:');
                console.log('  POST /upload - Upload PDF or Excel files (stores to backup_table)');
                console.log('  GET /export/:start/:end - Export check_table records by range');
                console.log('  GET /check - List check_table records with pagination');
                console.log('  PUT /check/:id - Update company information in check_table');
                console.log('  GET /backup-records - List backup_table records with pagination');
                console.log('  GET /backup-records/:id - Get specific backup_table record');
                console.log('  PUT /backup-records/:id/company-info - Update company info in backup_table');
                console.log('  GET /files - List uploaded PDF and Excel files with metadata');
                console.log('  GET /files/:filename - Download original PDF or Excel files');
                console.log('  DELETE /files/:filename - Archive or delete PDF/Excel files');
                console.log('  GET /processing-status/:fileId - Get file processing status');
                console.log('  GET /extraction-report/:fileId - Get detailed extraction report');
                console.log('  GET /worksheet-info/:fileId - Get Excel worksheet information');
                console.log('  GET /column-mapping/:fileId - Get Excel column mapping');
                console.log('  GET /stats - Get dual-table database statistics');
                console.log('  GET /health - Health check');
                console.log('  GET /api - API documentation');
                console.log('\n🚀 Application started successfully!');
            });

            // Graceful shutdown handling
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Failed to start application:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    /**
     * Initialize dual-table database schema
     */
    async initializeDualTableSchema() {
        try {
            // Ensure database connection is established
            await databaseManager.connect();

            // Initialize both backup_table and check_table
            await databaseManager.initializeTables();

            // Verify tables are created properly
            const stats = await databaseManager.getTableStats();
            console.log('Database tables initialized:', {
                backupTable: stats.backupTable,
                checkTable: stats.checkTable
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize dual-table schema:', error.message);
            throw error;
        }
    }

    /**
     * Perform startup health checks
     */
    async performStartupChecks() {
        console.log('Performing startup health checks...');

        // Check database connectivity
        try {
            await databaseManager.connect();
            console.log('✅ Database connectivity check passed');
        } catch (error) {
            console.error('❌ Database connectivity check failed:', error.message);
            throw error;
        }

        // Check required directories
        const fs = require('fs');
        const requiredDirs = [
            this.config.upload.directory,
            this.config.export.directory
        ];

        for (const dir of requiredDirs) {
            if (!fs.existsSync(dir)) {
                console.error(`❌ Required directory missing: ${dir}`);
                throw new Error(`Required directory missing: ${dir}`);
            }
        }
        console.log('✅ Directory structure check passed');

        // Check write permissions
        try {
            const testFile = path.join(this.config.upload.directory, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ File system permissions check passed');
        } catch (error) {
            console.error('❌ File system permissions check failed:', error.message);
            throw error;
        }

        // Validate service configurations
        try {
            const validatorConfig = this.singaporePhoneValidator.validateConfiguration();
            if (!validatorConfig.isValid) {
                console.error('❌ Singapore phone validator configuration issues:', validatorConfig.issues);
                throw new Error('Singapore phone validator configuration is invalid');
            }

            const processorConfig = this.phoneValidationProcessor.validateConfiguration();
            if (!processorConfig.isValid) {
                console.error('❌ Phone validation processor configuration issues:', processorConfig.issues);
                throw new Error('Phone validation processor configuration is invalid');
            }

            console.log('✅ Service configuration validation passed');
        } catch (error) {
            console.error('❌ Service configuration validation failed:', error.message);
            throw error;
        }

        console.log('All startup health checks passed ✅\n');
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('Cleaning up application resources...');

            // Close database connections
            if (databaseManager) {
                await databaseManager.close();
                console.log('Database connections closed');
            }

            console.log('Application cleanup completed');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Setup graceful shutdown handling
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

            if (this.server) {
                this.server.close(async (error) => {
                    if (error) {
                        console.error('Error during server shutdown:', error);
                        process.exit(1);
                    }

                    console.log('Server closed successfully');

                    // Close database connections
                    try {
                        await databaseManager.close();
                        console.log('Database connections closed successfully');
                    } catch (error) {
                        console.error('Error closing database connections:', error);
                    }

                    console.log('Graceful shutdown completed');
                    process.exit(0);
                });

                // Force shutdown after configured timeout
                setTimeout(() => {
                    console.error('Forced shutdown after timeout');
                    process.exit(1);
                }, this.config.shutdown.timeout);
            } else {
                process.exit(0);
            }
        };

        // Listen for shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }

    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }

    /**
     * Get service instances for external access
     */
    getServices() {
        return {
            pdfProcessor: this.pdfProcessor,
            singaporePhoneValidator: this.singaporePhoneValidator,
            phoneValidationProcessor: this.phoneValidationProcessor,
            databaseManager: databaseManager
        };
    }
}

// Create and export application instance
const application = new Application();

// Start the application if this file is run directly
if (require.main === module) {
    application.start().catch(error => {
        console.error('Application startup failed:', error);
        process.exit(1);
    });
}

module.exports = application;
