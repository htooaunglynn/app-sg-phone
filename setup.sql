-- Singapore Phone Detect Database Setup
-- This script creates the complete database schema for the Singapore Phone Detection system
-- Run this script to manually set up the database tables

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS singapore_phone_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE singapore_phone_db;

-- =============================================================================
-- PHONE RECORDS TABLE
-- =============================================================================
-- Main table for storing phone records extracted from PDF and Excel files
-- This table stores the basic phone data with identifiers

DROP TABLE IF EXISTS phone_records;

CREATE TABLE phone_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique identifier for the phone record',
    phone_number VARCHAR(20) NOT NULL COMMENT 'Singapore phone number',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
    
    -- Indexes for performance
    INDEX idx_identifier (identifier),
    INDEX idx_phone_number (phone_number),
    INDEX idx_created_at (created_at),
    
    -- Constraints
    CONSTRAINT chk_phone_format CHECK (phone_number REGEXP '^[689][0-9]{7}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Main table for storing phone records with identifiers';

-- =============================================================================
-- CHECK TABLE
-- =============================================================================
-- Enhanced table for storing validated phone records with company information
-- This table includes additional business data like company names, emails, etc.

DROP TABLE IF EXISTS check_table;

CREATE TABLE check_table (
    Id VARCHAR(100) NOT NULL PRIMARY KEY COMMENT 'Primary identifier (e.g., SG COM-2001)',
    numeric_id INT GENERATED ALWAYS AS (
        CASE 
            WHEN Id REGEXP '[0-9]+$' THEN CAST(REGEXP_SUBSTR(Id, '[0-9]+$') AS UNSIGNED)
            ELSE NULL 
        END
    ) STORED COMMENT 'Extracted numeric ID for sorting and range queries',
    Phone VARCHAR(50) NOT NULL COMMENT 'Singapore phone number',
    Status BOOLEAN NULL COMMENT 'TRUE if valid Singapore phone, FALSE otherwise, NULL if not validated',
    CompanyName VARCHAR(255) NULL COMMENT 'Company or business name',
    PhysicalAddress TEXT NULL COMMENT 'Physical business address',
    Email VARCHAR(255) NULL COMMENT 'Contact email address',
    Website VARCHAR(255) NULL COMMENT 'Company website URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
    
    -- Indexes for performance
    INDEX idx_numeric_id (numeric_id),
    INDEX idx_phone (Phone),
    INDEX idx_status (Status),
    INDEX idx_email (Email),
    INDEX idx_company_name (CompanyName),
    INDEX idx_created_at (created_at),
    
    -- Unique constraints
    UNIQUE KEY unique_email (Email),
    
    -- Check constraints
    CONSTRAINT chk_email_format CHECK (Email IS NULL OR Email REGEXP '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
    CONSTRAINT chk_phone_singapore CHECK (Phone REGEXP '^[689][0-9]{7}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Enhanced table for validated phone records with company information';

-- =============================================================================
-- BACKUP TABLE (Optional)
-- =============================================================================
-- Backup table for data recovery and validation purposes
-- Mirrors the structure of phone_records for backup operations

DROP TABLE IF EXISTS backup_table;

CREATE TABLE backup_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(50) NOT NULL COMMENT 'Original identifier from source',
    phone_number VARCHAR(20) NOT NULL COMMENT 'Phone number',
    source_file VARCHAR(255) NULL COMMENT 'Source file name',
    processing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this record was processed',
    validation_status ENUM('pending', 'validated', 'invalid', 'duplicate') DEFAULT 'pending' COMMENT 'Validation status',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_identifier_backup (identifier),
    INDEX idx_phone_backup (phone_number),
    INDEX idx_source_file (source_file),
    INDEX idx_validation_status (validation_status),
    INDEX idx_processing_date (processing_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Backup table for data recovery and validation tracking';

-- =============================================================================
-- FILE PROCESSING LOG TABLE
-- =============================================================================
-- Table to track file uploads and processing status

DROP TABLE IF EXISTS file_processing_log;

CREATE TABLE file_processing_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique file identifier',
    original_filename VARCHAR(255) NOT NULL COMMENT 'Original uploaded filename',
    file_type ENUM('pdf', 'excel') NOT NULL COMMENT 'Type of uploaded file',
    file_size BIGINT NOT NULL COMMENT 'File size in bytes',
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When file was uploaded',
    processing_status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending' COMMENT 'Current processing status',
    processing_start_time TIMESTAMP NULL COMMENT 'When processing started',
    processing_end_time TIMESTAMP NULL COMMENT 'When processing completed',
    records_extracted INT DEFAULT 0 COMMENT 'Number of records extracted',
    records_inserted INT DEFAULT 0 COMMENT 'Number of records successfully inserted',
    records_updated INT DEFAULT 0 COMMENT 'Number of records updated',
    records_failed INT DEFAULT 0 COMMENT 'Number of records that failed processing',
    error_message TEXT NULL COMMENT 'Error message if processing failed',
    extraction_report JSON NULL COMMENT 'Detailed extraction report for Excel files',
    
    -- Indexes
    INDEX idx_file_id (file_id),
    INDEX idx_file_type (file_type),
    INDEX idx_processing_status (processing_status),
    INDEX idx_upload_timestamp (upload_timestamp),
    INDEX idx_processing_times (processing_start_time, processing_end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Log table for tracking file uploads and processing status';

-- =============================================================================
-- SYSTEM CONFIGURATION TABLE
-- =============================================================================
-- Table for storing system configuration and settings

DROP TABLE IF EXISTS system_config;

CREATE TABLE system_config (
    config_key VARCHAR(100) NOT NULL PRIMARY KEY COMMENT 'Configuration key',
    config_value TEXT NOT NULL COMMENT 'Configuration value',
    config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT 'Value data type',
    description TEXT NULL COMMENT 'Description of the configuration',
    is_editable BOOLEAN DEFAULT TRUE COMMENT 'Whether this config can be modified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_config_type (config_type),
    INDEX idx_is_editable (is_editable)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='System configuration and settings storage';



-- =============================================================================
-- CREATE VIEWS FOR REPORTING
-- =============================================================================

-- View for phone records statistics
CREATE OR REPLACE VIEW phone_records_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT phone_number) as unique_phones,
    MIN(created_at) as first_record_date,
    MAX(created_at) as last_record_date,
    DATE(created_at) as record_date,
    COUNT(*) as daily_count
FROM phone_records
GROUP BY DATE(created_at)
WITH CHECK OPTION;

-- View for check table statistics
CREATE OR REPLACE VIEW check_table_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN Status = TRUE THEN 1 END) as valid_singapore_phones,
    COUNT(CASE WHEN Status = FALSE THEN 1 END) as invalid_phones,
    COUNT(CASE WHEN Status IS NULL THEN 1 END) as unvalidated_phones,
    COUNT(CASE WHEN CompanyName IS NOT NULL THEN 1 END) as records_with_company,
    COUNT(CASE WHEN Email IS NOT NULL THEN 1 END) as records_with_email,
    COUNT(CASE WHEN Website IS NOT NULL THEN 1 END) as records_with_website,
    MIN(created_at) as first_record_date,
    MAX(created_at) as last_record_date
FROM check_table;

-- View for file processing statistics
CREATE OR REPLACE VIEW file_processing_stats AS
SELECT 
    file_type,
    processing_status,
    COUNT(*) as file_count,
    SUM(records_extracted) as total_extracted,
    SUM(records_inserted) as total_inserted,
    SUM(records_updated) as total_updated,
    SUM(records_failed) as total_failed,
    AVG(TIMESTAMPDIFF(SECOND, processing_start_time, processing_end_time)) as avg_processing_time_seconds
FROM file_processing_log
WHERE processing_start_time IS NOT NULL
GROUP BY file_type, processing_status;

-- =============================================================================
-- CREATE STORED PROCEDURES
-- =============================================================================

DELIMITER //

-- Procedure to get database statistics
CREATE PROCEDURE GetDatabaseStats()
BEGIN
    SELECT 
        'phone_records' as table_name,
        COUNT(*) as record_count,
        MIN(created_at) as first_record,
        MAX(created_at) as last_record
    FROM phone_records
    
    UNION ALL
    
    SELECT 
        'check_table' as table_name,
        COUNT(*) as record_count,
        MIN(created_at) as first_record,
        MAX(created_at) as last_record
    FROM check_table
    
    UNION ALL
    
    SELECT 
        'file_processing_log' as table_name,
        COUNT(*) as record_count,
        MIN(upload_timestamp) as first_record,
        MAX(upload_timestamp) as last_record
    FROM file_processing_log;
END //

-- Procedure to cleanup old processing logs
CREATE PROCEDURE CleanupOldLogs(IN days_to_keep INT)
BEGIN
    DELETE FROM file_processing_log 
    WHERE upload_timestamp < DATE_SUB(NOW(), INTERVAL days_to_keep DAY)
    AND processing_status IN ('completed', 'failed', 'cancelled');
    
    SELECT ROW_COUNT() as deleted_records;
END //

-- Procedure to validate phone number format
CREATE PROCEDURE ValidatePhoneNumber(IN phone_input VARCHAR(50), OUT is_valid BOOLEAN, OUT formatted_phone VARCHAR(20))
BEGIN
    DECLARE clean_phone VARCHAR(20);
    
    -- Remove all non-digit characters
    SET clean_phone = REGEXP_REPLACE(phone_input, '[^0-9]', '');
    
    -- Check if it matches Singapore phone pattern
    IF clean_phone REGEXP '^[689][0-9]{7}$' THEN
        SET is_valid = TRUE;
        SET formatted_phone = clean_phone;
    ELSE
        SET is_valid = FALSE;
        SET formatted_phone = NULL;
    END IF;
END //

DELIMITER ;

-- =============================================================================
-- GRANT PERMISSIONS (Uncomment and modify as needed)
-- =============================================================================

-- Create application user (uncomment if needed)
-- CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
-- CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'secure_password';

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON singapore_phone_db.* TO 'app_user'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON singapore_phone_db.* TO 'app_user'@'%';
-- GRANT EXECUTE ON PROCEDURE singapore_phone_db.GetDatabaseStats TO 'app_user'@'localhost';
-- GRANT EXECUTE ON PROCEDURE singapore_phone_db.CleanupOldLogs TO 'app_user'@'localhost';
-- GRANT EXECUTE ON PROCEDURE singapore_phone_db.ValidatePhoneNumber TO 'app_user'@'localhost';

-- Flush privileges
-- FLUSH PRIVILEGES;

-- =============================================================================
-- VERIFICATION QUERIES (Optional - uncomment to verify setup)
-- =============================================================================

-- Verify tables were created successfully
-- SELECT 
--     TABLE_NAME,
--     TABLE_ROWS,
--     CREATE_TIME,
--     TABLE_COMMENT
-- FROM information_schema.TABLES 
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME;

-- Verify indexes were created
-- SELECT 
--     TABLE_NAME,
--     INDEX_NAME,
--     COLUMN_NAME,
--     INDEX_TYPE
-- FROM information_schema.STATISTICS 
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME, INDEX_NAME;

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

-- SELECT 'Database setup completed successfully!' as status,
--        DATABASE() as database_name,
--        NOW() as setup_time;