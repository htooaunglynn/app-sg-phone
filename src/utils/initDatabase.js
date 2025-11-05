const databaseManager = require('./database');
const config = require('./config');

/**
 * Database initialization utility for dual-table architecture
 * Sets up backup_table and check_table with proper constraints and indexes
 */
class DatabaseInitializer {
    constructor() {
        this.databaseManager = databaseManager;
    }

    /**
     * Initialize the complete database schema
     */
    async initialize() {
        try {
            console.log('Starting database initialization...');

            // Ensure database connection
            await this.databaseManager.connect();

            // Create tables with proper constraints and indexes
            await this.createBackupTable();
            await this.createCheckTable();
            await this.createUploadedFilesTable();
            await this.createUsersTable();
            await this.createUserLoginsTable();

            // Verify table creation
            await this.verifyTables();

            console.log('Database initialization completed successfully');
            return true;

        } catch (error) {
            console.error('Database initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Create backup_table for storing raw Excel data with company information
     */
    async createBackupTable() {
        console.log('Creating backup_table...');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS backup_table (
        Id VARCHAR(100) NOT NULL,
        Phone VARCHAR(50) NOT NULL,
        CompanyName VARCHAR(255) NULL COMMENT 'Company name from Excel data',
        PhysicalAddress TEXT NULL COMMENT 'Company physical address',
        Email VARCHAR(255) NULL COMMENT 'Company email address',
        Website VARCHAR(255) NULL COMMENT 'Company website URL',
        source_file VARCHAR(255) NULL COMMENT 'Original Excel filename',
        extracted_metadata TEXT NULL COMMENT 'JSON metadata from Excel extraction',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (Id),
        INDEX idx_phone (Phone),
        INDEX idx_company_name (CompanyName),
        INDEX idx_email (Email),
        INDEX idx_source_file (source_file),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='Table for storing raw Excel data with company information'
    `;

        await this.databaseManager.query(createTableSQL);

        // Check if we need to add the new columns to existing table
        await this.addBackupTableColumns();

        console.log('backup_table created or verified successfully');
    }

    /**
     * Add new columns to existing backup_table if they don't exist
     */
    async addBackupTableColumns() {
        try {
            // Check current table structure
            const columns = await this.databaseManager.query('DESCRIBE backup_table');
            const columnNames = columns.map(col => col.Field);

            // Add company-related columns if they don't exist
            if (!columnNames.includes('CompanyName')) {
                console.log('Adding CompanyName column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN CompanyName VARCHAR(255) NULL COMMENT 'Company name from Excel data' AFTER Phone
        `);
                await this.databaseManager.query('ALTER TABLE backup_table ADD INDEX idx_company_name (CompanyName)');
            }

            if (!columnNames.includes('PhysicalAddress')) {
                console.log('Adding PhysicalAddress column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN PhysicalAddress TEXT NULL COMMENT 'Company physical address' AFTER CompanyName
        `);
            }

            if (!columnNames.includes('Email')) {
                console.log('Adding Email column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN Email VARCHAR(255) NULL COMMENT 'Company email address' AFTER PhysicalAddress
        `);
                await this.databaseManager.query('ALTER TABLE backup_table ADD INDEX idx_email (Email)');
            }

            if (!columnNames.includes('Website')) {
                console.log('Adding Website column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN Website VARCHAR(255) NULL COMMENT 'Company website URL' AFTER Email
        `);
            }

            // Add legacy columns if they don't exist
            if (!columnNames.includes('source_file')) {
                console.log('Adding source_file column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN source_file VARCHAR(255) NULL COMMENT 'Original Excel filename' AFTER Website
        `);
                await this.databaseManager.query('ALTER TABLE backup_table ADD INDEX idx_source_file (source_file)');
            }

            if (!columnNames.includes('extracted_metadata')) {
                console.log('Adding extracted_metadata column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN extracted_metadata TEXT NULL COMMENT 'JSON metadata from Excel extraction' AFTER source_file
        `);
            }

            // Add updated_at column if it doesn't exist
            if (!columnNames.includes('updated_at')) {
                console.log('Adding updated_at column to backup_table...');
                await this.databaseManager.query(`
          ALTER TABLE backup_table
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
        `);
            }

        } catch (error) {
            console.error('Error adding backup_table columns:', error.message);
            // Don't throw error, as table might already have the columns
        }
    }

    /**
     * Add Excel support columns to existing uploaded_files table if they don't exist
     */
    async addExcelSupportColumns() {
        try {
            // Check current table structure
            const columns = await this.databaseManager.query('DESCRIBE uploaded_files');
            const columnNames = columns.map(col => col.Field);

            // Add file_type column if it doesn't exist
            if (!columnNames.includes('file_type')) {
                console.log('Adding file_type column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN file_type ENUM('pdf', 'excel') NOT NULL DEFAULT 'pdf'
          COMMENT 'File type to distinguish between PDF and Excel files'
          AFTER file_size
        `);

                // Add index for file_type
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD INDEX idx_file_type (file_type)
        `);
            }

            // Add worksheets_processed column if it doesn't exist
            if (!columnNames.includes('worksheets_processed')) {
                console.log('Adding worksheets_processed column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN worksheets_processed INT DEFAULT 0
          COMMENT 'Number of worksheets processed for Excel files'
          AFTER records_extracted
        `);
            }

            // Add extraction_report column if it doesn't exist
            if (!columnNames.includes('extraction_report')) {
                console.log('Adding extraction_report column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN extraction_report TEXT NULL
          COMMENT 'Detailed processing reports for Excel files'
          AFTER worksheets_processed
        `);
            }

            // Add duplicate handling columns if they don't exist
            if (!columnNames.includes('duplicates_skipped')) {
                console.log('Adding duplicates_skipped column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN duplicates_skipped INT DEFAULT 0
          COMMENT 'Number of duplicate records skipped during processing'
          AFTER extraction_report
        `);
            }

            if (!columnNames.includes('duplicate_percentage')) {
                console.log('Adding duplicate_percentage column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN duplicate_percentage DECIMAL(5,2) DEFAULT 0.00
          COMMENT 'Percentage of records that were duplicates'
          AFTER duplicates_skipped
        `);
            }

            if (!columnNames.includes('duplicate_handling_status')) {
                console.log('Adding duplicate_handling_status column to uploaded_files...');
                await this.databaseManager.query(`
          ALTER TABLE uploaded_files
          ADD COLUMN duplicate_handling_status ENUM('unknown', 'no_duplicates_found', 'duplicates_skipped', 'storage_failed') DEFAULT 'unknown'
          COMMENT 'Status of duplicate handling for this file'
          AFTER duplicate_percentage
        `);
            }

            // Update processing_status enum to include 'archived'
            console.log('Updating processing_status enum to include archived...');
            await this.databaseManager.query(`
        ALTER TABLE uploaded_files
        MODIFY COLUMN processing_status ENUM('pending', 'processed', 'failed', 'archived') DEFAULT 'pending'
        COMMENT 'Processing status'
      `);

        } catch (error) {
            console.error('Error adding Excel support columns:', error.message);
            // Don't throw error, as table might already have the columns
        }
    }

    /**
     * Create editable check_table for storing validated data with company information
     */
    async createCheckTable() {
        console.log('Creating check_table...');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS check_table (
        Id VARCHAR(100) NOT NULL,
        Phone VARCHAR(50) NOT NULL,
        Status BOOLEAN NULL COMMENT 'true for Singapore phone, false for non-Singapore',
        CompanyName VARCHAR(255) NULL,
        PhysicalAddress TEXT NULL,
        Email VARCHAR(255) NULL,
        Website VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (Id),
        UNIQUE KEY unique_email (Email),
        INDEX idx_phone (Phone),
        INDEX idx_status (Status),
        INDEX idx_email (Email),
        INDEX idx_created_at (created_at),
        INDEX idx_updated_at (updated_at),
        INDEX idx_company_name (CompanyName)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='Editable table for validated phone data with company information'
    `;

        await this.databaseManager.query(createTableSQL);
        console.log('check_table created or verified successfully');
    }

    /**
     * Create uploaded_files table for file metadata tracking (PDF and Excel)
     */
    async createUploadedFilesTable() {
        console.log('Creating uploaded_files table...');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        original_filename VARCHAR(255) NOT NULL COMMENT 'Original filename as uploaded',
        stored_filename VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique filename in storage',
        file_size BIGINT NOT NULL COMMENT 'File size in bytes',
        file_type ENUM('pdf', 'excel') NOT NULL DEFAULT 'pdf' COMMENT 'File type to distinguish between PDF and Excel files',
        checksum VARCHAR(64) NULL COMMENT 'SHA-256 checksum for integrity',
        upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When file was uploaded',
        processing_status ENUM('pending', 'processed', 'failed', 'archived') DEFAULT 'pending' COMMENT 'Processing status',
        records_extracted INT DEFAULT 0 COMMENT 'Number of records extracted from file',
        worksheets_processed INT DEFAULT 0 COMMENT 'Number of worksheets processed for Excel files',
        extraction_report TEXT NULL COMMENT 'Detailed processing reports for Excel files',
        processed_at TIMESTAMP NULL COMMENT 'When processing completed',
        INDEX idx_stored_filename (stored_filename),
        INDEX idx_upload_timestamp (upload_timestamp),
        INDEX idx_processing_status (processing_status),
        INDEX idx_original_filename (original_filename),
        INDEX idx_file_type (file_type)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='File metadata tracking for uploaded PDFs and Excel files'
    `;

        await this.databaseManager.query(createTableSQL);

        // Ensure Excel-specific columns exist for existing installations
        await this.addExcelSupportColumns();

        console.log('uploaded_files table created or verified successfully');
    }

    /**
     * Verify that tables were created with correct structure
     */
    async verifyTables() {
        console.log('Verifying table structures...');

        try {
            // Verify backup_table structure
            const backupTableInfo = await this.databaseManager.query('DESCRIBE backup_table');
            console.log('backup_table structure verified:', backupTableInfo.length, 'columns');

            // Verify check_table structure
            const checkTableInfo = await this.databaseManager.query('DESCRIBE check_table');
            console.log('check_table structure verified:', checkTableInfo.length, 'columns');

            // Verify uploaded_files table structure
            const uploadedFilesInfo = await this.databaseManager.query('DESCRIBE uploaded_files');
            console.log('uploaded_files table structure verified:', uploadedFilesInfo.length, 'columns');

            // Verify indexes with error handling
            try {
                const backupIndexes = await this.databaseManager.query('SHOW INDEX FROM backup_table');
                console.log(`backup_table indexes: ${backupIndexes.length}`);
            } catch (indexError) {
                console.warn('Could not verify backup_table indexes:', indexError.message);
            }

            try {
                const checkIndexes = await this.databaseManager.query('SHOW INDEX FROM check_table');
                console.log(`check_table indexes: ${checkIndexes.length}`);
            } catch (indexError) {
                console.warn('Could not verify check_table indexes:', indexError.message);
            }

            try {
                const uploadedFilesIndexes = await this.databaseManager.query('SHOW INDEX FROM uploaded_files');
                console.log(`uploaded_files indexes: ${uploadedFilesIndexes.length}`);
            } catch (indexError) {
                console.warn('Could not verify uploaded_files indexes:', indexError.message);
            }

            // Verify constraints
            await this.verifyConstraints();

        } catch (error) {
            console.error('Error during table verification:', error.message);
            throw error;
        }
    }

    /**
     * Verify table constraints are properly set
     */
    async verifyConstraints() {
        console.log('Verifying table constraints...');

        // Check for unique email constraint in check_table
        const constraints = await this.databaseManager.query(`
      SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, TABLE_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('backup_table', 'check_table', 'uploaded_files')
    `, [config.database.database]);

        const uniqueEmailConstraint = constraints.find(c =>
            c.TABLE_NAME === 'check_table' &&
            c.CONSTRAINT_NAME === 'unique_email' &&
            c.CONSTRAINT_TYPE === 'UNIQUE'
        );

        if (uniqueEmailConstraint) {
            console.log('Email uniqueness constraint verified');
        } else {
            console.warn('Email uniqueness constraint not found');
        }

        console.log('Constraint verification completed');
    }

    /**
     * Drop tables (for testing/reset purposes)
     */
    async dropTables() {
        console.log('Dropping tables...');

        try {
            await this.databaseManager.query('DROP TABLE IF EXISTS uploaded_files');
            await this.databaseManager.query('DROP TABLE IF EXISTS check_table');
            await this.databaseManager.query('DROP TABLE IF EXISTS backup_table');
            console.log('Tables dropped successfully');
        } catch (error) {
            console.error('Error dropping tables:', error.message);
            throw error;
        }
    }

    /**
     * Reset database (drop and recreate tables)
     */
    async reset() {
        console.log('Resetting database...');

        await this.dropTables();
        await this.initialize();

        console.log('Database reset completed');
    }

    /**
     * Test table constraints by attempting invalid operations
     */
    async testConstraints() {
        console.log('Testing table constraints...');

        try {
            // Test backup_table immutability (this should be enforced at application level)
            console.log('Testing backup_table operations...');

            // Test check_table email uniqueness
            console.log('Testing check_table email uniqueness...');

            // Insert test record
            await this.databaseManager.insertCheckRecord('TEST001', '12345678', true, 'Test Company', 'Test Address', 'test@example.com', 'https://test.com');

            // Try to insert duplicate email (should fail)
            try {
                await this.databaseManager.insertCheckRecord('TEST002', '87654321', false, 'Another Company', 'Another Address', 'test@example.com', 'https://another.com');
                console.error('ERROR: Duplicate email constraint not working!');
            } catch (error) {
                if (error.message.includes('Email address already exists')) {
                    console.log('Email uniqueness constraint working correctly');
                } else {
                    throw error;
                }
            }

            // Clean up test data
            await this.databaseManager.query('DELETE FROM check_table WHERE Id IN ("TEST001", "TEST002")');

            console.log('Constraint testing completed successfully');

        } catch (error) {
            console.error('Constraint testing failed:', error.message);
            throw error;
        }
    }

    /**
     * Create users table for authentication
     */
    async createUsersTable() {
        console.log('Creating users table...');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        password VARCHAR(255) NOT NULL,
        status ENUM('active','inactive','banned') DEFAULT 'active',
        device VARCHAR(200) NULL,
        ip_address VARCHAR(45) NULL,
        location VARCHAR(255) NULL,
        last_seen DATETIME NULL,
        login_token VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY email (email),
        INDEX idx_status (status),
        INDEX idx_last_seen (last_seen),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='User accounts for authentication system'
    `;

        await this.databaseManager.query(createTableSQL);
        console.log('users table created or verified successfully');
    }

    /**
     * Create user_logins table for login tracking
     */
    async createUserLoginsTable() {
        console.log('Creating user_logins table...');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_logins (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        device VARCHAR(200) NULL,
        ip_address VARCHAR(45) NULL,
        location VARCHAR(255) NULL,
        result ENUM('success','failed') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_result (result),
        INDEX idx_created_at (created_at),
        INDEX idx_ip_address (ip_address)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='Login attempt tracking for security monitoring'
    `;

        await this.databaseManager.query(createTableSQL);
        console.log('user_logins table created or verified successfully');
    }
}

// Export singleton instance
const databaseInitializer = new DatabaseInitializer();
module.exports = databaseInitializer;
