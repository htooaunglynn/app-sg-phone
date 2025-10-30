const databaseManager = require('../database');

/**
 * Migration: Add Excel support to uploaded_files table
 * Adds file_type, worksheets_processed, and extraction_report columns
 */
class ExcelSupportMigration {
  constructor() {
    this.migrationName = '001_add_excel_support';
    this.description = 'Add Excel support columns to uploaded_files table';
  }

  /**
   * Apply the migration - add Excel support columns
   */
  async up() {
    console.log(`Running migration: ${this.migrationName}`);
    console.log(`Description: ${this.description}`);

    try {
      // Check current table structure
      const currentColumns = await databaseManager.query('DESCRIBE uploaded_files');
      const columnNames = currentColumns.map(col => col.Field);

      // Add file_type column if it doesn't exist
      if (!columnNames.includes('file_type')) {
        console.log('Adding file_type column...');
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          ADD COLUMN file_type ENUM('pdf', 'excel') NOT NULL DEFAULT 'pdf' 
          COMMENT 'File type to distinguish between PDF and Excel files'
          AFTER file_size
        `);
        
        // Add index for file_type
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          ADD INDEX idx_file_type (file_type)
        `);
        console.log('file_type column added successfully');
      } else {
        console.log('file_type column already exists, skipping...');
      }

      // Add worksheets_processed column if it doesn't exist
      if (!columnNames.includes('worksheets_processed')) {
        console.log('Adding worksheets_processed column...');
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          ADD COLUMN worksheets_processed INT DEFAULT 0 
          COMMENT 'Number of worksheets processed for Excel files'
          AFTER records_extracted
        `);
        console.log('worksheets_processed column added successfully');
      } else {
        console.log('worksheets_processed column already exists, skipping...');
      }

      // Add extraction_report column if it doesn't exist
      if (!columnNames.includes('extraction_report')) {
        console.log('Adding extraction_report column...');
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          ADD COLUMN extraction_report TEXT NULL 
          COMMENT 'Detailed processing reports for Excel files'
          AFTER worksheets_processed
        `);
        console.log('extraction_report column added successfully');
      } else {
        console.log('extraction_report column already exists, skipping...');
      }

      console.log(`Migration ${this.migrationName} completed successfully`);
      return true;

    } catch (error) {
      console.error(`Migration ${this.migrationName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Rollback the migration - remove Excel support columns
   */
  async down() {
    console.log(`Rolling back migration: ${this.migrationName}`);

    try {
      // Check current table structure
      const currentColumns = await databaseManager.query('DESCRIBE uploaded_files');
      const columnNames = currentColumns.map(col => col.Field);

      // Remove extraction_report column if it exists
      if (columnNames.includes('extraction_report')) {
        console.log('Removing extraction_report column...');
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          DROP COLUMN extraction_report
        `);
        console.log('extraction_report column removed');
      }

      // Remove worksheets_processed column if it exists
      if (columnNames.includes('worksheets_processed')) {
        console.log('Removing worksheets_processed column...');
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          DROP COLUMN worksheets_processed
        `);
        console.log('worksheets_processed column removed');
      }

      // Remove file_type column and its index if they exist
      if (columnNames.includes('file_type')) {
        console.log('Removing file_type column and index...');
        
        // Drop index first
        try {
          await databaseManager.query(`
            ALTER TABLE uploaded_files 
            DROP INDEX idx_file_type
          `);
        } catch (error) {
          // Index might not exist, continue
          console.log('Index idx_file_type not found, continuing...');
        }
        
        // Drop column
        await databaseManager.query(`
          ALTER TABLE uploaded_files 
          DROP COLUMN file_type
        `);
        console.log('file_type column removed');
      }

      console.log(`Migration ${this.migrationName} rolled back successfully`);
      return true;

    } catch (error) {
      console.error(`Migration rollback ${this.migrationName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if migration has been applied
   */
  async isApplied() {
    try {
      const currentColumns = await databaseManager.query('DESCRIBE uploaded_files');
      const columnNames = currentColumns.map(col => col.Field);
      
      return columnNames.includes('file_type') && 
             columnNames.includes('worksheets_processed') && 
             columnNames.includes('extraction_report');
    } catch (error) {
      console.error('Error checking migration status:', error.message);
      return false;
    }
  }
}

module.exports = ExcelSupportMigration;