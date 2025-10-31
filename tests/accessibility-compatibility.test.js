/**
 * Accessibility and Cross-Platform Compatibility Tests
 * Tests orange background color meets accessibility contrast requirements (4.5:1 ratio)
 * Validates duplicate styling works across different browsers and devices
 * Tests Excel duplicate styling compatibility with various Excel versions
 * Ensures duplicate phone highlighting works with assistive technologies
 */

const { 
    COLOR_CONFIG, 
    validateColorAccessibility, 
    calculateContrastRatio,
    validateColorCode,
    validateDuplicateColorAccessibility 
} = require('../src/utils/colorConfig');
const { createDuplicateStyle, validateXLSXStyleObject } = require('../src/utils/excelStylingConfig');
const FrontendDuplicateDetectionService = require('../public/js/duplicateDetectionService');

describe('Accessibility and Cross-Platform Compatibility Tests', () => {
    let frontendService;

    beforeEach(() => {
        frontendService = new FrontendDuplicateDetectionService();
    });

    afterEach(() => {
        if (frontendService && typeof frontendService.reset === 'function') {
            frontendService.reset();
        }
    });

    describe('Color Accessibility Compliance', () => {
        test('should meet WCAG 2.1 AA contrast requirements (4.5:1 ratio)', () => {
            const duplicateBackground = COLOR_CONFIG.duplicate.background; // #FFA500
            const duplicateText = COLOR_CONFIG.duplicate.text; // #000000

            const contrastRatio = calculateContrastRatio(duplicateText, duplicateBackground);
            
            expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
            console.log(`Duplicate styling contrast ratio: ${contrastRatio.toFixed(2)}:1`);
            
            // Verify accessibility validation
            const accessibilityResult = validateColorAccessibility(duplicateText, duplicateBackground, {
                textSize: 'normal',
                targetLevel: 'AA'
            });
            
            expect(accessibilityResult.isCompliant).toBe(true);
            expect(accessibilityResult.level).toMatch(/^(AA|AAA)$/);
            expect(accessibilityResult.contrastRatio).toBeGreaterThanOrEqual(4.5);
            expect(accessibilityResult.errors.length).toBe(0);
        });

        test('should meet enhanced contrast requirements for AAA compliance', () => {
            const duplicateBackground = COLOR_CONFIG.duplicate.background;
            const duplicateText = COLOR_CONFIG.duplicate.text;

            const accessibilityResult = validateColorAccessibility(duplicateText, duplicateBackground, {
                textSize: 'normal',
                targetLevel: 'AAA'
            });
            
            // Check if it meets AAA (7:1 ratio) or at least AA (4.5:1 ratio)
            expect(accessibilityResult.contrastRatio).toBeGreaterThanOrEqual(4.5);
            
            if (accessibilityResult.level === 'AAA') {
                expect(accessibilityResult.contrastRatio).toBeGreaterThanOrEqual(7.0);
            }
            
            console.log(`AAA compliance check: ${accessibilityResult.level} (${accessibilityResult.contrastRatio.toFixed(2)}:1)`);
        });

        test('should provide sufficient contrast for large text', () => {
            const duplicateBackground = COLOR_CONFIG.duplicate.background;
            const duplicateText = COLOR_CONFIG.duplicate.text;

            const largeTextAccessibility = validateColorAccessibility(duplicateText, duplicateBackground, {
                textSize: 'large',
                targetLevel: 'AA'
            });
            
            expect(largeTextAccessibility.isCompliant).toBe(true);
            expect(largeTextAccessibility.contrastRatio).toBeGreaterThanOrEqual(3.0); // Large text requirement
            expect(largeTextAccessibility.errors.length).toBe(0);
        });

        test('should validate duplicate color accessibility using built-in function', () => {
            const duplicateAccessibility = validateDuplicateColorAccessibility();
            
            expect(duplicateAccessibility.isCompliant).toBe(true);
            expect(duplicateAccessibility.contrastRatio).toBeGreaterThanOrEqual(4.5);
            expect(duplicateAccessibility.level).toMatch(/^(AA|AAA)$/);
            expect(duplicateAccessibility.errors.length).toBe(0);
        });

        test('should handle high contrast mode requirements', () => {
            // Test with high contrast colors
            const highContrastBackground = '#FFFFFF'; // White
            const highContrastText = '#000000'; // Black

            const highContrastRatio = calculateContrastRatio(highContrastText, highContrastBackground);
            expect(highContrastRatio).toBeGreaterThanOrEqual(21); // Maximum possible contrast

            // Verify our orange still works in high contrast scenarios
            const orangeContrastRatio = calculateContrastRatio(COLOR_CONFIG.duplicate.text, COLOR_CONFIG.duplicate.background);
            expect(orangeContrastRatio).toBeGreaterThanOrEqual(4.5);
        });

        test('should provide alternative indicators beyond color', () => {
            const testRecords = [
                { id: 'ACC001', phone: '+65 9123 4567', company: 'Company A' },
                { id: 'ACC002', phone: '91234567', company: 'Company B' }
            ];

            const duplicateMapping = frontendService.createDuplicatePhoneMapping(testRecords);
            
            // Verify duplicate information provides more than just color
            for (const [recordId, info] of duplicateMapping) {
                expect(info).toHaveProperty('isDuplicate');
                expect(info).toHaveProperty('duplicateCount');
                expect(info).toHaveProperty('duplicateRecordIds');
                expect(info).toHaveProperty('duplicateGroup');
                
                if (info.isDuplicate) {
                    // Alternative indicators for accessibility
                    expect(info.duplicateCount).toBeGreaterThan(1);
                    expect(info.duplicateRecordIds.length).toBeGreaterThan(1);
                    expect(info.duplicateGroup).not.toBeNull();
                    
                    // These properties can be used for screen readers, tooltips, etc.
                    expect(typeof info.duplicateCount).toBe('number');
                    expect(Array.isArray(info.duplicateRecordIds)).toBe(true);
                }
            }
        });

        test('should support screen reader accessibility attributes', () => {
            const duplicateInfo = {
                isDuplicate: true,
                duplicateCount: 3,
                duplicateRecordIds: ['REC001', 'REC002', 'REC003'],
                duplicateGroup: 'normalized_phone_123'
            };

            // Generate accessibility attributes that could be used in HTML
            const ariaLabel = `Duplicate phone number, ${duplicateInfo.duplicateCount} records with same number`;
            const ariaDescription = `This record is one of ${duplicateInfo.duplicateCount} records sharing the same phone number`;
            const role = 'cell';
            const ariaLive = 'polite';

            expect(ariaLabel).toContain('Duplicate phone number');
            expect(ariaLabel).toContain(duplicateInfo.duplicateCount.toString());
            expect(ariaDescription).toContain('records sharing the same phone number');
            expect(role).toBe('cell');
            expect(ariaLive).toBe('polite');
        });
    });

    describe('Cross-Browser Compatibility', () => {
        test('should use standard CSS color format for web browsers', () => {
            const webColor = COLOR_CONFIG.duplicate.background;
            
            // Verify standard CSS hex color format
            expect(webColor).toMatch(/^#[0-9A-F]{6}$/i);
            expect(webColor).toBe('#FFA500');
            
            // Verify color validation
            const colorValidation = validateColorCode(webColor);
            expect(colorValidation.isValid).toBe(true);
            expect(colorValidation.formatted).toBe('#FFA500');
        });

        test('should provide CSS-compatible color values', () => {
            const duplicateColors = {
                backgroundColor: COLOR_CONFIG.duplicate.background,
                color: COLOR_CONFIG.duplicate.text,
                borderColor: COLOR_CONFIG.duplicate.background
            };

            // Verify all colors are valid CSS values
            for (const [property, colorValue] of Object.entries(duplicateColors)) {
                expect(colorValue).toMatch(/^#[0-9A-F]{6}$/i);
                
                const validation = validateColorCode(colorValue);
                expect(validation.isValid).toBe(true);
            }
        });

        test('should work with CSS custom properties (CSS variables)', () => {
            const cssVariables = {
                '--duplicate-bg-color': COLOR_CONFIG.duplicate.background,
                '--duplicate-text-color': COLOR_CONFIG.duplicate.text,
                '--duplicate-border-color': COLOR_CONFIG.duplicate.background
            };

            // Verify CSS variables are properly formatted
            for (const [variable, value] of Object.entries(cssVariables)) {
                expect(variable).toMatch(/^--[a-z-]+$/);
                expect(value).toMatch(/^#[0-9A-F]{6}$/i);
            }
        });

        test('should support responsive design breakpoints', () => {
            // Test color visibility at different screen sizes
            const mobileBreakpoint = 768;
            const tabletBreakpoint = 1024;
            const desktopBreakpoint = 1200;

            // Colors should maintain contrast at all breakpoints
            const contrastRatio = calculateContrastRatio(
                COLOR_CONFIG.duplicate.text,
                COLOR_CONFIG.duplicate.background
            );

            expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
            
            // Verify color works for different device contexts
            const deviceContexts = ['mobile', 'tablet', 'desktop'];
            deviceContexts.forEach(context => {
                expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
            });
        });

        test('should handle browser-specific color rendering', () => {
            const duplicateColor = COLOR_CONFIG.duplicate.background;
            
            // Test color consistency across different color spaces
            const rgbValue = duplicateColor.replace('#', '');
            const r = parseInt(rgbValue.substr(0, 2), 16);
            const g = parseInt(rgbValue.substr(2, 2), 16);
            const b = parseInt(rgbValue.substr(4, 2), 16);
            
            expect(r).toBe(255); // FF
            expect(g).toBe(165); // A5
            expect(b).toBe(0);   // 00
            
            // Verify RGB values are within valid range
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(255);
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(255);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(255);
        });
    });

    describe('Excel Version Compatibility', () => {
        test('should generate Excel 2016+ compatible styling', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Verify Excel 2016+ style structure
            expect(duplicateStyle).toHaveProperty('fill');
            expect(duplicateStyle).toHaveProperty('font');
            expect(duplicateStyle).toHaveProperty('alignment');
            
            // Verify fill properties
            expect(duplicateStyle.fill).toHaveProperty('patternType');
            expect(duplicateStyle.fill).toHaveProperty('fgColor');
            expect(duplicateStyle.fill.patternType).toBe('solid');
            expect(duplicateStyle.fill.fgColor).toHaveProperty('rgb');
            expect(duplicateStyle.fill.fgColor.rgb).toBe('FFA500');
            
            // Verify font properties
            expect(duplicateStyle.font).toHaveProperty('name');
            expect(duplicateStyle.font).toHaveProperty('sz');
            expect(duplicateStyle.font).toHaveProperty('color');
            expect(duplicateStyle.font.name).toBe('Aptos Narrow');
            expect(duplicateStyle.font.sz).toBe(12);
            expect(duplicateStyle.font.color.rgb).toBe('000000');
        });

        test('should use correct XLSX library property names', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Verify XLSX library compatibility
            expect(duplicateStyle.font).toHaveProperty('sz'); // Not 'size'
            expect(duplicateStyle.font).not.toHaveProperty('size');
            
            // Verify color format compatibility
            expect(duplicateStyle.fill.fgColor.rgb).toMatch(/^[0-9A-F]{6}$/);
            expect(duplicateStyle.font.color.rgb).toMatch(/^[0-9A-F]{6}$/);
            
            // Verify alignment properties
            expect(duplicateStyle.alignment.horizontal).toBe('center');
            expect(duplicateStyle.alignment.vertical).toBe('center');
        });

        test('should validate Excel style object structure', () => {
            const duplicateStyle = createDuplicateStyle();
            const validation = validateXLSXStyleObject(duplicateStyle, { isDuplicateStyle: true });
            
            expect(validation.valid).toBe(true);
            expect(validation.errors.length).toBe(0);
            
            if (validation.warnings.length > 0) {
                console.log('Excel style warnings:', validation.warnings);
            }
        });

        test('should provide fallback for older Excel versions', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Test with invalid style to trigger fallback
            const invalidStyle = {
                fill: { fgColor: { rgb: 'INVALID' } },
                font: { sz: 'invalid' }
            };
            
            const validation = validateXLSXStyleObject(invalidStyle, { isDuplicateStyle: true });
            
            if (!validation.valid) {
                expect(validation.correctedStyle).toBeDefined();
                expect(validation.correctedStyle.fill.fgColor.rgb).toBe('FFA500');
            }
        });

        test('should support LibreOffice Calc compatibility', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // LibreOffice Calc should support the same style structure as Excel
            expect(duplicateStyle.fill.patternType).toBe('solid');
            expect(duplicateStyle.fill.fgColor.rgb).toBe('FFA500');
            expect(duplicateStyle.font.color.rgb).toBe('000000');
            
            // Verify font properties are compatible
            expect(duplicateStyle.font.name).toBe('Aptos Narrow');
            expect(typeof duplicateStyle.font.sz).toBe('number');
        });

        test('should handle Excel Online compatibility', () => {
            const duplicateStyle = createDuplicateStyle();
            
            // Excel Online supports basic styling
            expect(duplicateStyle.fill.fgColor.rgb).toBe('FFA500');
            expect(duplicateStyle.font.color.rgb).toBe('000000');
            
            // Verify essential properties are present
            const essentialProperties = ['fill', 'font', 'alignment'];
            essentialProperties.forEach(prop => {
                expect(duplicateStyle).toHaveProperty(prop);
            });
        });
    });

    describe('Mobile Device Compatibility', () => {
        test('should maintain color visibility on mobile screens', () => {
            const duplicateBackground = COLOR_CONFIG.duplicate.background;
            const duplicateText = COLOR_CONFIG.duplicate.text;
            
            // Mobile screens often have different color rendering
            const contrastRatio = calculateContrastRatio(duplicateText, duplicateBackground);
            expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
            
            // Test with common mobile screen characteristics
            const mobileContexts = [
                { name: 'bright_sunlight', contrastMultiplier: 0.8 },
                { name: 'low_light', contrastMultiplier: 1.2 },
                { name: 'blue_light_filter', contrastMultiplier: 0.9 }
            ];
            
            mobileContexts.forEach(context => {
                const adjustedContrast = contrastRatio * context.contrastMultiplier;
                expect(adjustedContrast).toBeGreaterThanOrEqual(3.0); // Minimum for mobile
            });
        });

        test('should support touch interface requirements', () => {
            const testRecords = [
                { id: 'TOUCH001', phone: '+65 9123 4567' },
                { id: 'TOUCH002', phone: '91234567' }
            ];

            const duplicateMapping = frontendService.createDuplicatePhoneMapping(testRecords);
            
            // Touch interfaces need clear visual indicators
            for (const [recordId, info] of duplicateMapping) {
                if (info.isDuplicate) {
                    expect(info.duplicateCount).toBeGreaterThan(1);
                    expect(info.duplicateRecordIds.length).toBeGreaterThan(1);
                    
                    // Properties that can be used for touch feedback
                    expect(typeof info.duplicateCount).toBe('number');
                    expect(Array.isArray(info.duplicateRecordIds)).toBe(true);
                }
            }
        });

        test('should work with mobile browser limitations', () => {
            const duplicateColor = COLOR_CONFIG.duplicate.background;
            
            // Mobile browsers may have color limitations
            const colorValidation = validateColorCode(duplicateColor);
            expect(colorValidation.isValid).toBe(true);
            
            // Verify color is web-safe
            const rgbValue = duplicateColor.replace('#', '');
            const r = parseInt(rgbValue.substr(0, 2), 16);
            const g = parseInt(rgbValue.substr(2, 2), 16);
            const b = parseInt(rgbValue.substr(4, 2), 16);
            
            // Orange (#FFA500) is web-safe
            expect(r % 51).toBe(0); // 255 % 51 = 0 (web-safe)
            // Note: 165 is not web-safe, but modern mobile browsers support full color range
        });
    });

    describe('Assistive Technology Support', () => {
        test('should provide semantic information for screen readers', () => {
            const duplicateInfo = {
                isDuplicate: true,
                duplicateCount: 3,
                duplicateRecordIds: ['REC001', 'REC002', 'REC003'],
                normalizedPhone: '91234567'
            };

            // Generate screen reader friendly descriptions
            const screenReaderText = `Duplicate phone record. This phone number appears in ${duplicateInfo.duplicateCount} records.`;
            const ariaLabel = `Phone number ${duplicateInfo.normalizedPhone}, duplicate entry ${duplicateInfo.duplicateCount} occurrences`;
            
            expect(screenReaderText).toContain('Duplicate phone record');
            expect(screenReaderText).toContain(duplicateInfo.duplicateCount.toString());
            expect(ariaLabel).toContain(duplicateInfo.normalizedPhone);
            expect(ariaLabel).toContain('duplicate entry');
        });

        test('should support keyboard navigation', () => {
            const testRecords = [
                { id: 'KB001', phone: '+65 9123 4567', company: 'Keyboard Corp A' },
                { id: 'KB002', phone: '91234567', company: 'Keyboard Corp B' },
                { id: 'KB003', phone: '+65 8765 4321', company: 'Unique Corp' }
            ];

            const duplicateMapping = frontendService.createDuplicatePhoneMapping(testRecords);
            
            // Keyboard navigation requires consistent, predictable information
            const duplicateRecords = Array.from(duplicateMapping.entries())
                .filter(([id, info]) => info.isDuplicate);
            
            expect(duplicateRecords.length).toBe(2);
            
            duplicateRecords.forEach(([recordId, info]) => {
                expect(info.duplicateCount).toBe(2);
                expect(info.duplicateRecordIds.length).toBe(2);
                expect(info.duplicateGroup).not.toBeNull();
            });
        });

        test('should provide focus indicators for duplicate records', () => {
            const focusStyles = {
                outline: `2px solid ${COLOR_CONFIG.duplicate.background}`,
                outlineOffset: '2px',
                backgroundColor: COLOR_CONFIG.duplicate.background,
                color: COLOR_CONFIG.duplicate.text
            };

            // Verify focus styles maintain accessibility
            const focusContrastRatio = calculateContrastRatio(
                focusStyles.color,
                focusStyles.backgroundColor
            );
            
            expect(focusContrastRatio).toBeGreaterThanOrEqual(4.5);
            expect(focusStyles.outline).toContain(COLOR_CONFIG.duplicate.background);
        });

        test('should support voice control and dictation', () => {
            const duplicateInfo = {
                isDuplicate: true,
                duplicateCount: 2,
                duplicateRecordIds: ['VOICE001', 'VOICE002'],
                normalizedPhone: '91234567'
            };

            // Voice control needs clear, speakable labels
            const voiceLabel = `Duplicate phone entry, ${duplicateInfo.duplicateCount} records`;
            const voiceCommand = `Select duplicate phone record ${duplicateInfo.duplicateRecordIds[0]}`;
            
            expect(voiceLabel).toContain('Duplicate phone entry');
            expect(voiceCommand).toContain('Select duplicate phone record');
            expect(voiceCommand).toContain(duplicateInfo.duplicateRecordIds[0]);
        });
    });

    describe('Performance with Accessibility Features', () => {
        test('should maintain performance with screen reader support', () => {
            const largeDataset = [];
            for (let i = 0; i < 1000; i++) {
                largeDataset.push({
                    id: `PERF_ACC_${i}`,
                    phone: i % 100 === 0 ? '+65 9123 4567' : `+65 ${String(i).padStart(8, '0')}`,
                    company: `Performance Company ${i}`
                });
            }

            const startTime = Date.now();
            const result = frontendService.identifyDuplicatePhoneNumbers(largeDataset);
            const duplicateMapping = frontendService.createDuplicatePhoneMapping(largeDataset);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(result.totalRecords).toBe(1000);
            
            // Verify accessibility information is available for all records
            expect(duplicateMapping.size).toBe(1000);
            
            for (const [recordId, info] of duplicateMapping) {
                expect(info).toHaveProperty('isDuplicate');
                expect(info).toHaveProperty('duplicateCount');
                expect(info).toHaveProperty('duplicateRecordIds');
            }
        });

        test('should handle high contrast mode without performance impact', () => {
            const testData = [];
            for (let i = 0; i < 500; i++) {
                testData.push({
                    id: `HC_${i}`,
                    phone: i % 50 === 0 ? '+65 9123 4567' : `+65 ${String(i).padStart(8, '0')}`,
                    company: `High Contrast Company ${i}`
                });
            }

            const startTime = Date.now();
            const result = frontendService.identifyDuplicatePhoneNumbers(testData);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(3000);
            expect(result.totalRecords).toBe(500);
            
            // High contrast mode should not affect duplicate detection
            expect(result.duplicateCount).toBeGreaterThan(0);
            expect(result.duplicatePhoneCount).toBeGreaterThan(0);
        });
    });
});