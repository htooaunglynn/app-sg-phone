const databaseManager = require('../database');

/**
 * Migration: Add numeric_id column to check_table
 * Adds numeric_id column with proper indexing and populates existing records
 */
class NumericIdMigration {
  constructor() {
    this.migrationName = '002_add_numeric_id_column';
    this.description = 'Add numeric_id column to check_table for efficient numeric operations';
  }

  /**
   * Extract numeric ID from ID string
   * @param {string} idString - The ID string (e.g., "SG COM-2001")
   * @returns {number|null} - The extracted numeric ID or null if not found
   */
  static extractNumericId(idString) {
    if (!idString || typeof idString !== 'string') {
      return null;
    }
    
    // Extract trailing numeric sequence
    const match = idString.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Apply the migration - add numeric_id column and populate data
   */
  async up() {
    console.log(`Running migration: ${this.migrationName}`);
    console.log(`Description: ${this.description}`);

    try {
      // Check current table structure
      const currentColumns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = currentColumns.map(col => col.Field);

      // Add numeric_id column if it doesn't exist
      if (!columnNames.includes('numeric_id')) {
        console.log('Adding numeric_id column...');
        await databaseManager.query(`
          ALTER TABLE check_table 
          ADD COLUMN numeric_id INT NULL 
          COMMENT 'Extracted numeric portion from Id column'
          AFTER Id
        `);
        console.log('numeric_id column added successfully');

        // Add index for numeric_id
        console.log('Creating index for numeric_id column...');
        await databaseManager.query(`
          ALTER TABLE check_table 
          ADD INDEX idx_numeric_id (numeric_id)
        `);
        console.log('Index idx_numeric_id created successfully');

        // Populate existing records with numeric_id values
        await this.populateNumericIds();

      } else {
        console.log('numeric_id column already exists, skipping column creation...');
        
        // Check if index exists
        const indexes = await databaseManager.query(`
          SHOW INDEX FROM check_table WHERE Key_name = 'idx_numeric_id'
        `);
        
        if (indexes.length === 0) {
          console.log('Creating missing index for numeric_id column...');
          await databaseManager.query(`
            ALTER TABLE check_table 
            ADD INDEX idx_numeric_id (numeric_id)
          `);
          console.log('Index idx_numeric_id created successfully');
        }

        // Check if data population is needed
        const unpopulatedCount = await databaseManager.query(`
          SELECT COUNT(*) as count FROM check_table 
          WHERE numeric_id IS NULL AND Id IS NOT NULL
        `);
        
        if (unpopulatedCount[0].count > 0) {
          console.log(`Found ${unpopulatedCount[0].count} records without numeric_id, populating...`);
          await this.populateNumericIds();
        }
      }

      console.log(`Migration ${this.migrationName} completed successfully`);
      return true;

    } catch (error) {
      console.error(`Migration ${this.migrationName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Populate numeric_id values for existing records
   */
  async populateNumericIds() {
    console.log('Starting data population for numeric_id column...');
    
    try {
      // Get all records that need numeric_id population
      const records = await databaseManager.query(`
        SELECT Id FROM check_table 
        WHERE numeric_id IS NULL AND Id IS NOT NULL
        ORDER BY Id
      `);

      console.log(`Processing ${records.length} records for numeric_id extraction...`);

      let successCount = 0;
      let failureCount = 0;
      let nullCount = 0;

      // Process records in batches to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)...`);

        for (const record of batch) {
          try {
            const numericId = NumericIdMigration.extractNumericId(record.Id);
            
            if (numericId !== null) {
              await databaseManager.query(`
                UPDATE check_table 
                SET numeric_id = ? 
                WHERE Id = ?
              `, [numericId, record.Id]);
              successCount++;
            } else {
              console.warn(`No numeric ID found for record: ${record.Id}`);
              nullCount++;
            }
          } catch (error) {
            console.error(`Failed to process record ${record.Id}:`, error.message);
            failureCount++;
          }
        }
      }

      console.log('Data population completed:');
      console.log(`  - Successfully processed: ${successCount} records`);
      console.log(`  - Records with no numeric ID: ${nullCount} records`);
      console.log(`  - Failed to process: ${failureCount} records`);

      // Verify population results
      const verificationResults = await databaseManager.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(numeric_id) as populated_records,
          COUNT(CASE WHEN numeric_id IS NULL THEN 1 END) as null_records
        FROM check_table
      `);

      const stats = verificationResults[0];
      console.log('Population verification:');
      console.log(`  - Total records: ${stats.total_records}`);
      console.log(`  - Populated numeric_id: ${stats.populated_records}`);
      console.log(`  - NULL numeric_id: ${stats.null_records}`);

      return {
        success: true,
        totalProcessed: records.length,
        successCount,
        failureCount,
        nullCount
      };

    } catch (error) {
      console.error('Failed to populate numeric_id values:', error.message);
      throw error;
    }
  }

  /**
   * Rollback the migration - remove numeric_id column
   */
  async down() {
    console.log(`Rolling back migration: ${this.migrationName}`);

    try {
      // Check current table structure
      const currentColumns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = currentColumns.map(col => col.Field);

      // Remove numeric_id column and its index if they exist
      if (columnNames.includes('numeric_id')) {
        console.log('Removing numeric_id column and index...');
        
        // Drop index first
        try {
          await databaseManager.query(`
            ALTER TABLE check_table 
            DROP INDEX idx_numeric_id
          `);
          console.log('Index idx_numeric_id removed');
        } catch (error) {
          // Index might not exist, continue
          console.log('Index idx_numeric_id not found, continuing...');
        }
        
        // Drop column
        await databaseManager.query(`
          ALTER TABLE check_table 
          DROP COLUMN numeric_id
        `);
        console.log('numeric_id column removed');
      } else {
        console.log('numeric_id column does not exist, nothing to rollback');
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
      const currentColumns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = currentColumns.map(col => col.Field);
      
      // Check if column exists
      const columnExists = columnNames.includes('numeric_id');
      
      if (!columnExists) {
        return false;
      }

      // Check if index exists
      const indexes = await databaseManager.query(`
        SHOW INDEX FROM check_table WHERE Key_name = 'idx_numeric_id'
      `);
      
      const indexExists = indexes.length > 0;

      // Check if data has been populated (at least some records should have numeric_id)
      const populatedCount = await databaseManager.query(`
        SELECT COUNT(*) as count FROM check_table WHERE numeric_id IS NOT NULL
      `);
      
      const hasPopulatedData = populatedCount[0].count > 0;

      return columnExists && indexExists && hasPopulatedData;
      
    } catch (error) {
      console.error('Error checking migration status:', error.message);
      return false;
    }
  }

  /**
   * Get migration statistics
   */
  async getStats() {
    try {
      const stats = await databaseManager.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(numeric_id) as populated_records,
          COUNT(CASE WHEN numeric_id IS NULL THEN 1 END) as null_records,
          MIN(numeric_id) as min_numeric_id,
          MAX(numeric_id) as max_numeric_id
        FROM check_table
      `);

      return stats[0];
    } catch (error) {
      console.error('Error getting migration statistics:', error.message);
      return null;
    }
  }
}

module.exports = NumericIdMigration;