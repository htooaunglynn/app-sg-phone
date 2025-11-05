const { Pool } = require('pg');
const config = require('./config');

class PostgresDatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000;
    }

    /**
     * Create PostgreSQL connection pool
     */
    createPool() {
        // Support both DATABASE_URL (production) and individual config (development)
        const connectionConfig = process.env.DATABASE_URL
            ? {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.DB_SSL === 'true' ? {
                    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
                } : false
            }
            : {
                host: config.database.host,
                port: config.database.port || 5432,
                user: config.database.user,
                password: config.database.password,
                database: config.database.database,
                ssl: process.env.DB_SSL === 'true' ? {
                    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
                } : false
            };

        const poolConfig = {
            ...connectionConfig,
            max: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 300000,
            connectionTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
        };

        this.pool = new Pool(poolConfig);

        // Monitor pool events
        this.pool.on('connect', (client) => {
            console.log('New PostgreSQL connection established');
        });

        this.pool.on('error', (err, client) => {
            console.error('Unexpected PostgreSQL pool error:', err);
            if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
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
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            this.retryAttempts = 0;
            console.log('PostgreSQL connected successfully');
            return this.pool;

        } catch (error) {
            console.error('PostgreSQL connection failed:', error.message);

            if (this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);

                console.log(`Retrying database connection in ${delay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.connect();
            } else {
                this.isConnected = false;
                throw new Error(`Failed to connect to PostgreSQL after ${this.maxRetries} attempts: ${error.message}`);
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
            return await this.pool.connect();
        } catch (error) {
            console.error('Failed to get database connection:', error.message);
            this.isConnected = false;
            await this.connect();
            return await this.pool.connect();
        }
    }

    /**
     * Execute a query
     */
    async query(sql, params = []) {
        const startTime = Date.now();
        const client = await this.getConnection();

        try {
            const result = await client.query(sql, params);

            const queryTime = Date.now() - startTime;
            if (queryTime > 1000) {
                console.warn(`Slow query detected (${queryTime}ms):`, sql.substring(0, 100));
            }

            return result.rows;
        } catch (error) {
            console.error('Database query failed:', error.message);
            console.error('Query:', sql);
            console.error('Params:', params);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Execute multiple queries in a transaction
     */
    async transaction(queries) {
        const client = await this.getConnection();

        try {
            await client.query('BEGIN');

            const results = [];
            for (const { sql, params } of queries) {
                const result = await client.query(sql, params || []);
                results.push(result.rows);
            }

            await client.query('COMMIT');
            return results;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Transaction failed:', error.message);
            throw error;
        } finally {
            client.release();
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
            console.log('PostgreSQL connections closed');
        }
    }

    /**
     * Initialize database tables
     */
    async initializeTables() {
        const databaseInitializer = require('./initDatabase');
        return await databaseInitializer.initialize();
    }

    // Reuse all the business logic methods from the MySQL version
    // but adapt the SQL syntax where needed

    /**
     * Insert record into backup_table
     */
    async insertBackupRecord(id, phone) {
        const sql = 'INSERT INTO backup_table ("Id", "Phone") VALUES ($1, $2) ON CONFLICT ("Id") DO NOTHING';
        try {
            const result = await this.query(sql, [id, phone]);
            return result;
        } catch (error) {
            console.warn(`Error inserting into backup_table: ${id}`, error.message);
            return null;
        }
    }

    /**
     * Insert record into backup_table with metadata
     */
    async insertBackupRecordWithMetadata(id, phone, sourceFile = null, extractedMetadata = null) {
        const sql = `INSERT INTO backup_table ("Id", "Phone", source_file, extracted_metadata)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT ("Id") DO NOTHING`;
        try {
            const result = await this.query(sql, [id, phone, sourceFile, extractedMetadata]);
            return result;
        } catch (error) {
            console.warn(`Error inserting into backup_table: ${id}`, error.message);
            return null;
        }
    }

    /**
     * Insert record into backup_table with company information
     */
    async insertBackupRecordWithCompany(id, phone, companyName = null, physicalAddress = null, email = null, website = null, sourceFile = null, extractedMetadata = null) {
        const sql = `INSERT INTO backup_table
                     ("Id", "Phone", "CompanyName", "PhysicalAddress", "Email", "Website", source_file, extracted_metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT ("Id") DO NOTHING`;
        try {
            const result = await this.query(sql, [id, phone, companyName, physicalAddress, email, website, sourceFile, extractedMetadata]);
            return result;
        } catch (error) {
            console.warn(`Error inserting into backup_table: ${id}`, error.message);
            return null;
        }
    }

    /**
     * Update company information in backup_table
     */
    async updateBackupRecordCompanyInfo(id, companyName = null, physicalAddress = null, email = null, website = null) {
        const sql = `UPDATE backup_table
                     SET "CompanyName" = $1, "PhysicalAddress" = $2, "Email" = $3, "Website" = $4, updated_at = CURRENT_TIMESTAMP
                     WHERE "Id" = $5`;
        try {
            const result = await this.query(sql, [companyName, physicalAddress, email, website, id]);
            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Batch insert with duplicate handling
     */
    async insertBatchWithDuplicateHandling(records, sourceFile = null) {
        const result = {
            success: false,
            totalRecords: records.length,
            storedRecords: 0,
            duplicatesSkipped: 0,
            updatedRecords: 0,
            errors: [],
            storedRecordIds: [],
            duplicateIds: [],
            updatedRecordIds: []
        };

        if (!Array.isArray(records) || records.length === 0) {
            result.success = true;
            return result;
        }

        const client = await this.getConnection();

        try {
            await client.query('BEGIN');

            for (const record of records) {
                try {
                    const sql = `INSERT INTO backup_table
                       ("Id", "Phone", "CompanyName", "PhysicalAddress", "Email", "Website", source_file, extracted_metadata)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                       ON CONFLICT ("Id") DO UPDATE SET
                         "CompanyName" = COALESCE(EXCLUDED."CompanyName", backup_table."CompanyName"),
                         "PhysicalAddress" = COALESCE(EXCLUDED."PhysicalAddress", backup_table."PhysicalAddress"),
                         "Email" = COALESCE(EXCLUDED."Email", backup_table."Email"),
                         "Website" = COALESCE(EXCLUDED."Website", backup_table."Website"),
                         updated_at = CURRENT_TIMESTAMP
                       RETURNING (xmax = 0) AS inserted`;

                    const params = [
                        record.id || record.Id,
                        record.phoneNumber || record.Phone,
                        record.companyName || record.CompanyName || null,
                        record.physicalAddress || record.PhysicalAddress || null,
                        record.email || record.Email || null,
                        record.website || record.Website || null,
                        sourceFile,
                        record.extractedMetadata ? JSON.stringify(record.extractedMetadata) : null
                    ];

                    const insertResult = await client.query(sql, params);

                    if (insertResult.rows.length > 0 && insertResult.rows[0].inserted) {
                        result.storedRecords++;
                        result.storedRecordIds.push(record.id || record.Id);
                    } else {
                        result.duplicatesSkipped++;
                        result.updatedRecords++;
                        result.duplicateIds.push(record.id || record.Id);
                        result.updatedRecordIds.push(record.id || record.Id);
                    }

                } catch (recordError) {
                    result.errors.push(`Record ${record.id || record.Id}: ${recordError.message}`);
                    console.error(`Error inserting record ${record.id || record.Id}:`, recordError.message);
                }
            }

            await client.query('COMMIT');
            result.success = true;

            console.log(`Batch transaction completed: ${result.storedRecords} stored, ${result.duplicatesSkipped} duplicates skipped (${result.updatedRecords} company data updated)`);

        } catch (transactionError) {
            await client.query('ROLLBACK');
            result.errors.push(`Transaction failed: ${transactionError.message}`);
            console.error('Batch transaction failed:', transactionError.message);
        } finally {
            client.release();
        }

        return result;
    }

    /**
     * Insert with rollback protection
     */
    async insertWithRollbackProtection(records, sourceFile = null, batchSize = 100) {
        const result = {
            success: false,
            totalRecords: records.length,
            storedRecords: 0,
            duplicatesSkipped: 0,
            updatedRecords: 0,
            errors: [],
            storedRecordIds: [],
            duplicateIds: [],
            updatedRecordIds: [],
            batchResults: []
        };

        if (!Array.isArray(records) || records.length === 0) {
            result.success = true;
            return result;
        }

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
                result.updatedRecords += batchResult.updatedRecords || 0;
                result.storedRecordIds.push(...batchResult.storedRecordIds);
                result.duplicateIds.push(...batchResult.duplicateIds);
                result.updatedRecordIds.push(...(batchResult.updatedRecordIds || []));
                result.errors.push(...batchResult.errors);

            } catch (batchError) {
                result.errors.push(`Batch ${i + 1} failed: ${batchError.message}`);
                console.error(`Batch ${i + 1} failed:`, batchError.message);
                continue;
            }
        }

        result.success = result.storedRecords > 0 || result.duplicatesSkipped > 0;

        console.log(`Protected insertion completed: ${result.storedRecords} stored, ${result.updatedRecords} company data updated across ${batches.length} batches`);

        return result;
    }

    /**
     * Get backup records
     */
    async getBackupRecords(limit = null, offset = 0) {
        let sql = `SELECT "Id", "Phone", "CompanyName", "PhysicalAddress", "Email", "Website", source_file, extracted_metadata
                   FROM backup_table ORDER BY created_at`;
        const params = [];

        if (limit !== null && limit !== undefined && limit > 0) {
            sql += ` LIMIT $1 OFFSET $2`;
            return await this.query(sql, [parseInt(limit), parseInt(offset)]);
        }

        return await this.query(sql, params);
    }

    /**
     * Get backup records with pagination
     */
    async getBackupRecordsWithPagination(limit = 50, offset = 0) {
        const sql = `SELECT "Id", "Phone", "CompanyName", "PhysicalAddress", "Email", "Website", source_file, created_at, updated_at
                     FROM backup_table
                     ORDER BY created_at DESC
                     LIMIT $1 OFFSET $2`;

        return await this.query(sql, [parseInt(limit), parseInt(offset)]);
    }

    /**
     * Get backup record by ID
     */
    async getBackupRecordById(id) {
        const sql = `SELECT "Id", "Phone", "CompanyName", "PhysicalAddress", "Email", "Website", source_file, extracted_metadata, created_at, updated_at
                     FROM backup_table
                     WHERE "Id" = $1`;
        const result = await this.query(sql, [id]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Get table statistics
     */
    async getTableStats() {
        try {
            const backupCount = await this.query('SELECT COUNT(*) as count FROM backup_table');
            const checkCount = await this.query('SELECT COUNT(*) as count FROM check_table');
            const validatedCount = await this.query('SELECT COUNT(*) as count FROM check_table WHERE status = true');
            const invalidCount = await this.query('SELECT COUNT(*) as count FROM check_table WHERE status = false');

            return {
                backupTable: parseInt(backupCount[0]?.count || 0),
                checkTable: parseInt(checkCount[0]?.count || 0),
                validatedPhones: parseInt(validatedCount[0]?.count || 0),
                invalidPhones: parseInt(invalidCount[0]?.count || 0)
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
        const sql = 'SELECT 1 FROM backup_table WHERE "Id" = $1 LIMIT 1';
        const result = await this.query(sql, [id]);
        return result.length > 0;
    }

    /**
     * Batch check duplicate IDs
     */
    async batchCheckDuplicateIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const chunkSize = 1000;
        const duplicateIds = [];

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);

            const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
            const sql = `SELECT "Id" FROM backup_table WHERE "Id" IN (${placeholders})`;

            try {
                const result = await this.query(sql, chunk);
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
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            retryAttempts: this.retryAttempts,
            maxRetries: this.maxRetries
        };
    }
}

// Export singleton instance
const dbManager = new PostgresDatabaseManager();
module.exports = dbManager;
