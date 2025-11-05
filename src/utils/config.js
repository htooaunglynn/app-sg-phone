const path = require('path');
require('dotenv').config();

/**
 * Configuration utility for managing environment variables and application settings
 */
class Config {
    constructor() {
        this.validateEnvironment();
        this.ensureDirectories();
    }

    /**
     * Database configuration
     * Supports both MySQL (local) and PostgreSQL (production)
     */
    get database() {
        const dbType = process.env.DB_TYPE || 'mysql';

        // PostgreSQL production configuration (supports DATABASE_URL from Render)
        if (dbType === 'postgres') {
            return {
                type: 'postgres',
                connectionString: process.env.DATABASE_URL,
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'singapore_phone_db',
                connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
                ssl: process.env.DB_SSL === 'true'
            };
        }

        // MySQL local development configuration
        return {
            type: 'mysql',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'singapore_phone_db',
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10
        };
    }

    /**
     * Server configuration
     */
    get server() {
        return {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || '0.0.0.0',
            environment: process.env.NODE_ENV || 'development',
            corsOrigin: process.env.CORS_ORIGIN || '*'
        };
    }

    /**
     * File upload configuration
     */
    get upload() {
        return {
            directory: process.env.UPLOAD_DIR || './uploads',
            maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
            allowedMimeTypes: ['application/pdf'],
            tempDirectory: process.env.TEMP_DIR || './uploads/temp'
        };
    }

    /**
     * Export configuration
     */
    get export() {
        return {
            directory: process.env.EXPORT_DIR || './exports',
            maxRecordsPerExport: parseInt(process.env.MAX_EXPORT_RECORDS) || 100000,
            tempDirectory: process.env.EXPORT_TEMP_DIR || './exports/temp'
        };
    }

    /**
     * Singapore phone validation configuration
     */
    get phoneValidation() {
        return {
            singaporeCountryCode: process.env.SINGAPORE_COUNTRY_CODE || 'SG',
            batchValidationSize: parseInt(process.env.BATCH_VALIDATION_SIZE) || 1000,
            enableValidationLogging: process.env.ENABLE_VALIDATION_LOGGING === 'true'
        };
    }

    /**
     * Dual-table configuration
     */
    get dualTable() {
        return {
            backupTableName: process.env.BACKUP_TABLE_NAME || 'backup_table',
            checkTableName: process.env.CHECK_TABLE_NAME || 'check_table',
            autoProcessValidation: process.env.AUTO_PROCESS_VALIDATION === 'true',
            validationProcessingDelay: parseInt(process.env.VALIDATION_PROCESSING_DELAY) || 5000
        };
    }

    /**
     * Graceful shutdown configuration
     */
    get shutdown() {
        return {
            timeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000,
            enableGracefulShutdown: process.env.ENABLE_GRACEFUL_SHUTDOWN !== 'false'
        };
    }

    /**
     * Security configuration
     */
    get security() {
        return {
            rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
            rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100,
            sessionSecret: process.env.SESSION_SECRET || 'singapore-phone-detect-secret',
            enableHttps: process.env.ENABLE_HTTPS === 'true',
            httpsPort: parseInt(process.env.HTTPS_PORT) || 443,
            // Enhanced security settings
            enableSecurityScanning: process.env.ENABLE_SECURITY_SCANNING !== 'false',
            enableVirusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true',
            maxFilesPerHour: parseInt(process.env.MAX_FILES_PER_HOUR) || 100,
            enableFileIntegrityCheck: process.env.ENABLE_FILE_INTEGRITY_CHECK !== 'false',
            strictSecurity: process.env.STRICT_SECURITY === 'true',
            maxPathLength: parseInt(process.env.MAX_PATH_LENGTH) || 255
        };
    }

