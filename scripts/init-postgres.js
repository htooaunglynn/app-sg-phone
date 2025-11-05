#!/usr/bin/env node

/**
 * PostgreSQL Database Initialization Script
 * Automatically runs schema on deployment or manual trigger
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    console.log('🚀 Starting PostgreSQL database initialization...');

    // Database connection configuration from environment variables
    const dbConfig = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: false
        } : false
    };

    // Validate required environment variables
    if (!dbConfig.host || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
        console.error('❌ Missing required database environment variables:');
        console.error('   DB_HOST:', dbConfig.host ? '✓' : '✗');
        console.error('   DB_NAME:', dbConfig.database ? '✓' : '✗');
        console.error('   DB_USER:', dbConfig.user ? '✓' : '✗');
        console.error('   DB_PASSWORD:', dbConfig.password ? '✓' : '✗');
        process.exit(1);
    }

    const client = new Client(dbConfig);

    try {
        // Connect to database
        console.log(`📡 Connecting to PostgreSQL at ${dbConfig.host}...`);
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Read schema file
        const schemaPath = path.join(__dirname, '../schema-postgres.sql');
        console.log(`📄 Reading schema from: ${schemaPath}`);

        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('⚙️  Executing schema...');
        await client.query(schema);
        console.log('✅ Schema executed successfully');

        // Verify tables were created
        console.log('🔍 Verifying tables...');
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const tables = tablesResult.rows.map(row => row.table_name);
        console.log('✅ Tables found:', tables.join(', '));

        // Verify expected tables
        const expectedTables = ['users', 'user_logins', 'check_table'];
        const missingTables = expectedTables.filter(table => !tables.includes(table));

        if (missingTables.length > 0) {
            console.warn('⚠️  Warning: Some expected tables are missing:', missingTables.join(', '));
        } else {
            console.log('✅ All expected tables created successfully');
        }

        // Get table counts
        for (const table of tables) {
            try {
                const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
                console.log(`   ${table}: ${countResult.rows[0].count} rows`);
            } catch (err) {
                console.warn(`   Could not count rows in ${table}:`, err.message);
            }
        }

        console.log('✅ Database initialization completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Database initialization failed:');
        console.error(error);
        process.exit(1);

    } finally {
        await client.end();
        console.log('📡 Database connection closed');
    }
}

// Run initialization
initializeDatabase();
