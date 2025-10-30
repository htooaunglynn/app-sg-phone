/**
 * Test Excel Export Styling with Real File Output
 * This test creates an actual Excel file to verify styling is working
 */

const fs = require('fs');
const path = require('path');
const ExcelExporter = require('./src/services/excelExporter');

async function testRealExcelExport() {
    console.log('=== Real Excel Export Test ===\n');

    const exporter = new ExcelExporter();

    // Sample data with both true and false status values
    const sampleRecords = [
        {
            Id: 1,
            Phone: '+65 1234 5678',
            CompanyName: 'Valid Singapore Company',
            PhysicalAddress: '123 Valid Street, Singapore 123456',
            Email: 'valid@company.com',
            Website: 'www.validcompany.com',
            Status: true
        },
        {
            Id: 2,
            Phone: '+1 555 1234',
            CompanyName: 'Invalid Non-SG Company',
            PhysicalAddress: '456 Invalid Street, USA',
            Email: 'invalid@company.com',
            Website: 'www.invalidcompany.com',
            Status: false
        },
        {
            Id: 3,
            Phone: '+65 9876 5432',
            CompanyName: 'Another Valid SG Company',
            PhysicalAddress: '789 Another Street, Singapore 654321',
            Email: 'another@valid.com',
            Website: 'www.anothervalid.com',
            Status: true
        },
        {
            Id: 4,
            Phone: '+44 20 1234 5678',
            CompanyName: 'UK Company',
            PhysicalAddress: '321 UK Street, London',
            Email: 'uk@company.com',
            Website: 'www.ukcompany.com',
            Status: false
        }
    ];

    try {
        console.log('Generating Excel file with styling...');

        // Generate Excel buffer with explicit styling options
        const buffer = exporter.generateExcelBuffer(sampleRecords, {
            sheetName: 'Styled Phone Records',
            enableStyling: true,
            stylingOptions: {
                fontName: 'Aptos Narrow',
                fontSize: 12,
                horizontalAlign: 'center',
                verticalAlign: 'center'
            }
        });

        if (!buffer || buffer.length === 0) {
            console.error('✗ Failed to generate Excel buffer');
            return false;
        }

        // Save to file for inspection
        const outputPath = path.join(__dirname, 'exports', 'test-styled-export.xlsx');

        // Ensure exports directory exists
        const exportsDir = path.dirname(outputPath);
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);
        console.log(`✓ Excel file created: ${outputPath}`);
        console.log(`✓ File size: ${buffer.length} bytes`);

        // Verify file exists and has content
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log('✓ File verification passed');

            // Read the file back to verify it's a valid Excel file
            try {
                const XLSX = require('xlsx');
                const workbook = XLSX.readFile(outputPath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                console.log('✓ Excel file is readable');
                console.log(`✓ Sheet name: ${sheetName}`);

                // Check if cells have style information
                const cellA1 = worksheet['A1']; // Header cell
                const cellA2 = worksheet['A2']; // Data cell (Status: true)
                const cellA3 = worksheet['A3']; // Data cell (Status: false)

                console.log('\nCell styling information:');
                console.log('Header cell (A1) style:', cellA1.s ? 'Present' : 'Missing');
                console.log('Data cell (A2) style:', cellA2.s ? 'Present' : 'Missing');
                console.log('Data cell (A3) style:', cellA3.s ? 'Present' : 'Missing');

                if (cellA1.s) {
                    console.log('Header font:', cellA1.s.font ? 'Present' : 'Missing');
                    console.log('Header alignment:', cellA1.s.alignment ? 'Present' : 'Missing');
                    console.log('Header bold:', cellA1.s.font && cellA1.s.font.bold ? 'Yes' : 'No');
                }

                if (cellA2.s) {
                    console.log('Data font:', cellA2.s.font ? 'Present' : 'Missing');
                    console.log('Data alignment:', cellA2.s.alignment ? 'Present' : 'Missing');
                    console.log('Data fill:', cellA2.s.fill ? 'Present' : 'Missing');
                }

                return true;

            } catch (readError) {
                console.error('✗ Failed to read Excel file:', readError.message);
                return false;
            }

        } else {
            console.error('✗ File verification failed');
            return false;
        }

    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

async function testExportCheckTableRecords() {
    console.log('\n=== Test exportCheckTableRecords Method ===\n');

    const exporter = new ExcelExporter();

    // Sample records in CheckTable format
    const checkTableRecords = [
        {
            Id: 100,
            Phone: '+65 1234 5678',
            CompanyName: 'Tech Company Singapore',
            PhysicalAddress: '1 Tech Street, Singapore 123456',
            Email: 'contact@techsg.com',
            Website: 'www.techsg.com',
            Status: true,
            created_at: new Date(),
            updated_at: new Date()
        },
        {
            Id: 101,
            Phone: '+1 555 999 8888',
            CompanyName: 'US Company',
            PhysicalAddress: '100 US Street, New York',
            Email: 'info@uscompany.com',
            Website: 'www.uscompany.com',
            Status: false,
            created_at: new Date(),
            updated_at: new Date()
        }
    ];

    try {
        console.log('Testing exportCheckTableRecords method...');

        const result = await exporter.exportCheckTableRecords(checkTableRecords, {
            sheetName: 'Check Table Test',
            enableStyling: true,
            stylingOptions: {
                fontName: 'Aptos Narrow',
                fontSize: 12,
                horizontalAlign: 'center',
                verticalAlign: 'center'
            }
        });

        if (result.success && result.buffer) {
            console.log('✓ exportCheckTableRecords succeeded');
            console.log(`✓ Buffer size: ${result.buffer.length} bytes`);
            console.log(`✓ Record count: ${result.metadata.recordCount}`);

            // Save this test too
            const outputPath = path.join(__dirname, 'exports', 'test-check-table-export.xlsx');
            fs.writeFileSync(outputPath, result.buffer);
            console.log(`✓ Test file saved: ${outputPath}`);

            return true;
        } else {
            console.error('✗ exportCheckTableRecords failed:', result.error);
            return false;
        }

    } catch (error) {
        console.error('✗ exportCheckTableRecords test failed:', error.message);
        return false;
    }
}

async function runRealTests() {
    console.log('Real Excel Export Test Suite');
    console.log('============================\n');

    const test1 = await testRealExcelExport();
    const test2 = await testExportCheckTableRecords();

    console.log('\n=== Final Results ===');
    console.log('Real Excel Export Test:', test1 ? 'PASS' : 'FAIL');
    console.log('CheckTable Export Test:', test2 ? 'PASS' : 'FAIL');
    console.log('Overall Status:', (test1 && test2) ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');

    if (test1 && test2) {
        console.log('\n📁 Generated test files in exports/ directory:');
        console.log('  - test-styled-export.xlsx');
        console.log('  - test-check-table-export.xlsx');
        console.log('\n🔍 Open these files in Excel to visually verify styling:');
        console.log('  - Aptos Narrow font, 12pt');
        console.log('  - Center alignment (horizontal and vertical)');
        console.log('  - Bold headers');
        console.log('  - Red background for Status=false rows');
        console.log('  - White background for Status=true rows');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runRealTests();
}

module.exports = {
    testRealExcelExport,
    testExportCheckTableRecords,
    runRealTests
};
