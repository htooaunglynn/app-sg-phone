/**
 * Frontend Color Consistency Validation and Testing
 * Browser-based validation functions to ensure orange color consistency
 * Provides real-time validation of CSS variables and computed styles
 */

/**
 * Validate color consistency between CSS variables and JavaScript configuration
 * @returns {Object} Validation result
 */
function validateFrontendColorConsistency() {
    const result = {
        isConsistent: true,
        errors: [],
        warnings: [],
        details: {}
    };

    try {
        if (typeof COLOR_CONFIG === 'undefined') {
            result.isConsistent = false;
            result.errors.push('COLOR_CONFIG is not available');
            return result;
        }

        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);

        // Check duplicate orange color consistency
        const cssOrangeColor = computedStyle.getPropertyValue('--duplicate-orange-color').trim();
        const jsOrangeColor = COLOR_CONFIG.duplicate.background;

        result.details.duplicateOrange = {
            css: cssOrangeColor,
            js: jsOrangeColor,
            consistent: cssOrangeColor.toUpperCase() === jsOrangeColor.toUpperCase()
        };

        if (!result.details.duplicateOrange.consistent) {
            result.isConsistent = false;
            result.errors.push(`Duplicate orange color mismatch: CSS=${cssOrangeColor}, JS=${jsOrangeColor}`);
        }

        // Check duplicate text color consistency
        const cssTextColor = computedStyle.getPropertyValue('--duplicate-text-color').trim();
        const jsTextColor = COLOR_CONFIG.duplicate.text;

        result.details.duplicateText = {
            css: cssTextColor,
            js: jsTextColor,
            consistent: cssTextColor.toUpperCase() === jsTextColor.toUpperCase()
        };

        if (!result.details.duplicateText.consistent) {
            result.isConsistent = false;
            result.errors.push(`Duplicate text color mismatch: CSS=${cssTextColor}, JS=${jsTextColor}`);
        }

    } catch (error) {
        result.isConsistent = false;
        result.errors.push(`Frontend color consistency validation failed: ${error.message}`);
    }

    return result;
}

/**
 * Validate that duplicate table rows are using the correct orange color
 * @returns {Object} Validation result
 */
function validateDuplicateTableStyling() {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {
            duplicateRows: [],
            colorMatches: 0,
            colorMismatches: 0
        }
    };

    try {
        const duplicateRows = document.querySelectorAll('.records-table tr.duplicate-phone-record');
        const expectedColor = COLOR_CONFIG?.duplicate?.background || DUPLICATE_ORANGE_COLOR;

        for (const row of duplicateRows) {
            const computedStyle = getComputedStyle(row);
            const backgroundColor = computedStyle.backgroundColor;
            
            // Convert RGB to hex for comparison
            const hexColor = rgbToHex(backgroundColor);
            const isMatch = hexColor && hexColor.toUpperCase() === expectedColor.toUpperCase();

            const rowInfo = {
                element: row,
                computedColor: backgroundColor,
                hexColor: hexColor,
                expectedColor: expectedColor,
                isMatch: isMatch
            };

            result.details.duplicateRows.push(rowInfo);

            if (isMatch) {
                result.details.colorMatches++;
            } else {
                result.details.colorMismatches++;
                result.errors.push(`Row has incorrect background color: expected ${expectedColor}, got ${hexColor || backgroundColor}`);
            }
        }

        if (result.details.colorMismatches > 0) {
            result.isValid = false;
        }

        if (duplicateRows.length === 0) {
            result.warnings.push('No duplicate phone record rows found in the table');
        }

    } catch (error) {
        result.isValid = false;
        result.errors.push(`Duplicate table styling validation failed: ${error.message}`);
    }

    return result;
}

/**
 * Convert RGB color to hex format
 * @param {string} rgb - RGB color string (e.g., "rgb(255, 165, 0)")
 * @returns {string|null} Hex color string or null if invalid
 */
