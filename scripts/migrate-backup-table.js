#!/usr/bin/env node

/**
 * Migration script to add company information columns to backup_table
 * This script safely adds the new columns without losing existing data
 */

const databaseManager = require('../src/utils/database');

async function runMigration() {
    try {
        console.log('Starting backup_table migration...');

        // Connect to database
        await databaseManager.connect();
        console.log('Database connected successfully');

        // Check current table structure
        console.log('Checking current backup_table structure...');
        const currentColumns = await databaseManager.query('DESCRIBE backup_table');
        const columnNames = currentColumns.map(col => col.Field);

        console.log('Current columns:', columnNames.join(', '));

        // Track which columns need to be added
        const columnsToAdd = [];
        const indexesToAdd = [];

        // Check and add CompanyName column
        if (!columnNames.includes('CompanyName')) {
            columnsToAdd.push({
                name: 'CompanyName',
                sql: `ALTER TABLE backup_table
                      ADD COLUMN CompanyName VARCHAR(255) NULL
                      COMMENT 'Company name from Excel data'
                      AFTER Phone`
            });
            indexesToAdd.push('ALTER TABLE backup_table ADD INDEX idx_company_name (CompanyName)');
        }

        // Check and add PhysicalAddress column
        if (!columnNames.includes('PhysicalAddress')) {
            columnsToAdd.push({
                name: 'PhysicalAddress',
                sql: `ALTER TABLE backup_table
                      ADD COLUMN PhysicalAddress TEXT NULL
                      COMMENT 'Company physical address'
                      AFTER ${columnNames.includes('CompanyName') ? 'CompanyName' : 'Phone'}`
            });
        }

        // Check and add Email column
        if (!columnNames.includes('Email')) {
            const afterColumn = columnNames.includes('PhysicalAddress') ? 'PhysicalAddress' :
                (columnNames.includes('CompanyName') ? 'CompanyName' : 'Phone');
            columnsToAdd.push({
                name: 'Email',
                sql: `ALTER TABLE backup_table
                      ADD COLUMN Email VARCHAR(255) NULL
                      COMMENT 'Company email address'
                      AFTER ${afterColumn}`
            });
            indexesToAdd.push('ALTER TABLE backup_table ADD INDEX idx_email (Email)');
        }

        // Check and add Website column
        if (!columnNames.includes('Website')) {
            const afterColumn = columnNames.includes('Email') ? 'Email' :
                (columnNames.includes('PhysicalAddress') ? 'PhysicalAddress' :
                    (columnNames.includes('CompanyName') ? 'CompanyName' : 'Phone'));
            columnsToAdd.push({
                name: 'Website',
                sql: `ALTER TABLE backup_table
                      ADD COLUMN Website VARCHAR(255) NULL
                      COMMENT 'Company website URL'
                      AFTER ${afterColumn}`
            });
        }

        // Check and add updated_at column
        if (!columnNames.includes('updated_at')) {
            columnsToAdd.push({
                name: 'updated_at',
                sql: `ALTER TABLE backup_table
                      ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                      COMMENT 'Last update timestamp'
                      AFTER created_at`
            });
        }

        // Execute column additions
        if (columnsToAdd.length > 0) {
            console.log(`\nAdding ${columnsToAdd.length} new columns...`);

            for (const column of columnsToAdd) {
                console.log(`Adding column: ${column.name}`);
                try {
                    await databaseManager.query(column.sql);
                    console.log(`✅ Successfully added ${column.name} column`);
                } catch (error) {
                    console.error(`❌ Failed to add ${column.name} column:`, error.message);
                    throw error;
                }
            }
        } else {
            console.log('✅ All company columns already exist');
        }

        // Execute index additions
        if (indexesToAdd.length > 0) {
            console.log(`\nAdding ${indexesToAdd.length} new indexes...`);

            for (const indexSql of indexesToAdd) {
                try {
                    await databaseManager.query(indexSql);
                    console.log('✅ Successfully added index');
                } catch (error) {
                    if (error.message.includes('Duplicate key name')) {
                        console.log('⚠️  Index already exists, skipping');
                    } else {
                        console.error('❌ Failed to add index:', error.message);
                        throw error;
                    }
                }
            }
        } else {
            console.log('✅ All indexes already exist');
        }

        // Verify final table structure
        console.log('\nVerifying final table structure...');
        const finalColumns = await databaseManager.query('DESCRIBE backup_table');
        console.log('Final columns:');
        finalColumns.forEach(col => {
            console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Comment ? `- ${col.Comment}` : ''}`);
        });

        // Show table indexes
        console.log('\nTable indexes:');
        const indexes = await databaseManager.query('SHOW INDEX FROM backup_table');
        const uniqueIndexes = [...new Set(indexes.map(idx => idx.Key_name))];
        uniqueIndexes.forEach(indexName => {
            const indexColumns = indexes.filter(idx => idx.Key_name === indexName);
            const columnList = indexColumns.map(idx => idx.Column_name).join(', ');
            console.log(`  ${indexName}: (${columnList})`);
        });

        console.log('\n🎉 Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. The backup_table now supports company information storage');
        console.log('2. New Excel uploads will automatically store company data');
        console.log('3. Existing records can be updated using PUT /backup-records/:id/company-info');
        console.log('4. The check_table processing will transfer company data automatically');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        try {
            await databaseManager.close();
            console.log('Database connection closed');
        } catch (closeError) {
            console.error('Error closing database connection:', closeError);
        }
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = runMigration;
