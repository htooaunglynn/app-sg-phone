-- ============================================
-- Migration Script: Remove backup_table and uploaded_files
-- ============================================
-- This script migrates data and removes unused tables
-- Run this AFTER backing up your database!
--
-- Backup command:
-- mysqldump -u root -p singapore_phone_db > backup_before_cleanup_$(date +%Y%m%d).sql
-- ============================================

USE singapore_phone_db;

-- Step 1: Migrate data from backup_table to check_table (if backup_table exists)
-- This will preserve any data you have in backup_table

INSERT IGNORE INTO check_table (id, phone, status, company_name, physical_address, email, website, created_at)
SELECT
    Id,
    Phone,
    0 AS status, -- Will need re-validation, or you can validate during migration
    company_name,
    physical_address,
    email,
    website,
    created_at
FROM backup_table
WHERE EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'singapore_phone_db'
              AND table_name = 'backup_table')
ON DUPLICATE KEY UPDATE
    company_name = COALESCE(VALUES(company_name), check_table.company_name),
    physical_address = COALESCE(VALUES(physical_address), check_table.physical_address),
    email = COALESCE(VALUES(email), check_table.email),
    website = COALESCE(VALUES(website), check_table.website),
    updated_at = CURRENT_TIMESTAMP;

-- Show migration statistics
SELECT
    'Migration Statistics' AS Info,
    (SELECT COUNT(*) FROM check_table) AS total_records_in_check_table;

-- Step 2: Drop backup_table (after confirming migration)
DROP TABLE IF EXISTS backup_table;

-- Step 3: Drop uploaded_files table
DROP TABLE IF EXISTS uploaded_files;

-- Step 4: Verify remaining tables
SELECT
    table_name AS 'Remaining Tables',
    table_rows AS 'Approximate Rows',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'singapore_phone_db'
ORDER BY table_name;

-- Step 5: Show check_table statistics
SELECT
    COUNT(*) AS total_records,
    COUNT(DISTINCT phone) AS unique_phones,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS valid_singapore_phones,
    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS invalid_phones,
    SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) AS unvalidated_phones
FROM check_table;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Make sure to backup your database before running this script
-- 2. Review the migration statistics before proceeding with drops
-- 3. If you need to re-validate phone numbers after migration, use:
--    UPDATE check_table SET status = 0 WHERE status IS NULL;
-- 4. The application will now only use check_table
-- 5. No more backup_table or uploaded_files references in code
-- ============================================

COMMIT;
