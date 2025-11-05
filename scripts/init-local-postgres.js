#!/usr/bin/env node

/**
 * Initialize local PostgreSQL database
 * Run this script to set up your local PostgreSQL database for development
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
    console.log('🔧 Initializing PostgreSQL database...\n');

    // First, connect without database to create it
    const adminClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: 'postgres' // Connect to default database first
    });

    try {
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL');

        // Create database if it doesn't exist
        const dbName = process.env.DB_NAME || 'singapore_phone_db';

        try {
            await adminClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Created database: ${dbName}`);
        } catch (error) {
            if (error.code === '42P04') {
                console.log(`ℹ️  Database ${dbName} already exists`);
            } else {
                throw error;
            }
        }

        await adminClient.end();

        // Now connect to the new database and create tables
        const client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: dbName
        });

        await client.connect();
        console.log(`✅ Connected to database: ${dbName}`);

        // Read and execute schema
        const schemaPath = path.join(__dirname, '..', 'schema-postgres.sql');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log(`\n📝 Executing SQL schema...`);

        // Execute the entire schema as one query
        // PostgreSQL can handle multiple statements in a single query
        try {
            await client.query(schema);
            console.log('✅ Schema executed successfully');
        } catch (error) {
            console.error('❌ Error executing schema:', error.message);
            throw error;
        }

        // Verify tables were created
        const tables = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\n✅ Database initialized successfully!');
        console.log('\n📊 Tables created:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        await client.end();

        console.log('\n🎉 PostgreSQL database is ready!');
        console.log('\nYou can now run: npm run dev\n');

    } catch (error) {
        console.error('\n❌ Failed to initialize database:', error.message);
        console.error('\nMake sure:');
        console.error('  1. PostgreSQL is installed and running');
        console.error('  2. Your .env file has correct DB credentials');
        console.error('  3. You can connect to PostgreSQL with these credentials\n');
        process.exit(1);
    }
}

// Run initialization
initializeDatabase();