    /**
     * Performance configuration
     */
    get performance() {
        return {
            streamingThreshold: parseInt(process.env.STREAMING_THRESHOLD) || 5 * 1024 * 1024, // 5MB
            maxPdfSize: parseInt(process.env.MAX_PDF_SIZE) || 50 * 1024 * 1024, // 50MB
            maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME) || 300000, // 5 minutes
            memoryLimit: parseInt(process.env.MEMORY_LIMIT) || 512 * 1024 * 1024, // 512MB
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 1024 * 1024, // 1MB
            enableMemoryOptimization: process.env.ENABLE_MEMORY_OPTIMIZATION !== 'false',
            enableFileStreaming: process.env.ENABLE_FILE_STREAMING !== 'false',
            enableCompression: process.env.ENABLE_COMPRESSION === 'true',
            compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
            enableFileCaching: process.env.ENABLE_FILE_CACHING === 'true',
            cacheSize: parseInt(process.env.CACHE_SIZE) || 100 * 1024 * 1024 // 100MB
        };
    }

    /**
     * Logging configuration
     */
    get logging() {
        return {
            level: process.env.LOG_LEVEL || 'info',
            enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
            logDirectory: process.env.LOG_DIR || './logs',
            maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
            maxLogSize: process.env.MAX_LOG_SIZE || '10m'
        };
    }

    /**
     * Application metadata
     */
    get app() {
        const packageJson = require('../../package.json');
        return {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            startTime: new Date().toISOString()
        };
    }

    /**
     * Validate required environment variables
     */
    validateEnvironment() {
        const dbType = process.env.DB_TYPE || 'mysql';

        let required = [];

        // PostgreSQL in production (using DATABASE_URL)
        if (dbType === 'postgres' && process.env.DATABASE_URL) {
            required = ['DATABASE_URL'];
        }
        // PostgreSQL with individual config (password can be empty for local trust auth)
        else if (dbType === 'postgres') {
            required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
        }
        // MySQL
        else {
            required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
        }

        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            console.error('Missing required environment variables:');
            missing.forEach(key => console.error(`  - ${key}`));
            console.error('\nPlease check your .env file or environment configuration.');

            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            } else {
                console.warn('Running in development mode with default values...');
            }
        }
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const fs = require('fs');
        const directories = [
            this.upload.directory,
            this.upload.tempDirectory,
            this.export.directory,
            this.export.tempDirectory
        ];

        if (this.logging.enableFileLogging) {
            directories.push(this.logging.logDirectory);
        }

        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                } catch (error) {
                    console.error(`Failed to create directory ${dir}:`, error.message);
                    if (process.env.NODE_ENV === 'production') {
                        process.exit(1);
                    }
                }
            }
        });
    }

    /**
     * Get all configuration as a single object
     */
    getAll() {
        return {
            database: this.database,
            server: this.server,
            upload: this.upload,
            export: this.export,
            security: this.security,
            performance: this.performance,
            logging: this.logging,
            phoneValidation: this.phoneValidation,
            dualTable: this.dualTable,
            shutdown: this.shutdown,
            app: this.app
        };
    }

    /**
     * Check if running in production
     */
    isProduction() {
        return this.server.environment === 'production';
    }

    /**
     * Check if running in development
     */
    isDevelopment() {
        return this.server.environment === 'development';
    }

    /**
     * Check if running in test mode
     */
    isTest() {
        return this.server.environment === 'test';
    }

    /**
     * Print configuration summary (without sensitive data)
     */
    printSummary() {
        console.log('\n=== Application Configuration ===');
        console.log(`App: ${this.app.name} v${this.app.version}`);
        console.log(`Environment: ${this.server.environment}`);
        console.log(`Server: ${this.server.host}:${this.server.port}`);
        console.log(`Database: ${this.database.host}:${this.database.port}/${this.database.database}`);
        console.log(`Upload Directory: ${this.upload.directory}`);
        console.log(`Export Directory: ${this.export.directory}`);
        console.log(`Max File Size: ${(this.upload.maxFileSize / 1024 / 1024).toFixed(1)}MB`);
        console.log(`Singapore Country Code: ${this.phoneValidation.singaporeCountryCode}`);
        console.log(`Batch Validation Size: ${this.phoneValidation.batchValidationSize}`);
        console.log(`Backup Table: ${this.dualTable.backupTableName}`);
        console.log(`Check Table: ${this.dualTable.checkTableName}`);
        console.log(`Auto Process Validation: ${this.dualTable.autoProcessValidation}`);
        console.log(`Graceful Shutdown: ${this.shutdown.enableGracefulShutdown}`);
        console.log('================================\n');
    }
}

// Export singleton instance
const config = new Config();
module.exports = config;
