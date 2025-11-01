/**
 * Debug script to check record structure for company data updates
 */

const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const ExcelProcessor = require('../src/services/excelProcessor');
const databaseManager = require('../src/utils/database');

async function debugRecordStructure() {
    try {
        console.log('🔍 Debugging record structure for company data...\n');

        const excelProcessor = new ExcelProcessor();
        await databaseManager.connect();

        // Create test data
        const testData = [
            {
                'Phone': '88889999',
                'Company Name': 'Debug Company',
                'Email': 'debug@company.sg',
                'Address': 'Debug Address',
                'Website': 'https://debug.sg'
            }
        ];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(testData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Debug Data');

        const testFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'debug-data.xlsx');
        XLSX.writeFile(workbook, testFilePath);

        // Extract data and examine structure
        const fileBuffer = await fs.readFile(testFilePath);
        const phoneRecords = await excelProcessor.extractData(fileBuffer);

        console.log('📋 Extracted phone records structure:');
        phoneRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`, JSON.stringify(record, null, 2));
        });

        // Store initial record
        await excelProcessor.storeToBackupTable(phoneRecords, 'debug-data.xlsx');

        // Now create updated data
        const updatedData = [
            {
                'Phone': '88889999', // Same phone
                'Company Name': 'Updated Debug Company',
                'Email': 'updated-debug@company.sg',
                'Address': 'Updated Debug Address',
                'Website': 'https://updated-debug.sg'
            }
        ];

        const updatedWorkbook = XLSX.utils.book_new();
        const updatedWorksheet = XLSX.utils.json_to_sheet(updatedData);
        XLSX.utils.book_append_sheet(updatedWorkbook, updatedWorksheet, 'Updated Debug Data');

        const updatedFilePath = path.join(__dirname, '..', 'uploads', 'temp', 'updated-debug-data.xlsx');
        XLSX.writeFile(updatedWorkbook, updatedFilePath);

        // Extract updated data and examine structure
        const updatedFileBuffer = await fs.readFile(updatedFilePath);
        const updatedPhoneRecords = await excelProcessor.extractData(updatedFileBuffer);

        console.log('\n📋 Updated phone records structure:');
        updatedPhoneRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`, JSON.stringify(record, null, 2));
        });

        // Try to update
        console.log('\n🔄 Attempting to update...');
        const updateResult = await excelProcessor.storeToBackupTable(updatedPhoneRecords, 'updated-debug-data.xlsx');
        console.log('Update result:', JSON.stringify(updateResult, null, 2));

        // Check final state
        const finalRecord = await databaseManager.query('SELECT * FROM backup_table WHERE Phone = ?', ['88889999']);
        console.log('\n📋 Final database record:');
        console.log(JSON.stringify(finalRecord[0], null, 2));

        // Cleanup
        await fs.unlink(testFilePath);
        await fs.unlink(updatedFilePath);
        await databaseManager.query('DELETE FROM backup_table WHERE Phone = ?', ['88889999']);

    } catch (error) {
        console.error('Debug failed:', error);
    } finally {
        await databaseManager.close();
    }
}

debugRecordStructure();
