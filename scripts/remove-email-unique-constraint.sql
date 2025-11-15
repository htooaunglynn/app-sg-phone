-- Migration script to remove UNIQUE constraint from email column
-- Run this on your existing database

-- Drop the unique constraint on email
ALTER TABLE check_table DROP CONSTRAINT IF EXISTS check_table_email_key;

-- Drop the index on email (if it exists)
DROP INDEX IF EXISTS idx_email;

-- Verify the changes
SELECT
    tc.constraint_name,
    tc.constraint_type
FROM
    information_schema.table_constraints tc
WHERE
    tc.table_name = 'check_table'
    AND tc.constraint_type = 'UNIQUE';
