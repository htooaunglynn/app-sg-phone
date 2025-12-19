#!/usr/bin/env node

/**
 * Startup wrapper script
 * 1. Initialize PostgreSQL database (if env vars available)
 * 2. Start the Express server
 */

const { spawn } = require('child_process');
const path = require('path');

// logging removed

async function initDatabase() {


    // Explicit opt-in only: run DB init on boot when DB_INIT_ON_BOOT=true
    const shouldInit = process.env.DB_INIT_ON_BOOT === 'true';
    if (!shouldInit) {
        return false;
    }

    // Check if database environment variables are available
    if (!process.env.DB_HOST) {
        return false;
    }



    try {
        const initScript = path.join(__dirname, 'init-postgres.js');

        return new Promise((resolve, reject) => {
            const child = spawn('node', [initScript], {
                stdio: 'inherit',
                env: process.env
            });

            child.on('close', (code) => {
                if (code === 0) {

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
        process.exit(code || 0);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
        server.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
        server.kill('SIGINT');
    });
}

async function main() {


    // Initialize database (if env vars available)
    await initDatabase();

    // Start server
    await startServer();
}

main().catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
});
