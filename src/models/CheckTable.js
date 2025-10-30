const databaseManager = require('../utils/database');

class CheckTable {
  constructor(id, phone, status, companyName = null, physicalAddress = null, email = null, website = null) {
    this.id = id;
    this.phone = phone;
    this.status = status;
    this.companyName = companyName;
    this.physicalAddress = physicalAddress;
    this.email = email;
    this.website = website;
  }

  /**
   * Create the check_table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS check_table (
        Id VARCHAR(100) NOT NULL PRIMARY KEY,
        Phone VARCHAR(50) NOT NULL,
        Status BOOLEAN NULL,
        CompanyName VARCHAR(255) NULL,
        PhysicalAddress TEXT NULL,
        Email VARCHAR(255) NULL UNIQUE,
        Website VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (Status),
        INDEX idx_email (Email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await databaseManager.query(createTableSQL);
      console.log('Check table created or verified successfully');
      return true;
    } catch (error) {
      console.error('Failed to create check_table:', error.message);
      throw error;
    }
  }

  /**
   * Insert a new record into check_table
   */
  async insert() {
    try {
      const insertSQL = `
        INSERT INTO check_table (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await databaseManager.query(insertSQL, [
        this.id, 
        this.phone, 
        this.status, 
        this.companyName, 
        this.physicalAddress, 
        this.email, 
        this.website
      ]);
      
      console.log(`Inserted check_table record: ${this.id}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('Email') || error.message.includes('unique_email')) {
          throw new Error(`Email address already exists: ${this.email}`);
        } else {
          throw new Error(`Record with Id ${this.id} already exists`);
        }
      }
      console.error('Failed to insert check_table record:', error.message);
      throw error;
    }
  }

  /**
   * Update company information only (prevents updates to Id, Phone, Status)
   */
  async updateCompanyInfo() {
    try {
      const updateSQL = `
        UPDATE check_table 
        SET CompanyName = ?, PhysicalAddress = ?, Email = ?, Website = ?, updated_at = CURRENT_TIMESTAMP
        WHERE Id = ?
      `;
      
      const result = await databaseManager.query(updateSQL, [
        this.companyName, 
        this.physicalAddress, 
        this.email, 
        this.website, 
        this.id
      ]);
      
      if (result.affectedRows === 0) {
        return { success: false, message: 'Record not found' };
      }
      
      console.log(`Updated company info for record: ${this.id}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' && (error.message.includes('Email') || error.message.includes('unique_email'))) {
        throw new Error(`Email address already exists: ${this.email}`);
      }
      console.error('Failed to update check_table record:', error.message);
      throw error;
    }
  }

  /**
   * Find a record by Id
   */
  static async findById(id) {
    try {
      const selectSQL = `
        SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at 
        FROM check_table 
        WHERE Id = ?
      `;
      
      const result = await databaseManager.query(selectSQL, [id]);
      
      if (result.length === 0) {
        return null;
      }
      
      return result[0];
    } catch (error) {
      console.error('Failed to find check_table record:', error.message);
      throw error;
    }
  }

  /**
   * Find records by range for Excel export
   */
  static async findByRange(startRecord, endRecord) {
    try {
      if (startRecord > endRecord) {
        throw new Error('Start record must be less than or equal to end record');
      }

      const limit = parseInt(endRecord - startRecord + 1);
      const offset = parseInt(startRecord - 1);

      const selectSQL = `
        SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at 
        FROM check_table 
        ORDER BY Id ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await databaseManager.query(selectSQL);
      return result;
    } catch (error) {
      console.error('Failed to find check_table records by range:', error.message);
      throw error;
    }
  }

  /**
   * Get all records with optional pagination
   */
  static async findAll(limit = null, offset = 0) {
    try {
      let selectSQL = `
        SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at 
        FROM check_table 
        ORDER BY created_at DESC
      `;
      
      if (limit !== null) {
        selectSQL += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      }
      
      const result = await databaseManager.query(selectSQL);
      return result;
    } catch (error) {
      console.error('Failed to find all check_table records:', error.message);
      throw error;
    }
  }

  /**
   * Get total count of records
   */
  static async getTotalRecordCount() {
    try {
      const countSQL = `SELECT COUNT(*) as total FROM check_table`;
      const result = await databaseManager.query(countSQL);
      return parseInt(result[0].total, 10);
    } catch (error) {
      console.error('Failed to get total record count:', error.message);
      throw error;
    }
  }

  /**
   * Check if a record exists by Id
   */
  static async exists(id) {
    try {
      const selectSQL = `SELECT 1 FROM check_table WHERE Id = ? LIMIT 1`;
      const result = await databaseManager.query(selectSQL, [id]);
      return result.length > 0;
    } catch (error) {
      console.error('Failed to check if record exists:', error.message);
      throw error;
    }
  }

  /**
   * Check if email exists (for uniqueness validation)
   */
  static async emailExists(email, excludeId = null) {
    try {
      let selectSQL = `SELECT Id FROM check_table WHERE Email = ?`;
      const params = [email];
      
      if (excludeId) {
        selectSQL += ' AND Id != ?';
        params.push(excludeId);
      }
      
      const result = await databaseManager.query(selectSQL, params);
      return result.length > 0;
    } catch (error) {
      console.error('Failed to check if email exists:', error.message);
      throw error;
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
          COUNT(CASE WHEN Status = true THEN 1 END) as singapore_phones,
          COUNT(CASE WHEN Status = false THEN 1 END) as non_singapore_phones,
          COUNT(CASE WHEN CompanyName IS NOT NULL THEN 1 END) as records_with_company,
          COUNT(CASE WHEN Email IS NOT NULL THEN 1 END) as records_with_email,
          MIN(created_at) as first_record,
          MAX(created_at) as last_record
        FROM check_table
      `;
      
      const result = await databaseManager.query(statsSQL);
      return result[0];
    } catch (error) {
      console.error('Failed to get table statistics:', error.message);
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
        SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at 
        FROM check_table 
        ORDER BY Id ASC
        LIMIT ${parseInt(recordsToFetch)} OFFSET ${parseInt(offset)}
      `;

      const result = await databaseManager.query(selectSQL);

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
   * Batch insert records from backup_table validation
   */
  static async batchInsert(checkRecords) {
    if (!Array.isArray(checkRecords) || checkRecords.length === 0) {
      throw new Error('Check records must be a non-empty array');
    }

    try {
      // Insert records one by one to handle duplicates properly
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const record of checkRecords) {
        try {
          const insertSQL = `
            INSERT INTO check_table (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              Status = VALUES(Status),
              updated_at = CURRENT_TIMESTAMP
          `;
          
          const result = await databaseManager.query(insertSQL, [
            record.id, 
            record.phone, 
            record.status, 
            record.companyName || null, 
            record.physicalAddress || null, 
            record.email || null, 
            record.website || null
          ]);
          
          if (result.affectedRows === 1) {
            insertedCount++;
          } else if (result.affectedRows === 2) {
            updatedCount++;
          }
        } catch (error) {
          console.warn(`Failed to insert record ${record.id}:`, error.message);
          // Continue with other records
        }
      }
      
      console.log(`Batch insert completed: ${insertedCount} inserted, ${updatedCount} updated`);
      
      return {
        success: true,
        totalProcessed: checkRecords.length,
        inserted: insertedCount,
        updated: updatedCount,
        affectedRows: insertedCount + updatedCount
      };
    } catch (error) {
      console.error('Failed to batch insert check_table records:', error.message);
      throw error;
    }
  }

  /**
   * Validate company information data
   */
  static validateCompanyInfo(companyData) {
    const errors = [];
    
    // Email validation
    if (companyData.email && companyData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(companyData.email.trim())) {
        errors.push('Invalid email format');
      }
    }
    
    // Website validation
    if (companyData.website && companyData.website.trim()) {
      try {
        new URL(companyData.website.trim());
      } catch {
        errors.push('Invalid website URL format');
      }
    }
    
    // Field length validation
    if (companyData.companyName && companyData.companyName.length > 255) {
      errors.push('Company name must be 255 characters or less');
    }
    
    if (companyData.email && companyData.email.length > 255) {
      errors.push('Email must be 255 characters or less');
    }
    
    if (companyData.website && companyData.website.length > 255) {
      errors.push('Website must be 255 characters or less');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = CheckTable;