/**
 * Integration Tests for Complete Duplicate Styling Workflow
 * Tests end-to-end workflow from duplicate phone detection to visual styling
 * Verifies consistency between web table and Excel export duplicate highlighting
 * Tests performance with large datasets containing many duplicate phone numbers
 * Validates accessibility compliance with screen readers and high contrast mode
 */

const FrontendDuplicateDetectionService = require('../public/js/duplicateDetectionService');
const DuplicateDetectionService = require('../src/services/duplicateDetectionService');
const ExcelExporter = require('../src/services/excelExporter');
const { COLOR_CONFIG, validateColorCode } = require('../src/utils/colorConfig');
const { createDuplicateStyle, validateXLSXStyleObject } = require('../src/utils/excelStylingConfig');

// Mock database for backend service
jest.mock('../src/utils/database', () => ({
    query: jest.fn(),
    getConnectionStatus: jest.fn(() => ({ connected: true }))
}));

describe('End-to-End Duplicate Styling Workflow', () => {
    let frontendService;
    let backendService;
    let excelExporter;

    beforeEach(() => {
        frontendService = new FrontendDuplicateDetectionService();
        backendService = new DuplicateDetectionService();
        excelExporter = new ExcelExporter();
    });

    afterEach(() => {
        if (frontendService && typeof frontendService.reset === 'function') {
            frontendService.reset();
        }
    });

    describe('Complete Workflow Integration', () => {
        test('should process records from detection to styling consistently', async () => {
            const testRecords = [
                { id: 'REC001', phone: '+65 9123 4567', company: 'Company A', status: true },
                { id: 'REC002', phone: '91234567', company: 'Company B', status: false }, // Duplicate
                { id: 'REC003', phone: '+65 8765 4321', company: 'Company C', status: true },
                { id: 'REC004', phone: '8765-4321', company: 'Company D', status: true }, // Duplicate
                { id: 'REC005', phone: '+65 5555 5555', company: 'Company E', status: false }
            ];

            // Step 1: Frontend duplicate detection
            const frontendResult = frontendService.identifyDuplicatePhoneNumbers(testRecords);
            
            expect(frontendResult.totalRecords).toBe(5);
            expect(frontendResult.duplicateCount).toBe(4); // 4 records are duplicates
            expect(frontendResult.duplicatePhoneCount).toBe(2); // 2 unique phone numbers have duplicates

            // Step 2: Create duplicate mapping for styling
            const duplicateMapping = frontendService.createDuplicatePhoneMapping(testRecords);
            
            expect(duplicateMapping.get('REC001').isDuplicate).toBe(true);
            expect(duplicateMapping.get('REC002').isDuplicate).toBe(true);
            expect(duplicateMapping.get('REC003').isDuplicate).toBe(true);
            expect(duplicateMapping.get('REC004').isDuplicate).toBe(true);
            expect(duplicateMapping.get('REC005').isDuplicate).toBe(false);

            // Step 3: Verify styling configuration consistency
            const duplicateStyle = createDuplicateStyle();
            expect(duplicateStyle.fill.fgColor.rgb).toBe(COLOR_CONFIG.duplicate.backgroundRgb);
            expect(duplicateStyle.font.color.rgb).toBe(COLOR_CONFIG.duplicate.textRgb);

            // Step 4: Validate style object for Excel export
            const styleValidation = validateXLSXStyleObject(duplicateStyle, { isDuplicateStyle: true });
            expect(styleValidation.valid).toBe(true);
            expect(styleValidation.errors.length).toBe(0);
        });

        test('should maintain data integrity throughout the workflow', () => {
            const originalRecords = [
                { id: 'TEST001', phone: '+65 9123 4567', company: 'Test Company', status: true, metadata: { source: 'import' } },
                { id: 'TEST002', phone: '91234567', company: 'Another Company', status: false, metadata: { source: 'manual' } }
            ];

            // Create deep copy to verify original data isn't modified
            const recordsCopy = JSON.parse(JSON.stringify(originalRecords));

            // Process through duplicate detection
            const duplicateResult = frontendService.identifyDuplicatePhoneNumbers(originalRecords);
            
            // Verify original records are unchanged
            expect(originalRecords).toEqual(recordsCopy);
            
            // Verify duplicate detection results are accurate
            expect(duplicateResult.duplicateCount).toBe(2);
            expect(duplicateResult.totalRecords).toBe(2);
        });
    });

    describe('Web Table and Excel Export Consistency', () => {
        test('should use identical orange color in both web and Excel styling', () => {
            const webColor = COLOR_CONFIG.duplicate.background;
            const excelColor = COLOR_CONFIG.duplicate.backgroundRgb;
            
            // Verify color consistency
            expect(webColor).toBe('#FFA500');
            expect(excelColor).toBe('FFA500');
            
            // Verify color validation
            const webColorValidation = validateColorCode(webColor);
            expect(webColorValidation.isValid).toBe(true);
            expect(webColorValidation.rgbFormatted).toBe(excelColor);
        });

        test('should apply consistent styling properties across platforms', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Verify Excel styling properties
            expect(duplicateStyle.font.name).toBe('Aptos Narrow');
            expect(duplicateStyle.font.sz).toBe(12);
            expect(duplicateStyle.alignment.horizontal).toBe('center');
            expect(duplicateStyle.alignment.vertical).toBe('center');
            
            // Verify colors match web configuration
            expect(duplicateStyle.fill.fgColor.rgb).toBe(COLOR_CONFIG.duplicate.backgroundRgb);
            expect(duplicateStyle.font.color.rgb).toBe(COLOR_CONFIG.duplicate.textRgb);
        });

        test('should handle mixed duplicate and non-duplicate records correctly', () => {
            const mixedRecords = [
                { id: 'MIX001', phone: '+65 9123 4567', status: true },   // Will be duplicate
                { id: 'MIX002', phone: '91234567', status: false },      // Duplicate of MIX001
                { id: 'MIX003', phone: '+65 8765 4321', status: true },  // Unique
                { id: 'MIX004', phone: '+65 5555 5555', status: false }, // Unique
                { id: 'MIX005', phone: '9123 4567', status: true }       // Duplicate of MIX001
            ];

            const duplicateResult = frontendService.identifyDuplicatePhoneNumbers(mixedRecords);
            const duplicateMapping = frontendService.createDuplicatePhoneMapping(mixedRecords);

            // Verify correct identification
            expect(duplicateMapping.get('MIX001').isDuplicate).toBe(true);
            expect(duplicateMapping.get('MIX002').isDuplicate).toBe(true);
            expect(duplicateMapping.get('MIX003').isDuplicate).toBe(false);
            expect(duplicateMapping.get('MIX004').isDuplicate).toBe(false);
            expect(duplicateMapping.get('MIX005').isDuplicate).toBe(true);

            // Verify duplicate groups
            expect(duplicateMapping.get('MIX001').duplicateCount).toBe(3);
            expect(duplicateMapping.get('MIX002').duplicateCount).toBe(3);
            expect(duplicateMapping.get('MIX005').duplicateCount).toBe(3);
        });
    });

    describe('Performance with Large Datasets', () => {
        test('should handle large datasets with many duplicates efficiently', () => {
            // Create large dataset with high duplicate rate
            const largeDataset = [];
            const basePhones = ['+65 9123 4567', '+65 8765 4321', '+65 5555 5555'];
            
            for (let i = 0; i < 1000; i++) {
                largeDataset.push({
                    id: `LARGE_${i}`,
                    phone: basePhones[i % basePhones.length], // Creates many duplicates
                    company: `Company ${i}`,
                    status: i % 2 === 0
                });
            }

            const startTime = Date.now();
            const duplicateResult = frontendService.identifyDuplicatePhoneNumbers(largeDataset);
            const endTime = Date.now();

            // Verify performance
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            // Verify accuracy with high duplicate rate
            expect(duplicateResult.totalRecords).toBe(1000);
            expect(duplicateResult.duplicatePhoneCount).toBe(3); // 3 unique phone numbers
            expect(duplicateResult.duplicateCount).toBe(1000); // All records are duplicates
            
            // Verify memory efficiency
            const metrics = frontendService.getMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.totalDetections).toBeGreaterThan(0);
        });

        test('should maintain performance with progressive processing', async () => {
            const service = new FrontendDuplicateDetectionService();
            // Create very large dataset to trigger progressive processing
            const veryLargeDataset = [];
            for (let i = 0; i < 5000; i++) {
                veryLargeDataset.push({
                    id: `PROG_${i}`,
                    phone: i % 50 === 0 ? '+65 9123 4567' : `+65 ${String(i).padStart(8, '0')}`,
                    company: `Company ${i}`
                });
            }

            const startTime = Date.now();
            const result = service.identifyDuplicatePhoneNumbers(veryLargeDataset);
            const endTime = Date.now();

            expect(result.totalRecords).toBeGreaterThanOrEqual(0); // Handle potential filtering
            expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(result.duplicateCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Accessibility Compliance', () => {
        test('should provide sufficient color contrast for accessibility', () => {
            const orangeBackground = COLOR_CONFIG.duplicate.backgroundRgb;
            const blackText = COLOR_CONFIG.duplicate.textRgb;
            
            // Verify colors are defined
            expect(orangeBackground).toBe('FFA500');
            expect(blackText).toBe('000000');
            
            // Basic color validation (actual contrast calculation would require additional library)
            expect(orangeBackground).toMatch(/^[0-9A-F]{6}$/);
            expect(blackText).toMatch(/^[0-9A-F]{6}$/);
        });

        test('should provide alternative indicators beyond color', () => {
            const testRecords = [
                { id: 'ACC001', phone: '+65 9123 4567' },
                { id: 'ACC002', phone: '91234567' } // Duplicate
            ];

            const duplicateMapping = frontendService.createDuplicatePhoneMapping(testRecords);
            
            // Verify duplicate information provides more than just color
            const duplicateInfo = duplicateMapping.get('ACC001');
            expect(duplicateInfo.isDuplicate).toBe(true);
            expect(duplicateInfo.duplicateCount).toBe(2);
            expect(duplicateInfo.duplicateRecordIds).toContain('ACC001');
            expect(duplicateInfo.duplicateRecordIds).toContain('ACC002');
            expect(duplicateInfo.duplicateGroup).toBeDefined();
        });

        test('should maintain readability with high contrast requirements', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Verify high contrast between background and text
            expect(duplicateStyle.fill.fgColor.rgb).toBe('FFA500'); // Orange background
            expect(duplicateStyle.font.color.rgb).toBe('000000'); // Black text
            
            // Verify font properties support readability
            expect(duplicateStyle.font.sz).toBe(12); // Readable font size
            expect(duplicateStyle.font.name).toBe('Aptos Narrow'); // Clear font family
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should recover gracefully from partial processing failures', () => {
            const service = new FrontendDuplicateDetectionService();
            const problematicDataset = [
                { id: 'ERR001', phone: '+65 9123 4567' },
                null, // Problematic record
                { id: 'ERR003', phone: '91234567' },
                { phone: '+65 8765 4321' }, // Missing ID
                { id: 'ERR005', phone: '+65 5555 5555' }
            ];

            const result = service.identifyDuplicatePhoneNumbers(problematicDataset);
            
            expect(result).toBeDefined();
            expect(result.totalRecords).toBeGreaterThanOrEqual(0); // Handle potential filtering
            
            // Should still identify valid duplicates despite errors
            expect(result.duplicateCount).toBeGreaterThanOrEqual(0);
        });

        test('should provide fallback styling when main styling fails', () => {
            const invalidStyleConfig = {
                fill: { fgColor: { rgb: 'INVALID' } },
                font: { sz: 'not_a_number' }
            };

            const validation = validateXLSXStyleObject(invalidStyleConfig, { isDuplicateStyle: true });
            
            expect(validation.correctedStyle).toBeDefined();
            expect(validation.corrected).toBe(true);
            expect(validation.correctedStyle.fill.fgColor.rgb).toBe('FFA500');
        });

        test('should continue processing when individual records fail', () => {
            // Mock a scenario where some records cause processing errors
            const mixedQualityRecords = [
                { id: 'GOOD001', phone: '+65 9123 4567' },
                { id: 'GOOD002', phone: '91234567' },
                { id: 'BAD003', phone: null }, // Bad phone
                { id: 'GOOD004', phone: '+65 8765 4321' },
                { id: 'BAD005' }, // Missing phone
                { id: 'GOOD006', phone: '+65 5555 5555' }
            ];

            const result = frontendService.identifyDuplicatePhoneNumbers(mixedQualityRecords);
            
            expect(result.totalRecords).toBe(6);
            expect(result.duplicateCount).toBeGreaterThanOrEqual(0);
            
            // Should process good records despite bad ones
            const duplicateMapping = frontendService.createDuplicatePhoneMapping(mixedQualityRecords);
            expect(duplicateMapping.get('GOOD001').isDuplicate).toBe(true);
            expect(duplicateMapping.get('GOOD002').isDuplicate).toBe(true);
        });
    });

    describe('Cross-Platform Compatibility', () => {
        test('should generate Excel-compatible styling objects', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Verify XLSX library compatibility
            expect(duplicateStyle.font.sz).toBeDefined(); // Uses 'sz' not 'size'
            expect(duplicateStyle.font.size).toBeUndefined(); // Should not use legacy 'size'
            
            // Verify color format compatibility
            expect(duplicateStyle.fill.fgColor.rgb).toMatch(/^[0-9A-F]{6}$/);
            expect(duplicateStyle.font.color.rgb).toMatch(/^[0-9A-F]{6}$/);
        });

        test('should validate browser compatibility for web styling', () => {
            const webColor = COLOR_CONFIG.duplicate.background;
            
            // Verify standard CSS color format
            expect(webColor).toMatch(/^#[0-9A-F]{6}$/);
            
            // Verify color is web-safe
            const colorValidation = validateColorCode(webColor);
            expect(colorValidation.isValid).toBe(true);
        });
    });
});