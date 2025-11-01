/**
 * Test script to verify company data updates for duplicate records
 * This tests the new functionality where existing records get company data updated
 */

const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const ExcelProcessor = require('../src/services/excelProcessor');
const databaseManager = require('../src/utils/database');

async function testCompanyDataUpdates() {
    try {
        console.log('🧪 Testing company data updates for duplicate records...\n');

        // Create instance of ExcelProcessor
        const excelProcessor = new ExcelProcessor();

        // Connect to database
        await databaseManager.connect();
        console.log('🔌 Database connected\n');

        // Step 1: Create and upload initial Excel file
        console.log('📊 Step 1: Creating initial Excel file with basic data...');
        const initialData = [
            {
                'Phone': '88881111',
                'Company Name': 'Initial Company A',
                'Email': 'initial-a@company.sg'
            },
            {
                'Phone': '88882222',
                'Company Name': 'Initial Company B',
                'Address': 'Initial Address B'
            },
            {
                'Phone': '88883333',
                'Website': 'https://initial-c.sg'
            }
        ];

        const initialWorkbook = XLSX.utils.book_new();
        const initialWorksheet = XLSX.utils.json_to_sheet(initialData);
        XLSX.utils.book_append_sheet(initialWorkbook, initialWorksheet, 'Initial Data');

        const initialFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'initial-company-data.xlsx');
        XLSX.writeFile(initialWorkbook, initialFilePath);
        console.log(`✅ Initial Excel file created: ${initialFilePath}`);

        // Process initial file
        const initialFileBuffer = await fs.readFile(initialFilePath);
        const initialPhoneRecords = await excelProcessor.extractData(initialFileBuffer);
        const initialResults = await excelProcessor.storeToBackupTable(
            initialPhoneRecords,
            'initial-company-data.xlsx',
            { test: 'initial_upload' }
        );

        console.log(`✅ Initial upload: ${initialResults.storedRecords} records stored\n`);

        // Step 2: Check initial records
        console.log('📋 Step 2: Checking initial backup_table records...');
        const initialRecords = await databaseManager.query(
            'SELECT * FROM backup_table WHERE Phone IN (?, ?, ?) ORDER BY Phone',
            ['88881111', '88882222', '88883333']
        );

        console.log('Initial records:');
        initialRecords.forEach((record, index) => {
            console.log(`  Record ${index + 1}: Phone=${record.Phone}, Company=${record.CompanyName || 'NULL'}, Email=${record.Email || 'NULL'}, Address=${record.PhysicalAddress || 'NULL'}, Website=${record.Website || 'NULL'}`);
        });
        console.log('');

        // Step 3: Create updated Excel file with same phones but different company data
        console.log('📊 Step 3: Creating updated Excel file with enhanced company data...');
        const updatedData = [
            {
                'Phone': '88881111', // Same phone
                'Company Name': 'Updated Company A Ltd', // Updated company name
                'Email': 'updated-a@company.sg', // Updated email
                'Address': 'New Address A, Singapore 123456', // New address
                'Website': 'https://updated-a.company.sg' // New website
            },
            {
                'Phone': '88882222', // Same phone
                'Company Name': 'Updated Company B Pte Ltd', // Updated company name
                'Address': 'Updated Address B, Singapore 234567', // Updated address
                'Email': 'updated-b@company.sg', // New email
                'Website': 'https://updated-b.company.sg' // New website
            },
            {
                'Phone': '88883333', // Same phone
                'Company Name': 'Updated Company C', // New company name
                'Address': 'New Address C, Singapore 345678', // New address
                'Email': 'updated-c@company.sg', // New email
                'Website': 'https://updated-c.company.sg' // Updated website
            }
        ];

        const updatedWorkbook = XLSX.utils.book_new();
        const updatedWorksheet = XLSX.utils.json_to_sheet(updatedData);
        XLSX.utils.book_append_sheet(updatedWorkbook, updatedWorksheet, 'Updated Data');

        const updatedFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'updated-company-data.xlsx');
        XLSX.writeFile(updatedWorkbook, updatedFilePath);
        console.log(`✅ Updated Excel file created: ${updatedFilePath}`);

        // Process updated file
        const updatedFileBuffer = await fs.readFile(updatedFilePath);
        const updatedPhoneRecords = await excelProcessor.extractData(updatedFileBuffer);
        const updateResults = await excelProcessor.storeToBackupTable(
            updatedPhoneRecords,
            'updated-company-data.xlsx',
            { test: 'update_upload' }
        );

        console.log('Update results:', JSON.stringify(updateResults, null, 2));
        console.log(`✅ Update upload: ${updateResults.storedRecords} new records, ${updateResults.duplicatesSkipped} duplicates, ${updateResults.updatedRecords || 0} company data updated\n`);

        // Step 4: Check final records to verify updates
        console.log('📋 Step 4: Checking final backup_table records after update...');
        const finalRecords = await databaseManager.query(
            'SELECT * FROM backup_table WHERE Phone IN (?, ?, ?) ORDER BY Phone',
            ['88881111', '88882222', '88883333']
        );

        console.log('Final records (after update):');
        finalRecords.forEach((record, index) => {
            console.log(`  Record ${index + 1}:`);
            console.log(`    Phone: ${record.Phone}`);
            console.log(`    Company: ${record.CompanyName || 'NULL'}`);
            console.log(`    Email: ${record.Email || 'NULL'}`);
            console.log(`    Address: ${record.PhysicalAddress || 'NULL'}`);
            console.log(`    Website: ${record.Website || 'NULL'}`);
            console.log(`    Updated: ${record.updated_at}`);
            console.log('');
        });

        // Step 5: Verify specific updates
        console.log('📋 Step 5: Verifying specific company data updates...');
        let successCount = 0;

        for (let i = 0; i < finalRecords.length; i++) {
            const final = finalRecords[i];
            const initial = initialRecords[i];
            const expected = updatedData[i];

            const companyUpdated = final.CompanyName === expected['Company Name'];
            const emailUpdated = final.Email === expected['Email'];
            const addressUpdated = final.PhysicalAddress === expected['Address'];
            const websiteUpdated = final.Website === expected['Website'];

            console.log(`Record ${i + 1} (Phone: ${final.Phone}):`);
            console.log(`  Company: ${companyUpdated ? '✅' : '❌'} (${initial.CompanyName || 'NULL'} → ${final.CompanyName || 'NULL'})`);
            console.log(`  Email: ${emailUpdated ? '✅' : '❌'} (${initial.Email || 'NULL'} → ${final.Email || 'NULL'})`);
            console.log(`  Address: ${addressUpdated ? '✅' : '❌'} (${initial.PhysicalAddress || 'NULL'} → ${final.PhysicalAddress || 'NULL'})`);
            console.log(`  Website: ${websiteUpdated ? '✅' : '❌'} (${initial.Website || 'NULL'} → ${final.Website || 'NULL'})`);

            if (companyUpdated && emailUpdated && addressUpdated && websiteUpdated) {
                successCount++;
            }
            console.log('');
        }

        // Cleanup test files
        try {
            await fs.unlink(initialFilePath);
            await fs.unlink(updatedFilePath);
            console.log('🧹 Cleaned up test files');
        } catch (error) {
            console.log('⚠️  Could not clean up test files:', error.message);
        }

        // Final results
        console.log('\n🎉 Test Results:');
        console.log(`✅ ${successCount}/${finalRecords.length} records had company data successfully updated`);

        if (successCount === finalRecords.length) {
            console.log('🎉 ALL TESTS PASSED! Company data update functionality is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please check the implementation.');
        }

        // Cleanup test data
        await databaseManager.query(
            'DELETE FROM backup_table WHERE Phone IN (?, ?, ?)',
            ['88881111', '88882222', '88883333']
        );
        console.log('🧹 Cleaned up test data from database');

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
    testCompanyDataUpdates()
        .then(() => {
            console.log('\nCompany data update test completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\nCompany data update test failed:', error);
            process.exit(1);
        });
}

module.exports = testCompanyDataUpdates;
