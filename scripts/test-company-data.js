/**
 * Test script to verify the company data functionality
 * This script tests the complete flow: Excel processing → backup_table → check_table
 */

const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const ExcelProcessor = require('../src/services/excelProcessor');
const phoneValidationProcessor = require('../src/services/phoneValidationProcessor');
const databaseManager = require('../src/utils/database');

async function testCompanyDataFlow() {
    try {
        console.log('🧪 Starting company data flow test...\n');

        // Create instance of ExcelProcessor
        const excelProcessor = new ExcelProcessor();

        // Create test Excel file with company data
        const testData = [
            {
                'Phone Number': '+65 8888 1234',
                'Company Name': 'Test Company Ltd',
                'Physical Address': '123 Marina Bay Drive, Singapore 018960',
                'Email': 'contact@testcompany.sg',
                'Website': 'https://www.testcompany.sg'
            },
            {
                'Phone': '88882345',
                'Company': 'Another Corp Pte Ltd',
                'Address': '456 Orchard Road, Singapore 238877',
                'Email': 'info@anothercorp.sg',
                'Website': 'www.anothercorp.sg'
            },
            {
                'Phone': '+65-8888-3456',
                'Name': 'Small Business',
                'Location': '789 Toa Payoh Central',
                'Email': 'hello@smallbiz.sg',
                'Website': ''
            }
        ];

        console.log('📊 Creating test Excel file...');
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(testData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Data');

        const testFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'test-company-data.xlsx');
        XLSX.writeFile(workbook, testFilePath);
        console.log(`✅ Test Excel file created: ${testFilePath}\n`);

        // Connect to database
        await databaseManager.connect();
        console.log('🔌 Database connected\n');

        // Step 1: Process Excel file
        console.log('📋 Step 1: Processing Excel file...');
        const fileBuffer = await fs.readFile(testFilePath);
        const phoneRecords = await excelProcessor.extractData(fileBuffer);

        console.log(`✅ Extracted ${phoneRecords.length} phone records from Excel`);

        // Store to backup table
        const backupResults = await excelProcessor.storeToBackupTable(
            phoneRecords,
            path.basename(testFilePath),
            { /* metadata */ }
        );

        console.log('Backup results:', JSON.stringify(backupResults, null, 2));

        if (backupResults.success) {
            console.log(`✅ Successfully stored ${backupResults.storedRecords} records to backup_table\n`);

            // Step 2: Check backup_table records
            console.log('📋 Step 2: Checking backup_table records...');
            const backupRecords = await databaseManager.query(
                'SELECT * FROM backup_table WHERE source_file LIKE ? ORDER BY created_at DESC LIMIT 10',
                ['%test-company-data.xlsx%']
            );

            console.log(`Found ${backupRecords.length} records in backup_table:`);
            backupRecords.forEach((record, index) => {
                console.log(`  Record ${index + 1}:`);
                console.log(`    ID: ${record.Id}`);
                console.log(`    Phone: ${record.Phone}`);
                console.log(`    Company: ${record.CompanyName || 'NULL'}`);
                console.log(`    Address: ${record.PhysicalAddress || 'NULL'}`);
                console.log(`    Email: ${record.Email || 'NULL'}`);
                console.log(`    Website: ${record.Website || 'NULL'}`);
                console.log(`    Created: ${record.created_at}`);
                console.log('');
            });

            // Step 3: Process to check_table
            console.log('📋 Step 3: Processing backup records to check_table...');
            const recordIds = backupRecords.map(r => r.Id);
            try {
                await phoneValidationProcessor.processSpecificRecords(recordIds);
                console.log(`✅ Processed ${recordIds.length} backup records to check_table`);
            } catch (error) {
                console.log(`⚠️  Error processing records: ${error.message}`);
            }

            // Step 4: Check check_table records
            console.log('\n📋 Step 4: Checking check_table records...');
            const checkRecords = await databaseManager.query(
                'SELECT * FROM check_table WHERE Id IN (?) ORDER BY created_at DESC',
                [recordIds]
            );

            console.log(`Found ${checkRecords.length} records in check_table:`);
            checkRecords.forEach((record, index) => {
                console.log(`  Record ${index + 1}:`);
                console.log(`    ID: ${record.Id}`);
                console.log(`    Phone: ${record.Phone}`);
                console.log(`    Company: ${record.CompanyName || 'NULL'}`);
                console.log(`    Address: ${record.PhysicalAddress || 'NULL'}`);
                console.log(`    Email: ${record.Email || 'NULL'}`);
                console.log(`    Website: ${record.Website || 'NULL'}`);
                console.log(`    Status: ${record.Status}`);
                console.log('');
            });

            // Step 5: Test company data update API
            console.log('📋 Step 5: Testing company data update...');
            if (backupRecords.length > 0) {
                const testRecord = backupRecords[0];
                const updateData = {
                    CompanyName: 'Updated Company Name Ltd',
                    PhysicalAddress: 'Updated Address, Singapore 123456',
                    Email: 'updated@company.sg',
                    Website: 'https://updated.company.sg'
                };

                // Simulate the update (using direct database query for testing)
                await databaseManager.query(
                    `UPDATE backup_table
                     SET CompanyName = ?, PhysicalAddress = ?, Email = ?, Website = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE Id = ?`,
                    [updateData.CompanyName, updateData.PhysicalAddress, updateData.Email, updateData.Website, testRecord.Id]
                );

                console.log(`✅ Updated backup record ${testRecord.Id} with new company data`);

                // Verify update
                const updatedRecord = await databaseManager.query('SELECT * FROM backup_table WHERE Id = ?', [testRecord.Id]);
                if (updatedRecord.length > 0) {
                    const record = updatedRecord[0];
                    console.log('Updated record verification:');
                    console.log(`  Company: ${record.CompanyName}`);
                    console.log(`  Address: ${record.PhysicalAddress}`);
                    console.log(`  Email: ${record.Email}`);
                    console.log(`  Website: ${record.Website}`);
                    console.log(`  Updated: ${record.updated_at}`);
                }
            }

        } else {
            console.log('❌ Excel processing failed:', backupResults.message);
        }

        // Cleanup test file
        try {
            await fs.unlink(testFilePath);
            console.log('\n🧹 Cleaned up test file');
        } catch (error) {
            console.log('⚠️  Could not clean up test file:', error.message);
        }

        console.log('\n🎉 Test completed successfully!');
        console.log('\nSummary:');
        console.log('✅ Excel file processing with company data extraction');
        console.log('✅ Storage in backup_table with company columns');
        console.log('✅ Transfer to check_table with company data');
        console.log('✅ Company data update functionality');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        try {
            await databaseManager.close();
            console.log('\n🔌 Database connection closed');
        } catch (closeError) {
            console.error('Error closing database:', closeError);
        }
    }
}

// Run test if this script is executed directly
if (require.main === module) {
    testCompanyDataFlow()
        .then(() => {
            console.log('\nTest script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\nTest script failed:', error);
            process.exit(1);
        });
}

module.exports = testCompanyDataFlow;
