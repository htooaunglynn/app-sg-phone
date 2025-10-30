const databaseManager = require('./database');
const path = require('path');
const fs = require('fs');

/**
 * Database Migration Runner
 * Manages database schema migrations for the Singapore Phone Detect application
 */
class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.migrationTableName = 'schema_migrations';
  }

  /**
   * Initialize the migration system by creating the migrations tracking table
   */
  async initialize() {
    console.log('Initializing migration system...');
    
    try {
      // Create migrations tracking table
      await databaseManager.query(`
        CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_migration_name (migration_name),
          INDEX idx_applied_at (applied_at)
        ) ENGINE=InnoDB 
          DEFAULT CHARSET=utf8mb4 
          COLLATE=utf8mb4_unicode_ci
          COMMENT='Tracks applied database migrations'
      `);
      
      console.log('Migration system initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize migration system:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available migration files
   */
  async getAvailableMigrations() {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        console.log('Migrations directory does not exist, creating...');
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        return [];
      }

      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.js'))
        .sort(); // Ensure migrations run in order

      const migrations = [];
      for (const file of files) {
        const migrationPath = path.join(this.migrationsPath, file);
        const MigrationClass = require(migrationPath);
        const migration = new MigrationClass();
        
        migrations.push({
          filename: file,
          name: migration.migrationName,
          description: migration.description,
          instance: migration
        });
      }

      return migrations;
      
    } catch (error) {
      console.error('Error loading migrations:', error.message);
      throw error;
    }
  }

  /**
   * Get list of applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const result = await databaseManager.query(`
        SELECT migration_name, description, applied_at 
        FROM ${this.migrationTableName} 
        ORDER BY applied_at
      `);
      
      return result;
      
    } catch (error) {
      console.error('Error getting applied migrations:', error.message);
      throw error;
    }
  }

  /**
   * Get pending migrations that need to be applied
   */
  async getPendingMigrations() {
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedNames = appliedMigrations.map(m => m.migration_name);

    return availableMigrations.filter(migration => 
      !appliedNames.includes(migration.name)
    );
  }

  /**
   * Run a specific migration
   */
  async runMigration(migration) {
    console.log(`\n=== Running Migration: ${migration.name} ===`);
    console.log(`Description: ${migration.description}`);
    
    try {
      // Check if already applied
      const isApplied = await this.isMigrationApplied(migration.name);
      if (isApplied) {
        console.log(`Migration ${migration.name} is already applied, skipping...`);
        return true;
      }

      // Run the migration
      await migration.instance.up();
      
      // Record the migration as applied
      await databaseManager.query(`
        INSERT INTO ${this.migrationTableName} (migration_name, description) 
        VALUES (?, ?)
      `, [migration.name, migration.description]);
      
      console.log(`Migration ${migration.name} completed successfully`);
      return true;
      
    } catch (error) {
      console.error(`Migration ${migration.name} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    console.log('\n=== Running Database Migrations ===');
    
    try {
      await this.initialize();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations to run');
        return true;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);
      
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }
      
      console.log('\n=== All migrations completed successfully ===');
      return true;
      
    } catch (error) {
      console.error('Migration process failed:', error.message);
      throw error;
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(migrationName) {
    console.log(`\n=== Rolling back Migration: ${migrationName} ===`);
    
    try {
      const availableMigrations = await this.getAvailableMigrations();
      const migration = availableMigrations.find(m => m.name === migrationName);
      
      if (!migration) {
        throw new Error(`Migration ${migrationName} not found`);
      }

      // Check if migration is applied
      const isApplied = await this.isMigrationApplied(migrationName);
      if (!isApplied) {
        console.log(`Migration ${migrationName} is not applied, nothing to rollback`);
        return true;
      }

      // Run the rollback
      await migration.instance.down();
      
      // Remove the migration record
      await databaseManager.query(`
        DELETE FROM ${this.migrationTableName} 
        WHERE migration_name = ?
      `, [migrationName]);
      
      console.log(`Migration ${migrationName} rolled back successfully`);
      return true;
      
    } catch (error) {
      console.error(`Migration rollback failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a migration has been applied
   */
  async isMigrationApplied(migrationName) {
    try {
      const result = await databaseManager.query(`
        SELECT 1 FROM ${this.migrationTableName} 
        WHERE migration_name = ? 
        LIMIT 1
      `, [migrationName]);
      
      return result.length > 0;
      
    } catch (error) {
      // If table doesn't exist, migration is not applied
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get migration status report
   */
  async getStatus() {
    try {
      await this.initialize();
      
      const availableMigrations = await this.getAvailableMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = await this.getPendingMigrations();
      
      console.log('\n=== Migration Status ===');
      console.log(`Available migrations: ${availableMigrations.length}`);
      console.log(`Applied migrations: ${appliedMigrations.length}`);
      console.log(`Pending migrations: ${pendingMigrations.length}`);
      
      if (appliedMigrations.length > 0) {
        console.log('\nApplied Migrations:');
        appliedMigrations.forEach(migration => {
          console.log(`  ✓ ${migration.migration_name} (${migration.applied_at})`);
        });
      }
      
      if (pendingMigrations.length > 0) {
        console.log('\nPending Migrations:');
        pendingMigrations.forEach(migration => {
          console.log(`  ○ ${migration.name} - ${migration.description}`);
        });
      }
      
      return {
        available: availableMigrations.length,
        applied: appliedMigrations.length,
        pending: pendingMigrations.length,
        appliedMigrations,
        pendingMigrations
      };
      
    } catch (error) {
      console.error('Error getting migration status:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
const migrationRunner = new MigrationRunner();
module.exports = migrationRunner;