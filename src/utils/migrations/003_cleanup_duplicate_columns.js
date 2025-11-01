const databaseManager = require('../database');

/**
 * Migration: Clean up duplicate numeric columns and populate numeric_id
 * Removes the 'no' column and ensures numeric_id is properly populated
 */
class CleanupDuplicateColumnsMigration {
  constructor() {
    this.migrationName = '003_cleanup_duplicate_columns';
    this.description = 'Remove duplicate no column and populate numeric_id column';
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
   * Apply the migration
   */
  async up() {
    console.log(`Running migration: ${this.migrationName}`);
    console.log(`Description: ${this.description}`);

    try {
      // Check current table structure
      const currentColumns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = currentColumns.map(col => col.Field);

      // Step 1: Populate numeric_id column if it's empty
      if (columnNames.includes('numeric_id')) {
        console.log('Checking numeric_id population status...');
        
        const unpopulatedCount = await databaseManager.query(`
          SELECT COUNT(*) as count FROM check_table 
          WHERE numeric_id IS NULL AND Id IS NOT NULL
        `);
        
        if (unpopulatedCount[0].count > 0) {
          console.log(`Found ${unpopulatedCount[0].count} records without numeric_id, populating...`);
          await this.populateNumericIds();
        } else {
          console.log('numeric_id column is already populated');
        }
      }

      // Step 2: Remove the 'no' column if it exists
      if (columnNames.includes('no')) {
        console.log('Removing duplicate "no" column...');
        
        // First check if 'no' column has any data that numeric_id doesn't have
        const dataComparison = await databaseManager.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN no IS NOT NULL AND numeric_id IS NULL THEN 1 END) as no_has_data_numeric_null,
            COUNT(CASE WHEN no IS NOT NULL THEN 1 END) as no_populated,
            COUNT(CASE WHEN numeric_id IS NOT NULL THEN 1 END) as numeric_populated
          FROM check_table
        `);
        
        const stats = dataComparison[0];
        console.log('Column data comparison:');
        console.log(`  - Total records: ${stats.total}`);
        console.log(`  - 'no' column populated: ${stats.no_populated}`);
        console.log(`  - 'numeric_id' column populated: ${stats.numeric_populated}`);
        console.log(`  - 'no' has data but 'numeric_id' is null: ${stats.no_has_data_numeric_null}`);

        // If 'no' column has data that numeric_id doesn't have, copy it first
        if (stats.no_has_data_numeric_null > 0) {
          console.log('Copying data from "no" column to "numeric_id" column...');
          await databaseManager.query(`
            UPDATE check_table 
            SET numeric_id = no 
            WHERE numeric_id IS NULL AND no IS NOT NULL
          `);
          console.log(`Copied ${stats.no_has_data_numeric_null} values from 'no' to 'numeric_id'`);
        }

        // Drop the 'no' column
        await databaseManager.query(`
          ALTER TABLE check_table 
          DROP COLUMN no
        `);
        console.log('Successfully removed "no" column');
      } else {
        console.log('"no" column does not exist, skipping removal');
      }

      // Step 3: Ensure numeric_id has proper index
      const indexes = await databaseManager.query(`
        SHOW INDEX FROM check_table WHERE Key_name = 'idx_numeric_id'
      `);
      
      if (indexes.length === 0) {
        console.log('Creating index for numeric_id column...');
        await databaseManager.query(`
          ALTER TABLE check_table 
          ADD INDEX idx_numeric_id (numeric_id)
        `);
        console.log('Index idx_numeric_id created successfully');
      } else {
        console.log('Index idx_numeric_id already exists');
      }

      // Step 4: Verify final state
      await this.verifyMigration();

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
            const numericId = CleanupDuplicateColumnsMigration.extractNumericId(record.Id);
            
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
   * Verify migration results
   */
  async verifyMigration() {
    try {
      // Check final table structure
      const columns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = columns.map(col => col.Field);
      
      console.log('Final table structure verification:');
      console.log(`  - numeric_id column exists: ${columnNames.includes('numeric_id')}`);
      console.log(`  - no column exists: ${columnNames.includes('no')}`);
      
      // Check data population
      const dataStats = await databaseManager.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(numeric_id) as populated_records,
          COUNT(CASE WHEN numeric_id IS NULL THEN 1 END) as null_records,
          MIN(numeric_id) as min_numeric_id,
          MAX(numeric_id) as max_numeric_id
        FROM check_table
      `);

      const stats = dataStats[0];
      console.log('Data population verification:');
      console.log(`  - Total records: ${stats.total_records}`);
      console.log(`  - Populated numeric_id: ${stats.populated_records}`);
      console.log(`  - NULL numeric_id: ${stats.null_records}`);
      console.log(`  - Numeric ID range: ${stats.min_numeric_id} - ${stats.max_numeric_id}`);

      // Check index
      const indexes = await databaseManager.query(`
        SHOW INDEX FROM check_table WHERE Key_name = 'idx_numeric_id'
      `);
      console.log(`  - Index idx_numeric_id exists: ${indexes.length > 0}`);

      return {
        columnStructure: {
          numeric_id_exists: columnNames.includes('numeric_id'),
          no_column_removed: !columnNames.includes('no')
        },
        dataPopulation: stats,
        indexExists: indexes.length > 0
      };

    } catch (error) {
      console.error('Migration verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Rollback the migration
   */
  async down() {
    console.log(`Rolling back migration: ${this.migrationName}`);

    try {
      // This rollback is intentionally limited since we're removing redundant data
      // We won't recreate the 'no' column as it was redundant
      
      console.log('Note: This migration removes redundant data.');
      console.log('Rollback will only clear numeric_id values, not recreate the "no" column.');
      
      // Clear numeric_id values if needed
      await databaseManager.query(`
        UPDATE check_table SET numeric_id = NULL
      `);
      
      console.log('numeric_id values cleared');
      console.log(`Migration ${this.migrationName} rolled back (partial)`);
      
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
      const columns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = columns.map(col => col.Field);
      
      // Migration is applied if:
      // 1. numeric_id column exists
      // 2. no column does NOT exist
      // 3. numeric_id has data
      
      const numericIdExists = columnNames.includes('numeric_id');
      const noColumnExists = columnNames.includes('no');
      
      if (!numericIdExists || noColumnExists) {
        return false;
      }

      // Check if data has been populated
      const populatedCount = await databaseManager.query(`
        SELECT COUNT(*) as count FROM check_table WHERE numeric_id IS NOT NULL
      `);
      
      const hasPopulatedData = populatedCount[0].count > 0;

      return numericIdExists && !noColumnExists && hasPopulatedData;
      
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

      const columns = await databaseManager.query('DESCRIBE check_table');
      const columnNames = columns.map(col => col.Field);

      return {
        ...stats[0],
        numeric_id_column_exists: columnNames.includes('numeric_id'),
        no_column_exists: columnNames.includes('no')
      };
    } catch (error) {
      console.error('Error getting migration statistics:', error.message);
      return null;
    }
  }
}

module.exports = CleanupDuplicateColumnsMigration;