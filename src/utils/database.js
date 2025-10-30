const mysql = require('mysql2/promise');
const config = require('./config');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Create MySQL connection pool with enhanced configuration for performance
   */
  createPool() {
    const dbConfig = {
      ...config.database,
      waitForConnections: true,
      queueLimit: 0,
      // Connection pool optimization
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
      timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 300000, // 5 minutes
      // Query optimization
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: false,
      multipleStatements: false,
      namedPlaceholders: false,
      // Security settings
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : false,
      // Performance tuning
      typeCast: function (field, next) {
        try {
          // Handle TINYINT(1) as boolean
          if (field.type === 'TINY' && field.length === 1) {
            const value = field.string();
            return value === '1' || value === 1;
          }
          
          // Handle BIGINT as number - use default handling for LONGLONG to avoid binary parsing issues
          if (field.type === 'LONGLONG') {
            return next();
          }
          
          // Handle DATE and DATETIME fields
          if (field.type === 'DATE' || field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
            return field.string();
          }
          
          // Handle JSON fields
          if (field.type === 'JSON') {
            const value = field.string();
            try {
              return value ? JSON.parse(value) : null;
            } catch (e) {
              return value;
            }
          }
          
          // Handle TEXT and BLOB fields
          if (field.type === 'BLOB' || field.type === 'TEXT' || field.type === 'LONG_BLOB' || field.type === 'MEDIUM_BLOB') {
            return field.string();
          }
          
          // For all other types, use default handling
          return next();
        } catch (error) {
          console.warn('TypeCast error for field:', field.name, 'type:', field.type, 'error:', error.message);
          // Fallback to default handling
          return next();
        }
      }
    };

    this.pool = mysql.createPool(dbConfig);
    
    // Monitor pool events for performance
    this.pool.on('connection', (connection) => {
      console.log('New database connection established as id ' + connection.threadId);
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        this.isConnected = false;
      }
    });

    return this.pool;
  }

  /**
   * Establish database connection with retry logic
   */
  async connect() {
    if (this.isConnected && this.pool) {
      return this.pool;
    }

    try {
      if (!this.pool) {
        this.createPool();
      }

      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.isConnected = true;
      this.retryAttempts = 0;
      console.log('Database connected successfully');
      return this.pool;

    } catch (error) {
      console.error('Database connection failed:', error.message);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1); // Exponential backoff
        
        console.log(`Retrying database connection in ${delay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      } else {
        this.isConnected = false;
        throw new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`);
      }
    }
  }

  /**
   * Get database connection from pool
   */
  async getConnection() {
    if (!this.isConnected || !this.pool) {
      await this.connect();
    }
    
    try {
      return await this.pool.getConnection();
    } catch (error) {
      console.error('Failed to get database connection:', error.message);
      // Try to reconnect
      this.isConnected = false;
      await this.connect();
      return await this.pool.getConnection();
    }
  }

  /**
   * Execute a query with enhanced error handling and performance monitoring
   */
  async query(sql, params = []) {
    const startTime = Date.now();
    const connection = await this.getConnection();
    
    try {
      const [results] = await connection.execute(sql, params);
      
      // Log slow queries for performance monitoring
      const queryTime = Date.now() - startTime;
      if (queryTime > 1000) { // Log queries taking more than 1 second
        console.warn(`Slow query detected (${queryTime}ms):`, sql.substring(0, 100));
      }
      
      return results;
    } catch (error) {
      console.error('Database query failed:', error.message);
      console.error('Query:', sql);
      console.error('Params:', params);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute multiple queries in a transaction with enhanced error handling
   */
  async transaction(queries) {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { sql, params } of queries) {
        const [result] = await connection.execute(sql, params || []);
        results.push(result);
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      console.error('Transaction failed:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute a prepared statement with caching for better performance
   */
  async preparedQuery(sql, params = [], useCache = false) {
    const connection = await this.getConnection();
    
    try {
      if (useCache) {
        // Use prepared statement caching for frequently used queries
        const [results] = await connection.execute({
          sql: sql,
          values: params,
          timeout: 60000
        });
        return results;
      } else {
        const [results] = await connection.execute(sql, params);
        return results;
      }
    } catch (error) {
      console.error('Prepared query failed:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Close all database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('Database connections closed');
    }
  }

  /**
   * Initialize database tables for dual-table architecture
   */
  async initializeTables() {
    const databaseInitializer = require('./initDatabase');
    return await databaseInitializer.initialize();
  }

  /**
   * Insert record into immutable backup_table
   */
  async insertBackupRecord(id, phone) {
    const sql = 'INSERT INTO backup_table (Id, Phone) VALUES (?, ?)';
    try {
      const result = await this.query(sql, [id, phone]);
      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`Duplicate entry for backup_table: ${id}`);
        return null; // Handle gracefully
      }
      throw error;
    }
  }

  /**
   * Insert record into backup_table with enhanced metadata
   */
  async insertBackupRecordWithMetadata(id, phone, sourceFile = null, extractedMetadata = null) {
    const sql = 'INSERT INTO backup_table (Id, Phone, source_file, extracted_metadata) VALUES (?, ?, ?, ?)';
    try {
      const result = await this.query(sql, [id, phone, sourceFile, extractedMetadata]);
      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`Duplicate entry for backup_table: ${id}`);
        return null; // Handle gracefully
      }
      throw error;
    }
  }

  /**
   * Insert batch of records with transaction-safe duplicate handling
   * @param {Array} records - Array of records to insert
   * @param {string} sourceFile - Source file name
   * @returns {Promise<Object>} Batch insertion result with duplicate handling
   */
  async insertBatchWithDuplicateHandling(records, sourceFile = null) {
    const result = {
      success: false,
      totalRecords: records.length,
      storedRecords: 0,
      duplicatesSkipped: 0,
      errors: [],
      storedRecordIds: [],
      duplicateIds: []
    };

    if (!Array.isArray(records) || records.length === 0) {
      result.success = true;
      return result;
    }

    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      
      for (const record of records) {
        try {
          const sql = 'INSERT INTO backup_table (Id, Phone, source_file, extracted_metadata) VALUES (?, ?, ?, ?)';
          const params = [
            record.id || record.Id,
            record.phoneNumber || record.Phone,
            sourceFile,
            record.extractedMetadata ? JSON.stringify(record.extractedMetadata) : null
          ];
          
          const [insertResult] = await connection.execute(sql, params);
          
          if (insertResult.affectedRows > 0) {
            result.storedRecords++;
            result.storedRecordIds.push(record.id || record.Id);
          }
          
        } catch (recordError) {
          if (recordError.code === 'ER_DUP_ENTRY') {
            // Handle duplicate as expected behavior, not error
            result.duplicatesSkipped++;
            result.duplicateIds.push(record.id || record.Id);
            console.warn(`Duplicate entry skipped during batch insert: ${record.id || record.Id}`);
          } else {
            // For other errors, log but continue with transaction
            result.errors.push(`Record ${record.id || record.Id}: ${recordError.message}`);
            console.error(`Error inserting record ${record.id || record.Id}:`, recordError.message);
          }
        }
      }
      
      // Commit transaction even if some records were duplicates
      await connection.commit();
      result.success = true;
      
      console.log(`Batch transaction completed: ${result.storedRecords} stored, ${result.duplicatesSkipped} duplicates skipped`);
      
    } catch (transactionError) {
      await connection.rollback();
      result.errors.push(`Transaction failed: ${transactionError.message}`);
      console.error('Batch transaction failed:', transactionError.message);
    } finally {
      connection.release();
    }

    return result;
  }

  /**
   * Insert records with rollback protection for successful insertions
   * @param {Array} records - Array of records to insert
   * @param {string} sourceFile - Source file name
   * @param {number} batchSize - Size of each sub-batch for rollback protection
   * @returns {Promise<Object>} Protected insertion result
   */
  async insertWithRollbackProtection(records, sourceFile = null, batchSize = 100) {
    const result = {
      success: false,
      totalRecords: records.length,
      storedRecords: 0,
      duplicatesSkipped: 0,
      errors: [],
      storedRecordIds: [],
      duplicateIds: [],
      batchResults: []
    };

    if (!Array.isArray(records) || records.length === 0) {
      result.success = true;
      return result;
    }

    // Process in smaller batches to protect successful insertions
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const batchResult = await this.insertBatchWithDuplicateHandling(batch, sourceFile);
        
        result.batchResults.push({
          batchNumber: i + 1,
          ...batchResult
        });
        
        result.storedRecords += batchResult.storedRecords;
        result.duplicatesSkipped += batchResult.duplicatesSkipped;
        result.storedRecordIds.push(...batchResult.storedRecordIds);
        result.duplicateIds.push(...batchResult.duplicateIds);
        result.errors.push(...batchResult.errors);
        
      } catch (batchError) {
        result.errors.push(`Batch ${i + 1} failed: ${batchError.message}`);
        console.error(`Batch ${i + 1} failed:`, batchError.message);
        
        // Continue with next batch to protect successful insertions
        continue;
      }
    }

    result.success = result.storedRecords > 0 || result.duplicatesSkipped > 0;
    
    console.log(`Protected insertion completed: ${result.storedRecords} stored across ${batches.length} batches`);
    
    return result;
  }

  /**
   * Enhanced database error classification with comprehensive duplicate handling
   * @param {Error} error - Database error to analyze
   * @param {Object} record - Record that caused the error
   * @param {string} operation - The database operation being performed
   * @returns {Object} Enhanced error classification result
   */
  classifyDatabaseError(error, record = null, operation = 'unknown') {
    const classification = {
      isDuplicate: false,
      isConstraintViolation: false,
      isSystemError: false,
      isRetryable: false,
      errorType: 'unknown',
      errorCode: error.code || 'NO_CODE',
      message: error.message,
      originalError: error,
      shouldRetry: false,
      retryDelay: 0,
      recordId: record ? (record.id || record.Id) : null,
      operation: operation,
      severity: 'medium',
      handlingStrategy: 'log_and_continue'
    };

    // Duplicate entry errors
    if (error.code === 'ER_DUP_ENTRY') {
      classification.isDuplicate = true;
      classification.isConstraintViolation = true;
      classification.errorType = 'duplicate_entry';
      classification.severity = 'low';
      classification.handlingStrategy = 'skip_record';
      
      // Parse duplicate entry message for specific constraint
      if (error.message.includes('PRIMARY')) {
        classification.constraintType = 'primary_key';
      } else if (error.message.includes('unique_email')) {
        classification.constraintType = 'unique_email';
      } else {
        classification.constraintType = 'unique_constraint';
      }
    }
    
    // Foreign key constraint violations
    else if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
      classification.isConstraintViolation = true;
      classification.errorType = 'foreign_key_constraint';
      classification.severity = 'high';
      classification.handlingStrategy = 'fail_operation';
    }
    
    // Data validation errors
    else if (error.code === 'ER_DATA_TOO_LONG' || error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      classification.isConstraintViolation = true;
      classification.errorType = 'data_validation';
      classification.severity = 'medium';
      classification.handlingStrategy = 'skip_record';
    }
    
    // Data type conversion errors
    else if (error.code === 'ER_WRONG_VALUE_FOR_TYPE' || error.code === 'ER_INVALID_DEFAULT') {
      classification.isConstraintViolation = true;
      classification.errorType = 'data_type_error';
      classification.severity = 'medium';
      classification.handlingStrategy = 'skip_record';
    }
    
    // Connection and timeout errors (retryable)
    else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      classification.isSystemError = true;
      classification.isRetryable = true;
      classification.errorType = 'connection_error';
      classification.shouldRetry = true;
      classification.retryDelay = 1000; // 1 second
      classification.severity = 'high';
      classification.handlingStrategy = 'retry_operation';
    }
    
    // Database lock and timeout errors (retryable)
    else if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || error.code === 'ER_LOCK_DEADLOCK') {
      classification.isSystemError = true;
      classification.isRetryable = true;
      classification.errorType = 'database_lock';
      classification.shouldRetry = true;
      classification.retryDelay = 500; // 0.5 seconds
      classification.severity = 'medium';
      classification.handlingStrategy = 'retry_operation';
    }
    
    // Server errors (potentially retryable)
    else if (error.code === 'ER_SERVER_SHUTDOWN' || error.code === 'ER_NORMAL_SHUTDOWN') {
      classification.isSystemError = true;
      classification.isRetryable = true;
      classification.errorType = 'server_shutdown';
      classification.shouldRetry = true;
      classification.retryDelay = 5000; // 5 seconds
      classification.severity = 'high';
      classification.handlingStrategy = 'retry_operation';
    }
    
    // Memory and resource errors
    else if (error.code === 'ER_OUT_OF_RESOURCES' || error.code === 'ER_OUTOFMEMORY') {
      classification.isSystemError = true;
      classification.errorType = 'resource_exhaustion';
      classification.severity = 'critical';
      classification.handlingStrategy = 'fail_operation';
    }
    
    // Permission and access errors
    else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
      classification.isSystemError = true;
      classification.errorType = 'access_denied';
      classification.severity = 'critical';
      classification.handlingStrategy = 'fail_operation';
    }
    
    // Unknown or other system errors
    else {
      classification.isSystemError = true;
      classification.errorType = 'system_error';
      classification.severity = 'high';
      classification.handlingStrategy = 'log_and_continue';
    }

    return classification;
  }

  /**
   * Handle database constraint violations with proper error classification
   * @param {Error} error - Database constraint violation error
   * @param {Object} record - Record that caused the violation
   * @param {string} operation - Database operation context
   * @returns {Object} Constraint violation handling result
   */
  handleConstraintViolation(error, record = null, operation = 'insert') {
    const classification = this.classifyDatabaseError(error, record, operation);
    
    const result = {
      handled: false,
      action: 'none',
      classification: classification,
      recordId: classification.recordId,
      message: '',
      shouldContinue: false,
      requiresUserAttention: false
    };

    if (classification.isDuplicate) {
      result.handled = true;
      result.action = 'skip_duplicate';
      result.message = `Duplicate entry skipped for ID: ${classification.recordId}`;
      result.shouldContinue = true;
      
      // Log duplicate handling
      console.warn(`Duplicate constraint violation handled: ${classification.recordId} - ${classification.message}`);
      
    } else if (classification.isConstraintViolation) {
      result.handled = true;
      
      switch (classification.errorType) {
        case 'foreign_key_constraint':
          result.action = 'fail_batch';
          result.message = `Foreign key constraint violation for record: ${classification.recordId}`;
          result.requiresUserAttention = true;
          break;
          
        case 'data_validation':
          result.action = 'skip_record';
          result.message = `Data validation error for record: ${classification.recordId} - ${classification.message}`;
          result.shouldContinue = true;
          break;
          
        case 'data_type_error':
          result.action = 'skip_record';
          result.message = `Data type error for record: ${classification.recordId} - ${classification.message}`;
          result.shouldContinue = true;
          break;
          
        default:
          result.action = 'log_error';
          result.message = `Constraint violation: ${classification.message}`;
          result.shouldContinue = true;
      }
      
      console.error(`Constraint violation handled: ${result.message}`);
      
    } else {
      result.message = `Unhandled constraint violation: ${classification.message}`;
      console.error(result.message);
    }

    return result;
  }

  /**
   * Validate database integrity during duplicate handling operations
   * @param {string} tableName - Name of the table to validate
   * @param {Array<string>} sampleIds - Sample IDs to verify integrity
   * @returns {Promise<Object>} Database integrity validation result
   */
  async validateDatabaseIntegrity(tableName = 'backup_table', sampleIds = []) {
    const validation = {
      isValid: false,
      checks: [],
      errors: [],
      warnings: [],
      tableName: tableName
    };

    try {
      // Check 1: Table exists and is accessible
      const tableExistsSQL = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `;
      const [tableExists] = await this.query(tableExistsSQL, [tableName]);
      
      if (tableExists.count === 0) {
        validation.errors.push(`Table ${tableName} does not exist`);
        return validation;
      }
      
      validation.checks.push({ check: 'table_exists', status: 'passed' });

      // Check 2: Primary key integrity
      const primaryKeySQL = `
        SELECT COUNT(*) as duplicate_count 
        FROM (
          SELECT Id, COUNT(*) as cnt 
          FROM ${tableName} 
          GROUP BY Id 
          HAVING cnt > 1
        ) as duplicates
      `;
      const [primaryKeyCheck] = await this.query(primaryKeySQL);
      
      if (primaryKeyCheck.duplicate_count > 0) {
        validation.errors.push(`Found ${primaryKeyCheck.duplicate_count} duplicate primary keys in ${tableName}`);
      } else {
        validation.checks.push({ check: 'primary_key_integrity', status: 'passed' });
      }

      // Check 3: Index integrity
      const indexCheckSQL = `
        SELECT index_name, cardinality, nullable
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY index_name
      `;
      const indexResults = await this.query(indexCheckSQL, [tableName]);
      
      if (indexResults.length === 0) {
        validation.warnings.push(`No indexes found on table ${tableName} - performance may be impacted`);
      } else {
        validation.checks.push({ 
          check: 'indexes_exist', 
          status: 'passed',
          details: `Found ${indexResults.length} indexes`
        });
      }

      // Check 4: Sample data integrity (if sample IDs provided)
      if (sampleIds.length > 0) {
        const sampleCheckSQL = `SELECT COUNT(*) as found_count FROM ${tableName} WHERE Id IN (${sampleIds.map(() => '?').join(',')})`;
        const [sampleCheck] = await this.query(sampleCheckSQL, sampleIds);
        
        if (sampleCheck.found_count !== sampleIds.length) {
          validation.warnings.push(`Sample integrity check: Expected ${sampleIds.length} records, found ${sampleCheck.found_count}`);
        } else {
          validation.checks.push({ check: 'sample_data_integrity', status: 'passed' });
        }
      }

      // Check 5: Table statistics consistency
      const statsSQL = `
        SELECT 
          table_rows,
          avg_row_length,
          data_length,
          index_length
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `;
      const [stats] = await this.query(statsSQL, [tableName]);
      
      if (stats) {
        validation.checks.push({ 
          check: 'table_statistics', 
          status: 'passed',
          details: {
            rows: stats.table_rows,
            avgRowLength: stats.avg_row_length,
            dataSize: stats.data_length,
            indexSize: stats.index_length
          }
        });
      }

      // Overall validation result
      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Integrity validation failed: ${error.message}`);
      console.error('Database integrity validation error:', error);
    }

    return validation;
  }

  /**
   * Create fallback mechanisms for duplicate detection query failures
   * @param {Array<string>} ids - IDs to check for duplicates
   * @param {Object} options - Fallback options
   * @returns {Promise<Array<string>>} Array of duplicate IDs using fallback methods
   */
  async fallbackDuplicateDetection(ids, options = {}) {
    const fallbackOptions = {
      useIndividualQueries: true,
      useCachedResults: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    const result = {
      duplicateIds: [],
      method: 'unknown',
      errors: [],
      fallbacksUsed: []
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return result;
    }

    // Fallback 1: Try batch detection with smaller chunks
    try {
      const smallChunkSize = 100; // Smaller chunks for fallback
      const duplicates = [];
      
      for (let i = 0; i < ids.length; i += smallChunkSize) {
        const chunk = ids.slice(i, i + smallChunkSize);
        const chunkDuplicates = await this.batchCheckDuplicateIds(chunk);
        duplicates.push(...chunkDuplicates);
      }
      
      result.duplicateIds = duplicates;
      result.method = 'small_batch';
      result.fallbacksUsed.push('small_batch_detection');
      return result;
      
    } catch (batchError) {
      result.errors.push(`Batch fallback failed: ${batchError.message}`);
    }

    // Fallback 2: Individual queries (if enabled)
    if (fallbackOptions.useIndividualQueries) {
      try {
        const duplicates = [];
        
        for (const id of ids) {
          let retries = 0;
          while (retries < fallbackOptions.maxRetries) {
            try {
              const isDuplicate = await this.isDuplicateId(id);
              if (isDuplicate) {
                duplicates.push(id);
              }
              break; // Success, exit retry loop
            } catch (individualError) {
              retries++;
              if (retries < fallbackOptions.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, fallbackOptions.retryDelay));
              } else {
                result.errors.push(`Individual query failed for ID ${id}: ${individualError.message}`);
              }
            }
          }
        }
        
        result.duplicateIds = duplicates;
        result.method = 'individual_queries';
        result.fallbacksUsed.push('individual_query_detection');
        return result;
        
      } catch (individualError) {
        result.errors.push(`Individual query fallback failed: ${individualError.message}`);
      }
    }

    // Fallback 3: Use cached results (if available and enabled)
    if (fallbackOptions.useCachedResults && this.duplicateCache) {
      try {
        const cachedDuplicates = [];
        const now = Date.now();
        const cacheTimeout = 300000; // 5 minutes
        
        for (const id of ids) {
          const cached = this.duplicateCache.get(id);
          if (cached && (now - cached.timestamp) < cacheTimeout && cached.isDuplicate) {
            cachedDuplicates.push(id);
          }
        }
        
        if (cachedDuplicates.length > 0) {
          result.duplicateIds = cachedDuplicates;
          result.method = 'cached_results';
          result.fallbacksUsed.push('cached_duplicate_detection');
          console.warn(`Using cached results for ${cachedDuplicates.length} duplicate IDs due to query failures`);
        }
        
      } catch (cacheError) {
        result.errors.push(`Cache fallback failed: ${cacheError.message}`);
      }
    }

    // If all fallbacks failed, log the situation
    if (result.duplicateIds.length === 0 && result.errors.length > 0) {
      console.error('All duplicate detection fallbacks failed:', result.errors);
      result.method = 'failed';
    }

    return result;
  }

  /**
   * Enhanced error handling wrapper for database operations
   * @param {Function} operation - Database operation function
   * @param {Object} context - Operation context information
   * @param {Object} options - Error handling options
   * @returns {Promise<Object>} Operation result with error handling
   */
  async executeWithErrorHandling(operation, context = {}, options = {}) {
    const errorHandlingOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      throwOnFailure: true,
      ...options
    };

    const result = {
      success: false,
      data: null,
      error: null,
      retries: 0,
      context: context
    };

    let lastError = null;

    for (let attempt = 0; attempt <= errorHandlingOptions.maxRetries; attempt++) {
      try {
        result.data = await operation();
        result.success = true;
        result.retries = attempt;
        return result;
        
      } catch (error) {
        lastError = error;
        const classification = this.classifyDatabaseError(error, context.record, context.operation);
        
        if (errorHandlingOptions.logErrors) {
          console.error(`Database operation failed (attempt ${attempt + 1}):`, {
            operation: context.operation,
            error: classification,
            context: context
          });
        }

        // Check if error is retryable
        if (classification.isRetryable && attempt < errorHandlingOptions.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, classification.retryDelay || errorHandlingOptions.retryDelay));
          continue;
        }

        // Handle non-retryable errors
        if (classification.isDuplicate) {
          result.success = true; // Treat duplicates as successful handling
          result.data = { handled: true, type: 'duplicate', recordId: classification.recordId };
          result.retries = attempt;
          return result;
        }

        break; // Exit retry loop for non-retryable errors
      }
    }

    // All retries exhausted or non-retryable error
    result.error = lastError;
    result.retries = errorHandlingOptions.maxRetries;

    if (errorHandlingOptions.throwOnFailure && !result.success) {
      throw lastError;
    }

    return result;
  }

  /**
   * Create transaction-safe duplicate skipping mechanism
   * @param {Array} records - Records to process
   * @param {string} sourceFile - Source file name
   * @param {Function} insertFunction - Function to perform insertion
   * @returns {Promise<Object>} Transaction-safe processing result
   */
  async transactionSafeDuplicateSkipping(records, sourceFile, insertFunction = null) {
    const result = {
      success: false,
      totalRecords: records.length,
      processedRecords: 0,
      duplicatesSkipped: 0,
      systemErrors: 0,
      errors: [],
      processedRecordIds: [],
      duplicateIds: [],
      systemErrorIds: []
    };

    if (!insertFunction) {
      insertFunction = this.insertBackupRecordWithMetadata.bind(this);
    }

    for (const record of records) {
      try {
        const recordId = record.id || record.Id;
        const phone = record.phoneNumber || record.Phone;
        const metadata = record.extractedMetadata ? JSON.stringify(record.extractedMetadata) : null;
        
        const insertResult = await insertFunction(recordId, phone, sourceFile, metadata);
        
        if (insertResult) {
          result.processedRecords++;
          result.processedRecordIds.push(recordId);
        } else {
          // insertFunction returned null, indicating duplicate was handled gracefully
          result.duplicatesSkipped++;
          result.duplicateIds.push(recordId);
        }
        
      } catch (error) {
        const errorClassification = this.classifyDatabaseError(error, record);
        
        if (errorClassification.isDuplicate) {
          result.duplicatesSkipped++;
          result.duplicateIds.push(errorClassification.recordId);
        } else if (errorClassification.isSystemError && errorClassification.shouldRetry) {
          result.systemErrors++;
          result.systemErrorIds.push(errorClassification.recordId);
          result.errors.push(`System error for record ${errorClassification.recordId}: ${errorClassification.message}`);
        } else {
          result.errors.push(`Error processing record ${errorClassification.recordId}: ${errorClassification.message}`);
        }
      }
    }

    result.success = result.processedRecords > 0 || result.duplicatesSkipped > 0;
    
    console.log(`Transaction-safe processing completed: ${result.processedRecords} processed, ${result.duplicatesSkipped} duplicates skipped, ${result.systemErrors} system errors`);
    
    return result;
  }

  /**
   * Insert record into check_table with validation status
   */
  async insertCheckRecord(id, phone, status, companyName = null, physicalAddress = null, email = null, website = null) {
    const sql = `
      INSERT INTO check_table (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    try {
      const result = await this.query(sql, [id, phone, status, companyName, physicalAddress, email, website]);
      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('Email') || error.message.includes('unique_email')) {
          throw new Error(`Email address already exists: ${email}`);
        } else {
          console.warn(`Duplicate entry for check_table: ${id}`);
          return null; // Handle gracefully
        }
      }
      throw error;
    }
  }

  /**
   * Update company information in check_table (prevents updates to Id, Phone, Status)
   */
  async updateCheckRecord(id, companyData) {
    const { companyName, physicalAddress, email, website } = companyData;
    const sql = `
      UPDATE check_table 
      SET CompanyName = ?, PhysicalAddress = ?, Email = ?, Website = ?
      WHERE Id = ?
    `;
    try {
      const result = await this.query(sql, [companyName, physicalAddress, email, website, id]);
      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' && (error.message.includes('Email') || error.message.includes('unique_email'))) {
        throw new Error(`Email address already exists: ${email}`);
      }
      throw error;
    }
  }

  /**
   * Get records from backup_table for validation processing
   */
  async getBackupRecords(limit = null, offset = 0) {
    let sql = 'SELECT Id, Phone, source_file, extracted_metadata FROM backup_table ORDER BY created_at';
    const params = [];
    
    if (limit !== null && limit !== undefined && limit > 0) {
      sql += ' LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);
    }
    
    return await this.query(sql, params);
  }

  /**
   * Get records from check_table by range for export
   */
  async getCheckRecordsByRange(start, end) {
    const limit = parseInt(Math.max(1, end - start + 1));
    const offset = parseInt(Math.max(0, start - 1));
    
    const sql = `
      SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at
      FROM check_table 
      ORDER BY Id 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    return await this.query(sql);
  }

  /**
   * Get check_table records with pagination
   */
  async getCheckRecords(limit = 50, offset = 0) {
    const sql = `
      SELECT Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website, created_at, updated_at
      FROM check_table 
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    return await this.query(sql);
  }

  /**
   * Get statistics for both tables
   */
  async getTableStats() {
    try {
      const backupCountSQL = 'SELECT COUNT(*) as count FROM backup_table';
      const checkCountSQL = 'SELECT COUNT(*) as count FROM check_table';
      const validatedCountSQL = 'SELECT COUNT(*) as count FROM check_table WHERE Status = true';
      const invalidCountSQL = 'SELECT COUNT(*) as count FROM check_table WHERE Status = false';
      
      const [backupCount] = await this.query(backupCountSQL);
      const [checkCount] = await this.query(checkCountSQL);
      const [validatedCount] = await this.query(validatedCountSQL);
      const [invalidCount] = await this.query(invalidCountSQL);
      
      return {
        backupTable: backupCount?.count || 0,
        checkTable: checkCount?.count || 0,
        validatedPhones: validatedCount?.count || 0,
        invalidPhones: invalidCount?.count || 0
      };
    } catch (error) {
      console.error('Error getting table stats:', error);
      return {
        backupTable: 0,
        checkTable: 0,
        validatedPhones: 0,
        invalidPhones: 0
      };
    }
  }

  /**
   * Check if record exists in backup_table
   */
  async backupRecordExists(id) {
    const sql = 'SELECT 1 FROM backup_table WHERE Id = ? LIMIT 1';
    const result = await this.query(sql, [id]);
    return result.length > 0;
  }

  /**
   * Check if record exists in check_table
   */
  async checkRecordExists(id) {
    const sql = 'SELECT 1 FROM check_table WHERE Id = ? LIMIT 1';
    const result = await this.query(sql, [id]);
    return result.length > 0;
  }

  /**
   * Get total count of records in check_table for range validation
   */
  async getCheckTableCount() {
    const sql = 'SELECT COUNT(*) as count FROM check_table';
    const [result] = await this.query(sql);
    return result.count;
  }

  /**
   * Insert file metadata into uploaded_files table
   */
  async insertFileMetadata(originalFilename, storedFilename, fileSize, checksum = null) {
    const sql = `
      INSERT INTO uploaded_files (original_filename, stored_filename, file_size, checksum, processing_status) 
      VALUES (?, ?, ?, ?, 'pending')
    `;
    try {
      const result = await this.query(sql, [originalFilename, storedFilename, fileSize, checksum]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Insert file metadata with file type support (PDF or Excel)
   */
  async insertFileMetadataWithType(originalFilename, storedFilename, fileSize, fileType = 'pdf', checksum = null) {
    const sql = `
      INSERT INTO uploaded_files (original_filename, stored_filename, file_size, file_type, checksum, processing_status) 
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;
    try {
      const result = await this.query(sql, [originalFilename, storedFilename, fileSize, fileType, checksum]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update file processing status with optional duplicate handling metadata
   */
  async updateFileProcessingStatus(storedFilename, status, recordsExtracted = 0, duplicateHandlingMetadata = null) {
    let sql, params;
    
    if (duplicateHandlingMetadata) {
      sql = `
        UPDATE uploaded_files 
        SET processing_status = ?, records_extracted = ?, processed_at = CURRENT_TIMESTAMP,
            duplicates_skipped = ?, duplicate_percentage = ?, duplicate_handling_status = ?
        WHERE stored_filename = ?
      `;
      params = [
        status, 
        recordsExtracted, 
        duplicateHandlingMetadata.duplicatesSkipped || 0,
        duplicateHandlingMetadata.duplicatePercentage || 0,
        duplicateHandlingMetadata.duplicateHandlingStatus || 'unknown',
        storedFilename
      ];
    } else {
      sql = `
        UPDATE uploaded_files 
        SET processing_status = ?, records_extracted = ?, processed_at = CURRENT_TIMESTAMP
        WHERE stored_filename = ?
      `;
      params = [status, recordsExtracted, storedFilename];
    }
    
    try {
      const result = await this.query(sql, params);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update Excel file processing status with worksheets and extraction report
   */
  async updateExcelFileProcessingStatus(storedFilename, status, recordsExtracted = 0, worksheetsProcessed = 0, extractionReport = null) {
    const sql = `
      UPDATE uploaded_files 
      SET processing_status = ?, records_extracted = ?, worksheets_processed = ?, extraction_report = ?, processed_at = CURRENT_TIMESTAMP
      WHERE stored_filename = ?
    `;
    try {
      const result = await this.query(sql, [status, recordsExtracted, worksheetsProcessed, extractionReport, storedFilename]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file metadata by stored filename
   */
  async getFileMetadata(storedFilename) {
    const sql = `
      SELECT id, original_filename, stored_filename, file_size, file_type, checksum, 
             upload_timestamp, processing_status, records_extracted, worksheets_processed, 
             extraction_report, processed_at
      FROM uploaded_files 
      WHERE stored_filename = ?
    `;
    const result = await this.query(sql, [storedFilename]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * List uploaded files with pagination and optimized indexing
   */
  async getUploadedFiles(limit = 50, offset = 0, status = null, sortBy = 'upload_timestamp', sortOrder = 'DESC') {
    try {
      // Validate and sanitize parameters
      const safeLimit = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
      const safeOffset = Math.max(0, parseInt(offset) || 0);
      
      // Validate sort parameters to prevent SQL injection
      const allowedSortFields = ['upload_timestamp', 'file_size', 'original_filename', 'processing_status'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'upload_timestamp';
      const safeSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      let sql = `
        SELECT id, original_filename, stored_filename, file_size, file_type, checksum,
               upload_timestamp, processing_status, records_extracted, worksheets_processed,
               extraction_report, processed_at
        FROM uploaded_files
      `;
      const params = [];
      
      if (status && typeof status === 'string') {
        sql += ' WHERE processing_status = ?';
        params.push(status);
      }
      
      sql += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      
      return await this.query(sql, params);
    } catch (error) {
      console.error('Error in getUploadedFiles:', error);
      return [];
    }
  }

  /**
   * Get file metadata with optimized query
   */
  async getFileMetadataOptimized(storedFilename) {
    const sql = `
      SELECT id, original_filename, stored_filename, file_size, file_type, checksum, 
             upload_timestamp, processing_status, records_extracted, worksheets_processed,
             extraction_report, processed_at
      FROM uploaded_files 
      WHERE stored_filename = ?
      LIMIT 1
    `;
    const result = await this.preparedQuery(sql, [storedFilename], true);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Batch insert file metadata for better performance
   */
  async batchInsertFileMetadata(fileMetadataArray) {
    if (!fileMetadataArray || fileMetadataArray.length === 0) {
      return [];
    }

    const sql = `
      INSERT INTO uploaded_files (original_filename, stored_filename, file_size, file_type, checksum, processing_status) 
      VALUES ?
    `;
    
    const values = fileMetadataArray.map(metadata => [
      metadata.originalFilename,
      metadata.storedFilename,
      metadata.fileSize,
      metadata.fileType || 'pdf',
      metadata.checksum || null,
      'pending'
    ]);

    try {
      const result = await this.query(sql, [values]);
      return result;
    } catch (error) {
      console.error('Batch insert file metadata failed:', error);
      throw error;
    }
  }

  /**
   * Get file processing statistics with optimized aggregation
   */
  async getFileStatsOptimized() {
    const sql = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_files,
        COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_files,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN file_type = 'pdf' THEN 1 END) as pdf_files,
        COUNT(CASE WHEN file_type = 'excel' THEN 1 END) as excel_files,
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(SUM(CASE WHEN processing_status = 'processed' THEN records_extracted ELSE 0 END), 0) as total_records,
        COALESCE(SUM(CASE WHEN file_type = 'excel' AND processing_status = 'processed' THEN worksheets_processed ELSE 0 END), 0) as total_worksheets,
        AVG(file_size) as avg_file_size,
        MAX(upload_timestamp) as latest_upload,
        MIN(upload_timestamp) as earliest_upload
      FROM uploaded_files
    `;
    
    const [result] = await this.preparedQuery(sql, [], true);
    return {
      totalFiles: result.total_files,
      processedFiles: result.processed_files,
      pendingFiles: result.pending_files,
      failedFiles: result.failed_files,
      pdfFiles: result.pdf_files,
      excelFiles: result.excel_files,
      totalSize: result.total_size,
      totalRecordsExtracted: result.total_records,
      totalWorksheetsProcessed: result.total_worksheets,
      averageFileSize: Math.round(result.avg_file_size || 0),
      latestUpload: result.latest_upload,
      earliestUpload: result.earliest_upload
    };
  }

  /**
   * Clean up old file metadata records for performance
   */
  async cleanupOldFileMetadata(retentionDays = 90) {
    const sql = `
      DELETE FROM uploaded_files 
      WHERE upload_timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND processing_status IN ('failed', 'archived')
    `;
    
    try {
      const result = await this.query(sql, [retentionDays]);
      console.log(`Cleaned up ${result.affectedRows} old file metadata records`);
      return result.affectedRows;
    } catch (error) {
      console.error('Failed to cleanup old file metadata:', error);
      throw error;
    }
  }

  /**
   * Optimize database tables for better performance
   */
  async optimizeTables() {
    const tables = ['backup_table', 'check_table', 'uploaded_files'];
    const results = [];
    
    for (const table of tables) {
      try {
        const result = await this.query(`OPTIMIZE TABLE ${table}`);
        results.push({ table, result: result[0] });
        console.log(`Optimized table: ${table}`);
      } catch (error) {
        console.error(`Failed to optimize table ${table}:`, error.message);
        results.push({ table, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Analyze table performance and suggest optimizations
   */
  async analyzeTablePerformance() {
    const analysis = {};
    
    try {
      // Check table sizes
      const tableSizes = await this.query(`
        SELECT 
          table_name,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
          table_rows
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_name IN ('backup_table', 'check_table', 'uploaded_files')
      `);
      
      analysis.tableSizes = tableSizes;
      
      // Check index usage
      const indexUsage = await this.query(`
        SELECT 
          table_name,
          index_name,
          cardinality,
          nullable
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE()
        AND table_name IN ('backup_table', 'check_table', 'uploaded_files')
        ORDER BY table_name, cardinality DESC
      `);
      
      analysis.indexUsage = indexUsage;
      
      // Check for slow queries (if performance_schema is enabled)
      try {
        const slowQueries = await this.query(`
          SELECT 
            digest_text,
            count_star,
            avg_timer_wait/1000000000 as avg_time_seconds,
            sum_timer_wait/1000000000 as total_time_seconds
          FROM performance_schema.events_statements_summary_by_digest 
          WHERE digest_text LIKE '%backup_table%' 
             OR digest_text LIKE '%check_table%' 
             OR digest_text LIKE '%uploaded_files%'
          ORDER BY avg_timer_wait DESC 
          LIMIT 10
        `);
        
        analysis.slowQueries = slowQueries;
      } catch (error) {
        analysis.slowQueries = 'Performance schema not available';
      }
      
      return analysis;
      
    } catch (error) {
      console.error('Failed to analyze table performance:', error);
      throw error;
    }
  }

  /**
   * Get file processing statistics
   */
  async getFileStats() {
    try {
      const totalFilesSQL = 'SELECT COUNT(*) as count FROM uploaded_files';
      const processedFilesSQL = 'SELECT COUNT(*) as count FROM uploaded_files WHERE processing_status = "processed"';
      const pendingFilesSQL = 'SELECT COUNT(*) as count FROM uploaded_files WHERE processing_status = "pending"';
      const failedFilesSQL = 'SELECT COUNT(*) as count FROM uploaded_files WHERE processing_status = "failed"';
      const totalSizeSQL = 'SELECT SUM(file_size) as total_size FROM uploaded_files';
      const totalRecordsSQL = 'SELECT SUM(records_extracted) as total_records FROM uploaded_files WHERE processing_status = "processed"';
      
      const [totalFiles] = await this.query(totalFilesSQL);
      const [processedFiles] = await this.query(processedFilesSQL);
      const [pendingFiles] = await this.query(pendingFilesSQL);
      const [failedFiles] = await this.query(failedFilesSQL);
      const [totalSize] = await this.query(totalSizeSQL);
      const [totalRecords] = await this.query(totalRecordsSQL);
      
      return {
        totalFiles: totalFiles?.count || 0,
        processedFiles: processedFiles?.count || 0,
        pendingFiles: pendingFiles?.count || 0,
        failedFiles: failedFiles?.count || 0,
        totalSize: totalSize?.total_size || 0,
        totalRecordsExtracted: totalRecords?.total_records || 0
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      return {
        totalFiles: 0,
        processedFiles: 0,
        pendingFiles: 0,
        failedFiles: 0,
        totalSize: 0,
        totalRecordsExtracted: 0
      };
    }
  }

  /**
   * Get duplicate handling statistics across all processed files
   */
  async getDuplicateHandlingStats() {
    try {
      // Get total duplicates skipped across all files
      const totalDuplicatesSQL = 'SELECT SUM(duplicates_skipped) as total_duplicates FROM uploaded_files WHERE processing_status = "processed"';
      
      // Get count of files that had duplicates
      const filesWithDuplicatesSQL = 'SELECT COUNT(*) as count FROM uploaded_files WHERE processing_status = "processed" AND duplicates_skipped > 0';
      
      // Get average duplicate percentage
      const avgDuplicatePercentageSQL = 'SELECT AVG(duplicate_percentage) as avg_percentage FROM uploaded_files WHERE processing_status = "processed" AND duplicate_percentage > 0';
      
      // Get last duplicate detection timestamp
      const lastDuplicateDetectionSQL = 'SELECT MAX(processed_at) as last_detection FROM uploaded_files WHERE processing_status = "processed" AND duplicates_skipped > 0';
      
      const [totalDuplicates] = await this.query(totalDuplicatesSQL);
      const [filesWithDuplicates] = await this.query(filesWithDuplicatesSQL);
      const [avgDuplicatePercentage] = await this.query(avgDuplicatePercentageSQL);
      const [lastDuplicateDetection] = await this.query(lastDuplicateDetectionSQL);
      
      return {
        totalDuplicatesSkipped: totalDuplicates?.total_duplicates || 0,
        filesWithDuplicates: filesWithDuplicates?.count || 0,
        averageDuplicatePercentage: Math.round((avgDuplicatePercentage?.avg_percentage || 0) * 100) / 100,
        lastDuplicateDetection: lastDuplicateDetection?.last_detection || null
      };
    } catch (error) {
      console.error('Error getting duplicate handling stats:', error);
      return {
        totalDuplicatesSkipped: 0,
        filesWithDuplicates: 0,
        averageDuplicatePercentage: 0,
        lastDuplicateDetection: null
      };
    }
  }

  /**
   * Delete file metadata (for file cleanup)
   */
  async deleteFileMetadata(storedFilename) {
    const sql = 'DELETE FROM uploaded_files WHERE stored_filename = ?';
    try {
      const result = await this.query(sql, [storedFilename]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Check if a single ID exists in backup_table (efficient indexed lookup)
   * @param {string} id - The ID to check for duplicates
   * @returns {Promise<boolean>} True if ID exists, false otherwise
   */
  async isDuplicateId(id) {
    const sql = 'SELECT 1 FROM backup_table WHERE Id = ? LIMIT 1';
    try {
      const result = await this.preparedQuery(sql, [id], true);
      return result.length > 0;
    } catch (error) {
      console.error('Error checking for duplicate ID:', error.message);
      throw error;
    }
  }

  /**
   * Check multiple IDs for duplicates using efficient batch query with SQL IN clause
   * @param {Array<string>} ids - Array of IDs to check for duplicates
   * @returns {Promise<Array<string>>} Array of IDs that already exist in backup_table
   */
  async batchCheckDuplicateIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    // Handle large batches by chunking to avoid SQL query limits
    const chunkSize = 1000; // MySQL IN clause limit consideration
    const duplicateIds = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      // Create placeholders for IN clause
      const placeholders = chunk.map(() => '?').join(',');
      const sql = `SELECT Id FROM backup_table WHERE Id IN (${placeholders})`;
      
      try {
        const result = await this.preparedQuery(sql, chunk, true);
        const chunkDuplicates = result.map(row => row.Id);
        duplicateIds.push(...chunkDuplicates);
      } catch (error) {
        console.error('Error in batch duplicate check:', error.message);
        throw error;
      }
    }

    return duplicateIds;
  }

  /**
   * Get existing records from backup_table for given IDs with metadata
   * @param {Array<string>} ids - Array of IDs to retrieve
   * @returns {Promise<Array<Object>>} Array of existing records with metadata
   */
  async getExistingRecords(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const chunkSize = 1000;
    const existingRecords = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      const placeholders = chunk.map(() => '?').join(',');
      const sql = `
        SELECT Id, Phone, source_file, extracted_metadata, created_at 
        FROM backup_table 
        WHERE Id IN (${placeholders})
      `;
      
      try {
        const result = await this.preparedQuery(sql, chunk, true);
        existingRecords.push(...result);
      } catch (error) {
        console.error('Error retrieving existing records:', error.message);
        throw error;
      }
    }

    return existingRecords;
  }

  /**
   * Optimized duplicate detection with indexed lookups for large datasets
   * @param {Array<Object>} records - Array of records to check
   * @returns {Promise<Object>} Duplicate detection result with performance metrics
   */
  async optimizedDuplicateDetection(records) {
    const startTime = Date.now();
    const result = {
      totalRecords: records.length,
      duplicateIds: [],
      newRecords: [],
      existingRecords: [],
      performanceMetrics: {
        detectionTime: 0,
        queriesExecuted: 0,
        recordsPerSecond: 0
      }
    };

    if (!Array.isArray(records) || records.length === 0) {
      result.performanceMetrics.detectionTime = Date.now() - startTime;
      return result;
    }

    try {
      // Extract IDs for batch checking
      const idsToCheck = records.map(record => record.id || record.Id).filter(id => id);
      
      // Perform batch duplicate detection
      const duplicateIds = await this.batchCheckDuplicateIds(idsToCheck);
      const duplicateIdSet = new Set(duplicateIds);
      
      // Get existing record metadata for duplicates
      if (duplicateIds.length > 0) {
        result.existingRecords = await this.getExistingRecords(duplicateIds);
      }
      
      // Separate new records from duplicates
      result.newRecords = records.filter(record => {
        const recordId = record.id || record.Id;
        return recordId && !duplicateIdSet.has(recordId);
      });
      
      result.duplicateIds = duplicateIds;
      result.performanceMetrics.queriesExecuted = Math.ceil(idsToCheck.length / 1000) + (duplicateIds.length > 0 ? Math.ceil(duplicateIds.length / 1000) : 0);
      
    } catch (error) {
      console.error('Error in optimized duplicate detection:', error.message);
      throw error;
    }

    // Calculate performance metrics
    const detectionTime = Date.now() - startTime;
    result.performanceMetrics.detectionTime = detectionTime;
    result.performanceMetrics.recordsPerSecond = detectionTime > 0 ? Math.round((records.length / detectionTime) * 1000) : 0;

    // Log performance for monitoring
    if (detectionTime > 5000) { // Log slow duplicate detection (>5 seconds)
      console.warn(`Slow duplicate detection: ${detectionTime}ms for ${records.length} records`);
    }

    return result;
  }

  /**
   * Create optimized indexes for duplicate detection performance
   * @returns {Promise<Object>} Index creation results
   */
  async createDuplicateDetectionIndexes() {
    const indexQueries = [
      {
        name: 'backup_table_id_index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_backup_id ON backup_table (Id)'
      },
      {
        name: 'backup_table_composite_index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_backup_id_phone ON backup_table (Id, Phone)'
      },
      {
        name: 'backup_table_source_file_index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_backup_source_file ON backup_table (source_file)'
      },
      {
        name: 'backup_table_created_at_index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_backup_created_at ON backup_table (created_at)'
      }
    ];

    const results = [];
    
    for (const indexQuery of indexQueries) {
      try {
        await this.query(indexQuery.sql);
        results.push({ 
          index: indexQuery.name, 
          status: 'created',
          message: 'Index created successfully'
        });
        console.log(`Created index: ${indexQuery.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          results.push({ 
            index: indexQuery.name, 
            status: 'exists',
            message: 'Index already exists'
          });
        } else {
          results.push({ 
            index: indexQuery.name, 
            status: 'failed',
            message: error.message
          });
          console.error(`Failed to create index ${indexQuery.name}:`, error.message);
        }
      }
    }

    return {
      success: results.every(r => r.status === 'created' || r.status === 'exists'),
      results: results
    };
  }

  /**
   * Query optimization for large backup_table datasets
   * @param {number} estimatedTableSize - Estimated number of records in backup_table
   * @returns {Promise<Object>} Optimization recommendations and actions taken
   */
  async optimizeForLargeDataset(estimatedTableSize = null) {
    const optimization = {
      actions: [],
      recommendations: [],
      currentTableSize: 0,
      optimizationApplied: false
    };

    try {
      // Get current table size
      const tableStats = await this.query(`
        SELECT 
          table_rows as row_count,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
          avg_row_length
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = 'backup_table'
      `);

      if (tableStats.length > 0) {
        optimization.currentTableSize = tableStats[0].row_count;
        const tableSizeMB = tableStats[0].size_mb;

        // Apply optimizations based on table size
        if (optimization.currentTableSize > 1000000) { // Large dataset (>1M records)
          // Create optimized indexes
          const indexResult = await this.createDuplicateDetectionIndexes();
          optimization.actions.push(`Created ${indexResult.results.length} indexes`);
          
          // Optimize table structure
          await this.query('OPTIMIZE TABLE backup_table');
          optimization.actions.push('Optimized table structure');
          
          // Update table statistics
          await this.query('ANALYZE TABLE backup_table');
          optimization.actions.push('Updated table statistics');
          
          optimization.recommendations.push('Consider partitioning the table by date or ID range');
          optimization.recommendations.push('Monitor query performance and adjust batch sizes');
          
        } else if (optimization.currentTableSize > 100000) { // Medium dataset
          const indexResult = await this.createDuplicateDetectionIndexes();
          optimization.actions.push(`Ensured indexes exist: ${indexResult.results.length} indexes`);
          
          optimization.recommendations.push('Monitor duplicate detection performance');
        }

        optimization.optimizationApplied = optimization.actions.length > 0;
        
        console.log(`Database optimization completed for table with ${optimization.currentTableSize} records (${tableSizeMB}MB)`);
      }

    } catch (error) {
      console.error('Database optimization failed:', error.message);
      optimization.error = error.message;
    }

    return optimization;
  }

  /**
   * Initialize duplicate cache for frequently checked IDs
   */
  initializeDuplicateCache() {
    if (!this.duplicateCache) {
      this.duplicateCache = new Map();
      console.log('Duplicate cache initialized');
    }
  }

  /**
   * Clean up expired cache entries
   * @param {number} cacheTimeout - Cache timeout in milliseconds
   */
  cleanupDuplicateCache(cacheTimeout = 300000) {
    if (!this.duplicateCache) {
      return;
    }

    const now = Date.now();
    const expiredKeys = [];

    for (const [key, value] of this.duplicateCache.entries()) {
      if ((now - value.timestamp) >= cacheTimeout) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.duplicateCache.delete(key);
    }

    console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
  }
}

// Export singleton instance
const databaseManager = new DatabaseManager();
module.exports = databaseManager;