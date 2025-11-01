/**
 * Test script to verify company data updates flow from backup_table to check_table
 */

const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const ExcelProcessor = require('../src/services/excelProcessor');
const phoneValidationProcessor = require('../src/services/phoneValidationProcessor');
const databaseManager = require('../src/utils/database');

async function testBackupToCheckTableFlow() {
    try {
        console.log('🧪 Testing backup_table → check_table company data flow...\n');

        const excelProcessor = new ExcelProcessor();
        await databaseManager.connect();

        // Step 1: Create and upload initial Excel file
        console.log('📊 Step 1: Creating initial Excel file...');
        const initialData = [
            {
                'Phone': '81119999',
                'Company Name': 'Initial Flow Company',
                'Email': 'initial-flow@company.sg',
                'Address': 'Initial Flow Address'
            }
        ];

        const initialWorkbook = XLSX.utils.book_new();
        const initialWorksheet = XLSX.utils.json_to_sheet(initialData);
        XLSX.utils.book_append_sheet(initialWorkbook, initialWorksheet, 'Initial Flow');

        const initialFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'initial-flow.xlsx');
        XLSX.writeFile(initialWorkbook, initialFilePath);

        // Process initial file
        const initialFileBuffer = await fs.readFile(initialFilePath);
        const initialPhoneRecords = await excelProcessor.extractData(initialFileBuffer);
        await excelProcessor.storeToBackupTable(initialPhoneRecords, 'initial-flow.xlsx');

        console.log('✅ Initial file processed and stored in backup_table');

        // Step 2: Process backup_table to check_table
        console.log('\n📋 Step 2: Processing backup_table → check_table...');
        await phoneValidationProcessor.processSpecificRecords(['81119999']);
        console.log('✅ Record processed to check_table');

        // Step 3: Check initial state in both tables
        console.log('\n📋 Step 3: Checking initial state...');
        const initialBackupRecord = await databaseManager.query('SELECT * FROM backup_table WHERE Id = ?', ['81119999']);
        const initialCheckRecord = await databaseManager.query('SELECT * FROM check_table WHERE Id = ?', ['81119999']);

        console.log('Initial backup_table record:');
        console.log(`  Company: ${initialBackupRecord[0]?.CompanyName || 'NULL'}`);
        console.log(`  Email: ${initialBackupRecord[0]?.Email || 'NULL'}`);
        console.log(`  Address: ${initialBackupRecord[0]?.PhysicalAddress || 'NULL'}`);

        console.log('Initial check_table record:');
        console.log(`  Company: ${initialCheckRecord[0]?.CompanyName || 'NULL'}`);
        console.log(`  Email: ${initialCheckRecord[0]?.Email || 'NULL'}`);
        console.log(`  Address: ${initialCheckRecord[0]?.PhysicalAddress || 'NULL'}`);

        // Step 4: Create updated Excel file with same phone but different company data
        console.log('\n📊 Step 4: Creating updated Excel file...');
        const updatedData = [
            {
                'Phone': '81119999', // Same phone number
                'Company Name': 'Updated Flow Company Ltd',
                'Email': 'updated-flow@company.sg',
                'Address': 'Updated Flow Address, Singapore 456789',
                'Website': 'https://updated-flow.sg'
            }
        ];

        const updatedWorkbook = XLSX.utils.book_new();
        const updatedWorksheet = XLSX.utils.json_to_sheet(updatedData);
        XLSX.utils.book_append_sheet(updatedWorkbook, updatedWorksheet, 'Updated Flow');

        const updatedFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'updated-flow.xlsx');
        XLSX.writeFile(updatedWorkbook, updatedFilePath);

        // Process updated file (this should update backup_table)
        const updatedFileBuffer = await fs.readFile(updatedFilePath);
        const updatedPhoneRecords = await excelProcessor.extractData(updatedFileBuffer);
        const updateResult = await excelProcessor.storeToBackupTable(updatedPhoneRecords, 'updated-flow.xlsx');

        console.log(`✅ Updated file processed: ${updateResult.updatedRecords} records updated in backup_table`);

        // Step 5: Process backup_table to check_table again (should update check_table)
        console.log('\n📋 Step 5: Processing updated backup_table → check_table...');
        await phoneValidationProcessor.processSpecificRecords(['81119999']);
        console.log('✅ Updated record processed to check_table');

        // Step 6: Check final state in both tables
        console.log('\n📋 Step 6: Checking final state...');
        const finalBackupRecord = await databaseManager.query('SELECT * FROM backup_table WHERE Id = ?', ['81119999']);
        const finalCheckRecord = await databaseManager.query('SELECT * FROM check_table WHERE Id = ?', ['81119999']);

        console.log('Final backup_table record:');
        console.log(`  Company: ${finalBackupRecord[0]?.CompanyName || 'NULL'}`);
        console.log(`  Email: ${finalBackupRecord[0]?.Email || 'NULL'}`);
        console.log(`  Address: ${finalBackupRecord[0]?.PhysicalAddress || 'NULL'}`);
        console.log(`  Website: ${finalBackupRecord[0]?.Website || 'NULL'}`);

        console.log('Final check_table record:');
        console.log(`  Company: ${finalCheckRecord[0]?.CompanyName || 'NULL'}`);
        console.log(`  Email: ${finalCheckRecord[0]?.Email || 'NULL'}`);
        console.log(`  Address: ${finalCheckRecord[0]?.PhysicalAddress || 'NULL'}`);
        console.log(`  Website: ${finalCheckRecord[0]?.Website || 'NULL'}`);

        // Step 7: Verify the flow worked
        console.log('\n📋 Step 7: Verifying data flow...');
        const backupCompany = finalBackupRecord[0]?.CompanyName;
        const checkCompany = finalCheckRecord[0]?.CompanyName;
        const backupEmail = finalBackupRecord[0]?.Email;
        const checkEmail = finalCheckRecord[0]?.Email;
        const backupWebsite = finalBackupRecord[0]?.Website;
        const checkWebsite = finalCheckRecord[0]?.Website;

        const companyMatches = backupCompany === checkCompany;
        const emailMatches = backupEmail === checkEmail;
        const websiteMatches = backupWebsite === checkWebsite;

        console.log(`Company data sync: ${companyMatches ? '✅' : '❌'} (${backupCompany} → ${checkCompany})`);
        console.log(`Email data sync: ${emailMatches ? '✅' : '❌'} (${backupEmail} → ${checkEmail})`);
        console.log(`Website data sync: ${websiteMatches ? '✅' : '❌'} (${backupWebsite} → ${checkWebsite})`);

        const allMatches = companyMatches && emailMatches && websiteMatches;

        // Cleanup
        await fs.unlink(initialFilePath);
        await fs.unlink(updatedFilePath);
        await databaseManager.query('DELETE FROM backup_table WHERE Id = ?', ['81119999']);
        await databaseManager.query('DELETE FROM check_table WHERE Id = ?', ['81119999']);

        console.log('\n🎉 Test Results:');
        if (allMatches) {
            console.log('✅ SUCCESS: Company data flows correctly from backup_table to check_table!');
            console.log('✅ Updates in backup_table are now reflected in check_table!');
        } else {
            console.log('❌ FAILURE: Company data is not syncing properly between tables.');
            console.log('❌ check_table updates may not be working correctly.');
        }

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
    testBackupToCheckTableFlow()
        .then(() => {
            console.log('\nBackup to check table flow test completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('\nBackup to check table flow test failed:', error);
            process.exit(1);
        });
}

module.exports = testBackupToCheckTableFlow;
