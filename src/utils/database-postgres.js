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
     * Ensure new optional columns exist in check_table
     * Adds carrier and line_type if they are missing
     */
    async ensureOptionalColumns() {
        try {
            await this.query(`ALTER TABLE check_table ADD COLUMN IF NOT EXISTS carrier VARCHAR(100) NULL`);
            await this.query(`ALTER TABLE check_table ADD COLUMN IF NOT EXISTS line_type VARCHAR(50) NULL`);
        } catch (err) {
            console.warn('ensureOptionalColumns warning:', err.message);
        }
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
            // connection established (logging removed)
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
            return this.pool;

        } catch (error) {
            console.error('PostgreSQL connection failed:', error.message);

            if (this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);

                // retrying connection (logging removed)

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
        }
    }

    /**
     * Initialize database tables
     */
    async initializeTables() {
        const databaseInitializer = require('./initDatabase');
        return await databaseInitializer.initialize();
    }

    /**
     * Get table statistics
     */
    async getTableStats() {
        try {
            const checkCount = await this.query('SELECT COUNT(*) as count FROM check_table');
            const validatedCount = await this.query('SELECT COUNT(*) as count FROM check_table WHERE status = true');
            const invalidCount = await this.query('SELECT COUNT(*) as count FROM check_table WHERE status = false');

            return {
                checkTable: parseInt(checkCount[0]?.count || 0),
                validatedPhones: parseInt(validatedCount[0]?.count || 0),
                invalidPhones: parseInt(invalidCount[0]?.count || 0)
            };
        } catch (error) {
            console.error('Error getting table stats:', error);
            return {
                checkTable: 0,
                validatedPhones: 0,
                invalidPhones: 0
            };
        }
    }

    /**
     * Batch check duplicate IDs in check_table
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
            const sql = `SELECT id FROM check_table WHERE id IN (${placeholders})`;

            try {
                const result = await this.query(sql, chunk);
                const chunkDuplicates = result.map(row => row.id);
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

    /**
     * Extract numeric ID from ID string (for check_table numeric_id column)
     */
    extractNumericId(idString) {
        if (!idString || typeof idString !== 'string') {
            return null;
        }
        const match = idString.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Insert record into check_table with validation status
     */
    async insertCheckRecord(id, phone, status, companyName = null, physicalAddress = null, email = null, website = null) {
        const numericId = this.extractNumericId(id);

        const sql = `
            INSERT INTO check_table (id, numeric_id, phone, status, company_name, physical_address, email, website)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        try {
            const result = await this.query(sql, [id, numericId, phone, status, companyName, physicalAddress, email, website]);
            return result;
        } catch (error) {
            if (error.code === '23505') { // unique_violation
                console.warn(`Duplicate entry for check_table: ${id}`);
                return null;
            }
            throw error;
        }
    }

    /**
     * Update company information in check_table
     */
    async updateCheckRecord(id, companyData) {
        const { companyName, physicalAddress, email, website } = companyData;
        const sql = `
            UPDATE check_table
            SET company_name = $1, physical_address = $2, email = $3, website = $4
            WHERE id = $5
        `;
        try {
            const client = await this.getConnection();
            try {
                const result = await client.query(sql, [companyName, physicalAddress, email, website, id]);
                return result; // Return full result object with rowCount
            } finally {
                client.release();
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get check_table records by range for export
     */
    async getCheckRecordsByRange(start, end) {
        const limit = parseInt(Math.max(1, end - start + 1));
        const offset = parseInt(Math.max(0, start - 1));

        const sql = `
            SELECT id, numeric_id, phone, status,
                   company_name, physical_address,
                   email, website, carrier, line_type, real_existence, created_at, updated_at
            FROM check_table
            ORDER BY numeric_id ASC, id ASC
            LIMIT $1 OFFSET $2
        `;

        return await this.query(sql, [limit, offset]);
    }

    /**
     * Get check_table records with pagination
     */
    async getCheckRecords(limit = 50, offset = 0) {
        const sql = `
            SELECT id, numeric_id, phone, status,
                   company_name, physical_address,
                   email, website, carrier, line_type, real_existence, created_at, updated_at
            FROM check_table
            ORDER BY numeric_id ASC, id ASC
            LIMIT $1 OFFSET $2
        `;

        return await this.query(sql, [parseInt(limit), parseInt(offset)]);
    }

    /**
     * Get total count of check_table records
     */
    async getCheckRecordsCount() {
        const sql = 'SELECT COUNT(*) as count FROM check_table';
        const result = await this.query(sql);
        return parseInt(result[0]?.count || 0);
    }

    /**
     * Check if record exists in check_table
     */
    async checkRecordExists(id) {
        const sql = 'SELECT 1 FROM check_table WHERE id = $1 LIMIT 1';
        const result = await this.query(sql, [id]);
        return result.length > 0;
    }

    /**
     * Get total count of records in check_table for range validation
     */
    async getCheckTableCount() {
        return await this.getCheckRecordsCount();
    }

    /**
     * Check if a single ID exists in check_table
     */
    async isDuplicateId(id) {
        const sql = 'SELECT 1 FROM check_table WHERE id = $1 LIMIT 1';
        try {
            const result = await this.query(sql, [id]);
            return result.length > 0;
        } catch (error) {
            console.error('Error checking for duplicate ID:', error.message);
            throw error;
        }
    }

    /**
     * Get existing records from check_table for given IDs
     */
    async getExistingRecords(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const chunkSize = 1000;
        const existingRecords = [];

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);

            const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
            const sql = `
                SELECT id, phone, company_name, physical_address, email, website, carrier, line_type, real_existence, created_at
                FROM check_table
                WHERE id IN (${placeholders})
            `;

            try {
                const result = await this.query(sql, chunk);
                existingRecords.push(...result);
            } catch (error) {
                console.error('Error retrieving existing records:', error.message);
                throw error;
            }
        }

        return existingRecords;
    }

    /**
     * Optimized duplicate detection with indexed lookups on check_table
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
            const idsToCheck = records.map(record => record.id || record.Id).filter(id => id);

            const duplicateIds = await this.batchCheckDuplicateIds(idsToCheck);
            const duplicateIdSet = new Set(duplicateIds);

            if (duplicateIds.length > 0) {
                result.existingRecords = await this.getExistingRecords(duplicateIds);
            }

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

        const detectionTime = Date.now() - startTime;
        result.performanceMetrics.detectionTime = detectionTime;
        result.performanceMetrics.recordsPerSecond = detectionTime > 0 ? Math.round((records.length / detectionTime) * 1000) : 0;

        if (detectionTime > 5000) {
            console.warn(`Slow duplicate detection: ${detectionTime}ms for ${records.length} records`);
        }

        return result;
    }

    /**
     * Prepared query for better performance
     */
    async preparedQuery(sql, params = [], useCache = false) {
        // PostgreSQL automatically prepares queries
        return await this.query(sql, params);
    }
}

// Export singleton instance
const dbManager = new PostgresDatabaseManager();
module.exports = dbManager;