function rgbToHex(rgb) {
    if (!rgb) return null;
    
    // Handle hex colors that are already in hex format
    if (rgb.startsWith('#')) {
        return rgb;
    }
    
    // Parse RGB values
    const rgbMatch = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return null;
    
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    
    // Convert to hex
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Run visual regression tests for duplicate styling
 * @returns {Object} Test results
 */
function runFrontendVisualTests() {
    const testResults = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: [],
        summary: ''
    };

    // Test 1: CSS Variable Consistency
    const test1 = {
        name: 'CSS Variable Consistency',
        passed: false,
        errors: [],
        warnings: [],
        details: {}
    };

    try {
        const consistencyResult = validateFrontendColorConsistency();
        test1.details = consistencyResult.details;
        test1.passed = consistencyResult.isConsistent;
        test1.errors = consistencyResult.errors;
        test1.warnings = consistencyResult.warnings;

        if (test1.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
        testResults.warnings += test1.warnings.length;

    } catch (error) {
        test1.passed = false;
        test1.errors.push(`CSS variable test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test1);

    // Test 2: Duplicate Table Row Styling
    const test2 = {
        name: 'Duplicate Table Row Styling',
        passed: false,
        errors: [],
        warnings: [],
        details: {}
    };

    try {
        const stylingResult = validateDuplicateTableStyling();
        test2.details = stylingResult.details;
        test2.passed = stylingResult.isValid;
        test2.errors = stylingResult.errors;
        test2.warnings = stylingResult.warnings;

        if (test2.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
        testResults.warnings += test2.warnings.length;

    } catch (error) {
        test2.passed = false;
        test2.errors.push(`Table styling test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test2);

    // Generate summary
    const total = testResults.passed + testResults.failed;
    testResults.summary = `Frontend visual tests: ${testResults.passed}/${total} passed`;
    if (testResults.warnings > 0) {
        testResults.summary += `, ${testResults.warnings} warnings`;
    }

    return testResults;
}

/**
 * Test color accessibility in the browser
 * @returns {Object} Accessibility test results
 */
function runFrontendAccessibilityTests() {
    const testResults = {
        passed: 0,
        failed: 0,
        tests: [],
        summary: ''
    };

    // Test 1: Duplicate Color Contrast
    const test1 = {
        name: 'Duplicate Color Contrast Ratio',
        passed: false,
        errors: [],
        details: {}
    };

    try {
        if (typeof COLOR_CONFIG !== 'undefined') {
            const contrastRatio = calculateContrastRatio(
                COLOR_CONFIG.duplicate.text,
                COLOR_CONFIG.duplicate.background
            );

            test1.details = {
                foreground: COLOR_CONFIG.duplicate.text,
                background: COLOR_CONFIG.duplicate.background,
                contrastRatio: Math.round(contrastRatio * 100) / 100,
                wcagAA: contrastRatio >= 4.5,
                wcagAAA: contrastRatio >= 7.0
            };

            test1.passed = test1.details.wcagAA;
            
            if (!test1.passed) {
                test1.errors.push(`Contrast ratio ${test1.details.contrastRatio}:1 is below WCAG AA requirement (4.5:1)`);
            }

            if (test1.passed) {
                testResults.passed++;
            } else {
                testResults.failed++;
            }
        } else {
            test1.passed = false;
            test1.errors.push('COLOR_CONFIG not available for accessibility testing');
            testResults.failed++;
        }

    } catch (error) {
        test1.passed = false;
        test1.errors.push(`Accessibility test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test1);

    // Generate summary
    const total = testResults.passed + testResults.failed;
    testResults.summary = `Accessibility tests: ${testResults.passed}/${total} passed`;

    return testResults;
}

/**
 * Calculate contrast ratio between two colors (simplified version)
 * @param {string} foreground - Foreground color (hex)
 * @param {string} background - Background color (hex)
 * @returns {number} Contrast ratio
 */
function calculateContrastRatio(foreground, background) {
    try {
        const fgLuminance = getRelativeLuminance(foreground);
        const bgLuminance = getRelativeLuminance(background);
        
        const lighter = Math.max(fgLuminance, bgLuminance);
        const darker = Math.min(fgLuminance, bgLuminance);
        
        return (lighter + 0.05) / (darker + 0.05);
    } catch (error) {
        console.warn('Failed to calculate contrast ratio:', error);
        return 0;
    }
}

/**
 * Get relative luminance of a color (simplified version)
 * @param {string} color - Hex color code
 * @returns {number} Relative luminance
 */
function getRelativeLuminance(color) {
    const rgb = hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB (simplified version)
 * @param {string} hex - Hex color code
 * @returns {Object|null} RGB object or null if invalid
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Run all frontend color validation tests
 * @returns {Object} Complete test results
 */
function runAllFrontendColorTests() {
    const startTime = Date.now();
    
    console.log('Running frontend color validation tests...');
    
    const results = {
        timestamp: new Date().toISOString(),
        duration: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalWarnings: 0,
        testSuites: {},
        summary: '',
        recommendations: []
    };

    try {
        // Run visual tests
        const visualTests = runFrontendVisualTests();
        results.testSuites.visual = visualTests;
        results.totalPassed += visualTests.passed;
        results.totalFailed += visualTests.failed;
        results.totalWarnings += visualTests.warnings;

        // Run accessibility tests
        const accessibilityTests = runFrontendAccessibilityTests();
        results.testSuites.accessibility = accessibilityTests;
        results.totalPassed += accessibilityTests.passed;
        results.totalFailed += accessibilityTests.failed;

        // Generate recommendations
        if (results.totalFailed > 0) {
            results.recommendations.push('Fix failing color consistency tests');
        }
        if (results.totalWarnings > 0) {
            results.recommendations.push('Review warnings to improve color consistency');
        }

    } catch (error) {
        results.totalFailed++;
        console.error('Error running frontend color validation tests:', error);
    }

    results.duration = Date.now() - startTime;
    const total = results.totalPassed + results.totalFailed;
    results.summary = `Frontend color validation completed: ${results.totalPassed}/${total} tests passed`;
    if (results.totalWarnings > 0) {
        results.summary += `, ${results.totalWarnings} warnings`;
    }
    results.summary += ` (${results.duration}ms)`;

    console.log(results.summary);
    
    return results;
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.validateFrontendColorConsistency = validateFrontendColorConsistency;
    window.validateDuplicateTableStyling = validateDuplicateTableStyling;
    window.runFrontendVisualTests = runFrontendVisualTests;
    window.runFrontendAccessibilityTests = runFrontendAccessibilityTests;
    window.runAllFrontendColorTests = runAllFrontendColorTests;
    window.rgbToHex = rgbToHex;
    window.calculateContrastRatio = calculateContrastRatio;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateFrontendColorConsistency,
        validateDuplicateTableStyling,
        runFrontendVisualTests,
        runFrontendAccessibilityTests,
        runAllFrontendColorTests,
        rgbToHex,
        calculateContrastRatio
    };
}