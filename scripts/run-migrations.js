#!/usr/bin/env node

const path = require('path');
const migrationRunner = require('../src/utils/migrationRunner');
const databaseManager = require('../src/utils/database');

async function runMigrations() {
  try {
    console.log('Starting database migration process...');
    
    // Connect to database
    console.log('Connecting to database...');
    await databaseManager.connect();
    
    // Run pending migrations
    console.log('Running pending migrations...');
    await migrationRunner.runPendingMigrations();
    
    // Show final status
    await migrationRunner.getStatus();
    
    console.log('\nMigration process completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('Migration process failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };