#!/usr/bin/env node

/**
 * Startup wrapper script
 * 1. Initialize PostgreSQL database (if env vars available)
 * 2. Start the Express server
 */

const { spawn } = require('child_process');
const path = require('path');

async function initDatabase() {
    console.log('🔍 Checking if database initialization is needed...');

    // Explicit opt-in only: run DB init on boot when DB_INIT_ON_BOOT=true
    const shouldInit = process.env.DB_INIT_ON_BOOT === 'true';
    if (!shouldInit) {
        console.log('⏭️  Skipping database initialization on boot.');
        console.log('    Set DB_INIT_ON_BOOT=true to enable (use with care, especially in production).');
        return false;
    }

    // Check if database environment variables are available
    if (!process.env.DB_HOST) {
        console.log('⚠️  Database environment variables not set. Skipping initialization.');
        console.log('   This is normal during local development.');
        return false;
    }

    console.log('✅ Database environment variables detected.');

    try {
        const initScript = path.join(__dirname, 'init-postgres.js');

        return new Promise((resolve, reject) => {
            const child = spawn('node', [initScript], {
                stdio: 'inherit',
                env: process.env
            });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Database initialization completed successfully');
                    resolve(true);
                } else {
                    console.error(`❌ Database initialization failed with code ${code}`);
                    // Don't reject - allow server to start anyway
                    resolve(false);
                }
            });

            child.on('error', (err) => {
                console.error('❌ Failed to run database initialization:', err);
                resolve(false);
            });
        });
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        return false;
    }
}

async function startServer() {
    console.log('🚀 Starting Express server...');

    const serverScript = path.join(__dirname, '../src/server.js');

    const server = spawn('node', [serverScript], {
        stdio: 'inherit',
        env: process.env
    });

    server.on('error', (err) => {
        console.error('❌ Server error:', err);
        process.exit(1);
    });

    server.on('close', (code) => {
        console.log(`Server exited with code ${code}`);
        process.exit(code || 0);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully...');
        server.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully...');
        server.kill('SIGINT');
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  App Startup - Singapore Phone Validator');
    console.log('═══════════════════════════════════════════════════════');

    // Initialize database (if env vars available)
    await initDatabase();

    // Start server
    await startServer();
}

main().catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
});
