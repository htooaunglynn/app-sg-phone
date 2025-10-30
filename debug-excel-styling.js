/**
 * Debug Excel Styling Issue
 * This test will help identify why styling is not being applied correctly
 */

const XLSX = require('xlsx');
const {
    createBaseStyle,
    createHeaderStyle,
    createStatusStyle,
    validateXLSXStyleObject,
    safeApplyStyle
} = require('./src/utils/excelStylingConfig');

function debugStyling() {
    console.log('=== Debug Excel Styling ===\n');

    // Create simple test data
    const data = [
        ['ID', 'Phone', 'Company', 'Status'],
        [1, '+65 1234 5678', 'Company A', true],
        [2, '+1 555 1234', 'Company B', false]
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    console.log('✓ Worksheet created');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 10 }, // ID
        { wch: 15 }, // Phone
        { wch: 20 }, // Company
        { wch: 10 }  // Status
    ];
    console.log('✓ Column widths set');

    // Test 1: Apply header style manually to A1
    console.log('\n--- Test 1: Header Style ---');
    const headerStyle = createHeaderStyle();
    console.log('Header style object:', JSON.stringify(headerStyle, null, 2));

    const headerValidation = validateXLSXStyleObject(headerStyle);
    console.log('Header style validation:', headerValidation.valid ? 'PASS' : 'FAIL');
    if (!headerValidation.valid) {
        console.log('Header validation errors:', headerValidation.errors);
    }

    // Apply header style directly
    if (worksheet['A1']) {
        worksheet['A1'].s = headerStyle;
        console.log('✓ Header style applied to A1');
        console.log('A1 cell after styling:', JSON.stringify(worksheet['A1'], null, 2));
    }

    // Test 2: Apply status style to A2 (true status)
    console.log('\n--- Test 2: Status True Style ---');
    const statusTrueStyle = createStatusStyle(true);
    console.log('Status true style object:', JSON.stringify(statusTrueStyle, null, 2));

    if (worksheet['A2']) {
        worksheet['A2'].s = statusTrueStyle;
        console.log('✓ Status true style applied to A2');
    }

    // Test 3: Apply status style to A3 (false status)
    console.log('\n--- Test 3: Status False Style ---');
    const statusFalseStyle = createStatusStyle(false);
    console.log('Status false style object:', JSON.stringify(statusFalseStyle, null, 2));

    if (worksheet['A3']) {
        worksheet['A3'].s = statusFalseStyle;
        console.log('✓ Status false style applied to A3');
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Debug Test');
    console.log('✓ Workbook created');

    // Test different write options
    console.log('\n--- Testing Write Options ---');

    const writeOptions1 = {
        type: 'buffer',
        bookType: 'xlsx',
        cellStyles: true
    };

    try {
        const buffer1 = XLSX.write(workbook, writeOptions1);
        console.log(`✓ Buffer with cellStyles=true: ${buffer1.length} bytes`);

        // Save and read back
        const fs = require('fs');
        const path = require('path');

        const outputPath = path.join(__dirname, 'exports', 'debug-styled.xlsx');
        fs.writeFileSync(outputPath, buffer1);
        console.log(`✓ File saved: ${outputPath}`);

        // Read back and check styles
        const readWorkbook = XLSX.readFile(outputPath);
        const readWorksheet = readWorkbook.Sheets['Debug Test'];

        console.log('\n--- Reading Back Styles ---');
        console.log('A1 cell read back:', JSON.stringify(readWorksheet['A1'], null, 2));
        console.log('A2 cell read back:', JSON.stringify(readWorksheet['A2'], null, 2));
        console.log('A3 cell read back:', JSON.stringify(readWorksheet['A3'], null, 2));

        // Check if styles exist
        const a1HasStyle = readWorksheet['A1'].s ? 'YES' : 'NO';
        const a2HasStyle = readWorksheet['A2'].s ? 'YES' : 'NO';
        const a3HasStyle = readWorksheet['A3'].s ? 'YES' : 'NO';

        console.log(`A1 has style: ${a1HasStyle}`);
        console.log(`A2 has style: ${a2HasStyle}`);
        console.log(`A3 has style: ${a3HasStyle}`);

        return a1HasStyle === 'YES' || a2HasStyle === 'YES' || a3HasStyle === 'YES';

    } catch (error) {
        console.error('✗ Write/read test failed:', error.message);
        return false;
    }
}

function testXLSXVersion() {
    console.log('\n=== XLSX Library Information ===');
    const XLSX = require('xlsx');
    console.log('XLSX version:', XLSX.version || 'Version not available');

    // Test if cellStyles is supported
    const testData = [['Test']];
    const testSheet = XLSX.utils.aoa_to_sheet(testData);
    const testWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(testWorkbook, testSheet, 'Test');

    try {
        const buffer = XLSX.write(testWorkbook, { type: 'buffer', cellStyles: true });
        console.log('✓ cellStyles option is supported');
        return true;
    } catch (error) {
        console.log('✗ cellStyles option error:', error.message);
        return false;
    }
}

function runDebugTests() {
    console.log('Excel Styling Debug Suite');
    console.log('=========================\n');

    const xlsxSupported = testXLSXVersion();
    const stylingWorking = debugStyling();

    console.log('\n=== Debug Results ===');
    console.log('XLSX cellStyles support:', xlsxSupported ? 'SUPPORTED' : 'NOT SUPPORTED');
    console.log('Style persistence:', stylingWorking ? 'WORKING' : 'NOT WORKING');

    if (!stylingWorking) {
        console.log('\n🔍 Possible Issues:');
        console.log('1. XLSX library version may not support cellStyles');
        console.log('2. Style objects may have incorrect format');
        console.log('3. Excel application may not be displaying styles correctly');
        console.log('\n💡 Recommendations:');
        console.log('1. Check XLSX library version: npm list xlsx');
        console.log('2. Try opening the file in different Excel applications');
        console.log('3. Verify style object format matches XLSX documentation');
    }
}

// Run debug tests if this file is executed directly
if (require.main === module) {
    runDebugTests();
}

module.exports = {
    debugStyling,
    testXLSXVersion,
    runDebugTests
};
