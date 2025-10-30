/**
 * Alternative Excel Styling Approach
 * This test will try different methods to ensure styling persists
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function testAlternativeStyleApproach() {
    console.log('=== Alternative Styling Approach ===\n');

    // Create test data
    const data = [
        ['ID', 'Phone', 'Company', 'Status'],
        [1, '+65 1234 5678', 'Valid Company', 'TRUE'],
        [2, '+1 555 1234', 'Invalid Company', 'FALSE']
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 10 }
    ];

    // Approach 1: Simple style objects
    console.log('Testing simple style objects...');

    // Header style (simpler format)
    const headerStyle = {
        font: { bold: true, name: "Aptos Narrow", sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "E6E6FA" } }
    };

    // Status styles
    const statusTrueStyle = {
        font: { name: "Aptos Narrow", sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "FFFFFF" } }
    };

    const statusFalseStyle = {
        font: { name: "Aptos Narrow", sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "FF0000" } }
    };

    // Apply styles to specific cells
    if (worksheet['A1']) worksheet['A1'].s = headerStyle;
    if (worksheet['B1']) worksheet['B1'].s = headerStyle;
    if (worksheet['C1']) worksheet['C1'].s = headerStyle;
    if (worksheet['D1']) worksheet['D1'].s = headerStyle;

    // Apply status-based styles to row 2 (TRUE status)
    if (worksheet['A2']) worksheet['A2'].s = statusTrueStyle;
    if (worksheet['B2']) worksheet['B2'].s = statusTrueStyle;
    if (worksheet['C2']) worksheet['C2'].s = statusTrueStyle;
    if (worksheet['D2']) worksheet['D2'].s = statusTrueStyle;

    // Apply status-based styles to row 3 (FALSE status)
    if (worksheet['A3']) worksheet['A3'].s = statusFalseStyle;
    if (worksheet['B3']) worksheet['B3'].s = statusFalseStyle;
    if (worksheet['C3']) worksheet['C3'].s = statusFalseStyle;
    if (worksheet['D3']) worksheet['D3'].s = statusFalseStyle;

    console.log('✓ Styles applied to all cells');

    // Create workbook with proper properties
    const workbook = {
        SheetNames: ['Styled Test'],
        Sheets: {
            'Styled Test': worksheet
        },
        Props: {
            Title: 'Styled Excel Test',
            Author: 'Singapore Phone App'
        }
    };

    // Test different write options
    const writeOptions = {
        bookType: 'xlsx',
        type: 'buffer',
        cellStyles: true,
        sheetStubs: false
    };

    try {
        const buffer = XLSX.write(workbook, writeOptions);
        console.log(`✓ Workbook written: ${buffer.length} bytes`);

        // Save file
        const outputPath = path.join(__dirname, 'exports', 'alternative-styled.xlsx');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✓ File saved: ${outputPath}`);

        // Read back and test
        const readWorkbook = XLSX.readFile(outputPath, { cellStyles: true });
        const readWorksheet = readWorkbook.Sheets['Styled Test'];

        console.log('\n--- Checking cells after read ---');
        console.log('A1 (header):', readWorksheet['A1'].s ? 'HAS STYLE' : 'NO STYLE');
        console.log('A2 (true status):', readWorksheet['A2'].s ? 'HAS STYLE' : 'NO STYLE');
        console.log('A3 (false status):', readWorksheet['A3'].s ? 'HAS STYLE' : 'NO STYLE');

        if (readWorksheet['A1'].s) {
            console.log('A1 style details:', JSON.stringify(readWorksheet['A1'].s, null, 2));
        }

        return !!readWorksheet['A1'].s;

    } catch (error) {
        console.error('✗ Alternative approach failed:', error.message);
        return false;
    }
}

function testWithModernXLSX() {
    console.log('\n=== Testing with modern XLSX format ===\n');

    // Try using the newer style format
    const data = [
        ['ID', 'Phone', 'Status'],
        [1, '+65 1234 5678', 'Valid'],
        [2, '+1 555 1234', 'Invalid']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Modern style format
    const headerStyle = {
        font: {
            bold: true,
            name: "Calibri",  // Use Calibri as fallback
            sz: 12,
            color: { rgb: "000000" }
        },
        alignment: {
            horizontal: "center",
            vertical: "center"
        },
        fill: {
            patternType: "solid",
            fgColor: { rgb: "D3D3D3" }  // Light gray
        }
    };

    const redStyle = {
        font: {
            name: "Calibri",
            sz: 12,
            color: { rgb: "000000" }
        },
        alignment: {
            horizontal: "center",
            vertical: "center"
        },
        fill: {
            patternType: "solid",
            fgColor: { rgb: "FF0000" }
        }
    };

    const whiteStyle = {
        font: {
            name: "Calibri",
            sz: 12,
            color: { rgb: "000000" }
        },
        alignment: {
            horizontal: "center",
            vertical: "center"
        },
        fill: {
            patternType: "solid",
            fgColor: { rgb: "FFFFFF" }
        }
    };

    // Apply styles
    ['A1', 'B1', 'C1'].forEach(cell => {
        if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    ['A2', 'B2', 'C2'].forEach(cell => {
        if (worksheet[cell]) worksheet[cell].s = whiteStyle;
    });

    ['A3', 'B3', 'C3'].forEach(cell => {
        if (worksheet[cell]) worksheet[cell].s = redStyle;
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modern Test');

    try {
        const buffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'buffer',
            cellStyles: true
        });

        const outputPath = path.join(__dirname, 'exports', 'modern-styled.xlsx');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✓ Modern format file saved: ${outputPath}`);

        // Read back
        const readWorkbook = XLSX.readFile(outputPath);
        const readWorksheet = readWorkbook.Sheets['Modern Test'];

        const hasStyles = !!(readWorksheet['A1'].s || readWorksheet['A2'].s || readWorksheet['A3'].s);
        console.log('Modern format styles persist:', hasStyles ? 'YES' : 'NO');

        return hasStyles;

    } catch (error) {
        console.error('✗ Modern format failed:', error.message);
        return false;
    }
}

function runAlternativeTests() {
    console.log('Alternative Excel Styling Tests');
    console.log('===============================\n');

    const test1 = testAlternativeStyleApproach();
    const test2 = testWithModernXLSX();

    console.log('\n=== Alternative Test Results ===');
    console.log('Alternative approach:', test1 ? 'WORKING' : 'NOT WORKING');
    console.log('Modern format:', test2 ? 'WORKING' : 'NOT WORKING');

    if (!test1 && !test2) {
        console.log('\n❌ Styling issues detected:');
        console.log('The XLSX library may have limitations with style persistence.');
        console.log('However, the actual Excel files may still display correctly.');
        console.log('\n🔍 Recommendation:');
        console.log('Open the generated files in Excel to verify visual styling.');
        console.log('The issue may be with reading styles back, not writing them.');
    } else {
        console.log('\n✅ At least one styling approach works!');
    }

    return test1 || test2;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAlternativeTests();
}

module.exports = {
    testAlternativeStyleApproach,
    testWithModernXLSX,
    runAlternativeTests
};
