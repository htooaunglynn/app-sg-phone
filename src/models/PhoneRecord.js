const databaseManager = require('../utils/database');

class PhoneRecord {
  constructor(identifier, phoneNumber) {
    this.identifier = identifier;
    this.phoneNumber = phoneNumber;
  }

  /**
   * Create the phone_records table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS phone_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(50) NOT NULL UNIQUE,
        phone_number VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await databaseManager.query(createTableSQL);
      console.log('Phone records table created or verified successfully');
      return true;
    } catch (error) {
      console.error('Failed to create phone_records table:', error.message);
      throw error;
    }
  }

  /**
   * Initialize database schema - creates all required tables
   */
  static async initializeSchema() {
    try {
      console.log('Initializing database schema...');
      
      // Ensure database connection is established
      await databaseManager.connect();
      
      // Create phone_records table
      await PhoneRecord.createTable();
      
      console.log('Database schema initialization completed successfully');
      return true;
    } catch (error) {
      console.error('Database schema initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if the database tables exist and are properly configured
   */
  static async verifySchema() {
    try {
      const checkTableSQL = `
        SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'phone_records'
      `;
      
      const dbName = process.env.DB_NAME || 'singapore_phone_db';
      const result = await databaseManager.query(checkTableSQL, [dbName]);
      
      if (result.length === 0) {
        console.log('Phone records table does not exist');
        return false;
      }
      
      console.log('Phone records table verified:', result[0]);
      return true;
    } catch (error) {
      console.error('Schema verification failed:', error.message);
      return false;
    }
  }

  /**
   * Get table statistics
   */
  static async getTableStats() {
    try {
      const statsSQL = `
        SELECT 
          COUNT(*) as total_records,
          MIN(created_at) as first_record,
          MAX(created_at) as last_record
        FROM phone_records
      `;
      
      const result = await databaseManager.query(statsSQL);
      return result[0];
    } catch (error) {
      console.error('Failed to get table statistics:', error.message);
      throw error;
    }
  }

  /**
   * Insert a single phone record with duplicate prevention
   */
  async insert() {
    try {
      const insertSQL = `
        INSERT INTO phone_records (identifier, phone_number) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE 
          phone_number = VALUES(phone_number),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      const result = await databaseManager.query(insertSQL, [this.identifier, this.phoneNumber]);
      
      if (result.affectedRows === 1) {
        console.log(`Inserted new record: ${this.identifier}`);
        return { success: true, action: 'inserted', id: result.insertId };
      } else if (result.affectedRows === 2) {
        console.log(`Updated existing record: ${this.identifier}`);
        return { success: true, action: 'updated', id: result.insertId };
      }
      
      return { success: false, action: 'none' };
    } catch (error) {
      console.error('Failed to insert phone record:', error.message);
      throw error;
    }
  }

  /**
   * Insert multiple phone records in batch with duplicate prevention
   */
  static async batchInsert(phoneRecords) {
    if (!Array.isArray(phoneRecords) || phoneRecords.length === 0) {
      throw new Error('Phone records must be a non-empty array');
    }

    try {
      const insertSQL = `
        INSERT INTO phone_records (identifier, phone_number) 
        VALUES ?
        ON DUPLICATE KEY UPDATE 
          phone_number = VALUES(phone_number),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      // Prepare values array for batch insert
      const values = phoneRecords.map(record => [record.identifier, record.phoneNumber]);
      
      const result = await databaseManager.query(insertSQL, [values]);
      
      const insertedCount = Math.floor(result.affectedRows / 2) || result.affectedRows;
      const updatedCount = result.affectedRows - insertedCount;
      
      console.log(`Batch insert completed: ${insertedCount} inserted, ${updatedCount} updated`);
      
      return {
        success: true,
        totalProcessed: phoneRecords.length,
        inserted: insertedCount,
        updated: updatedCount,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to batch insert phone records:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing phone record by identifier
   */
  async update() {
    try {
      const updateSQL = `
        UPDATE phone_records 
        SET phone_number = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE identifier = ?
      `;
      
      const result = await databaseManager.query(updateSQL, [this.phoneNumber, this.identifier]);
      
      if (result.affectedRows === 0) {
        return { success: false, message: 'Record not found' };
      }
      
      console.log(`Updated record: ${this.identifier}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      console.error('Failed to update phone record:', error.message);
      throw error;
    }
  }

  /**
   * Find a phone record by identifier
   */
  static async findByIdentifier(identifier) {
    try {
      const selectSQL = `
        SELECT id, identifier, phone_number, created_at, updated_at 
        FROM phone_records 
        WHERE identifier = ?
      `;
      
      const result = await databaseManager.query(selectSQL, [identifier]);
      
      if (result.length === 0) {
        return null;
      }
      
      return result[0];
    } catch (error) {
      console.error('Failed to find phone record:', error.message);
      throw error;
    }
  }

  /**
   * Find phone records by ID range
   */
  static async findByIdRange(startId, endId) {
    try {
      if (startId > endId) {
        throw new Error('Start ID must be less than or equal to end ID');
      }

      const selectSQL = `
        SELECT id, identifier, phone_number, created_at, updated_at 
        FROM phone_records 
        WHERE id BETWEEN ? AND ?
        ORDER BY id ASC
      `;
      
      const result = await databaseManager.query(selectSQL, [startId, endId]);
      return result;
    } catch (error) {
      console.error('Failed to find phone records by ID range:', error.message);
      throw error;
    }
  }

  /**
   * Get all phone records with optional pagination
   */
  static async findAll(limit = null, offset = 0) {
    try {
      let selectSQL = `
        SELECT id, identifier, phone_number, created_at, updated_at 
        FROM phone_records 
        ORDER BY id ASC
      `;
      
      const params = [];
      
      if (limit !== null) {
        selectSQL += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }
      
      const result = await databaseManager.query(selectSQL, params);
      return result;
    } catch (error) {
      console.error('Failed to find all phone records:', error.message);
      throw error;
    }
  }

  /**
   * Delete a phone record by identifier
   */
  static async deleteByIdentifier(identifier) {
    try {
      const deleteSQL = `DELETE FROM phone_records WHERE identifier = ?`;
      const result = await databaseManager.query(deleteSQL, [identifier]);
      
      if (result.affectedRows === 0) {
        return { success: false, message: 'Record not found' };
      }
      
      console.log(`Deleted record: ${identifier}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      console.error('Failed to delete phone record:', error.message);
      throw error;
    }
  }

  /**
   * Check if a record exists by identifier
   */
  static async exists(identifier) {
    try {
      const selectSQL = `SELECT 1 FROM phone_records WHERE identifier = ? LIMIT 1`;
      const result = await databaseManager.query(selectSQL, [identifier]);
      return result.length > 0;
    } catch (error) {
      console.error('Failed to check if record exists:', error.message);
      throw error;
    }
  }

  /**
   * Get total count of records in the database
   */
  static async getTotalRecordCount() {
    try {
      const countSQL = `SELECT COUNT(*) as total FROM phone_records`;
      const result = await databaseManager.query(countSQL);
      return result[0].total;
    } catch (error) {
      console.error('Failed to get total record count:', error.message);
      throw error;
    }
  }

  /**
   * Get records by range for Excel export with validation and pagination
   */
  static async getRecordsByRange(startRecord, endRecord, pageSize = 1000) {
    try {
      // Validate input parameters
      if (!Number.isInteger(startRecord) || !Number.isInteger(endRecord)) {
        throw new Error('Start and end record numbers must be integers');
      }

      if (startRecord < 1 || endRecord < 1) {
        throw new Error('Record numbers must be greater than 0');
      }

      if (startRecord > endRecord) {
        throw new Error('Start record must be less than or equal to end record');
      }

      // Get total record count for validation
      const totalRecords = await this.getTotalRecordCount();
      
      if (totalRecords === 0) {
        return {
          success: true,
          records: [],
          totalRequested: 0,
          totalAvailable: 0,
          message: 'No records found in database'
        };
      }

      if (startRecord > totalRecords) {
        throw new Error(`Start record ${startRecord} exceeds total records ${totalRecords}`);
      }

      // Adjust end record if it exceeds available records
      const actualEndRecord = Math.min(endRecord, totalRecords);
      const recordsToFetch = actualEndRecord - startRecord + 1;

      // Calculate offset (convert from 1-based to 0-based indexing)
      const offset = startRecord - 1;

      const selectSQL = `
        SELECT id, identifier, phone_number, created_at, updated_at 
        FROM phone_records 
        ORDER BY id ASC
        LIMIT ? OFFSET ?
      `;

      const result = await databaseManager.query(selectSQL, [recordsToFetch, offset]);

      console.log(`Retrieved ${result.length} records (${startRecord}-${actualEndRecord}) out of ${totalRecords} total`);

      return {
        success: true,
        records: result,
        startRecord: startRecord,
        endRecord: actualEndRecord,
        requestedEndRecord: endRecord,
        totalRequested: recordsToFetch,
        totalReturned: result.length,
        totalAvailable: totalRecords,
        hasMore: actualEndRecord < totalRecords
      };

    } catch (error) {
      console.error('Failed to get records by range:', error.message);
      
      // Return structured error response
      return {
        success: false,
        error: error.message,
        records: [],
        startRecord: startRecord,
        endRecord: endRecord,
        totalRequested: 0,
        totalReturned: 0,
        totalAvailable: await this.getTotalRecordCount().catch(() => 0)
      };
    }
  }

  /**
   * Get records by range with streaming support for large datasets
   */
  static async getRecordsByRangeStream(startRecord, endRecord, batchSize = 1000) {
    try {
      // Validate range first
      const rangeValidation = await this.getRecordsByRange(startRecord, Math.min(startRecord, endRecord), 1);
      if (!rangeValidation.success) {
        throw new Error(rangeValidation.error);
      }

      const totalRecords = rangeValidation.totalAvailable;
      const actualEndRecord = Math.min(endRecord, totalRecords);
      const totalToProcess = actualEndRecord - startRecord + 1;

      const results = [];
      let currentStart = startRecord;

      while (currentStart <= actualEndRecord) {
        const currentEnd = Math.min(currentStart + batchSize - 1, actualEndRecord);
        const batch = await this.getRecordsByRange(currentStart, currentEnd);
        
        if (!batch.success) {
          throw new Error(batch.error);
        }

        results.push(...batch.records);
        currentStart = currentEnd + 1;

        // Log progress for large datasets
        if (totalToProcess > batchSize) {
          const progress = Math.round((results.length / totalToProcess) * 100);
          console.log(`Export progress: ${progress}% (${results.length}/${totalToProcess} records)`);
        }
      }

      return {
        success: true,
        records: results,
        startRecord: startRecord,
        endRecord: actualEndRecord,
        totalReturned: results.length,
        totalAvailable: totalRecords,
        batchesProcessed: Math.ceil(totalToProcess / batchSize)
      };

    } catch (error) {
      console.error('Failed to get records by range with streaming:', error.message);
      throw error;
    }
  }

  /**
   * Validate export range parameters
   */
  static async validateExportRange(startRecord, endRecord) {
    try {
      // Basic parameter validation
      if (startRecord === undefined || endRecord === undefined) {
        return {
          valid: false,
          error: 'Start and end record parameters are required'
        };
      }

      const start = parseInt(startRecord);
      const end = parseInt(endRecord);

      if (isNaN(start) || isNaN(end)) {
        return {
          valid: false,
          error: 'Start and end record must be valid numbers'
        };
      }

      if (start < 1 || end < 1) {
        return {
          valid: false,
          error: 'Record numbers must be greater than 0'
        };
      }

      if (start > end) {
        return {
          valid: false,
          error: 'Start record must be less than or equal to end record'
        };
      }

      // Check against database
      const totalRecords = await this.getTotalRecordCount();
      
      if (totalRecords === 0) {
        return {
          valid: false,
          error: 'No records available for export'
        };
      }

      if (start > totalRecords) {
        return {
          valid: false,
          error: `Start record ${start} exceeds available records (${totalRecords})`
        };
      }

      const actualEnd = Math.min(end, totalRecords);
      const recordCount = actualEnd - start + 1;

      return {
        valid: true,
        startRecord: start,
        endRecord: actualEnd,
        requestedEndRecord: end,
        recordCount: recordCount,
        totalAvailable: totalRecords,
        warning: end > totalRecords ? `End record adjusted from ${end} to ${actualEnd}` : null
      };

    } catch (error) {
      console.error('Failed to validate export range:', error.message);
      return {
        valid: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }
}

module.exports = PhoneRecord;