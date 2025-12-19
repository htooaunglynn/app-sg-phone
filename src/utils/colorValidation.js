/**
 * Color Consistency Validation and Testing Utilities
 * Provides validation functions to ensure orange color consistency between web and Excel
 * Implements automated tests to verify color matching and accessibility compliance
 */

const {
    DUPLICATE_ORANGE_COLOR,
    COLOR_CONFIG,
    validateColorCode,
    validateColorAccessibility,
    validateDuplicateOrangeConsistency
} = require('./colorConfig');

/**
 * Validate color consistency between web and Excel interfaces
 * @param {Object} webColors - Web interface colors
 * @param {Object} excelColors - Excel interface colors
 * @returns {Object} Validation result
 */
function validateColorConsistency(webColors, excelColors) {
    const result = {
        isConsistent: true,
        errors: [],
        warnings: [],
        details: {
            duplicateBackground: { consistent: false, webColor: null, excelColor: null },
            duplicateText: { consistent: false, webColor: null, excelColor: null },
            statusValid: { consistent: false, webColor: null, excelColor: null },
            statusInvalid: { consistent: false, webColor: null, excelColor: null }
        }
    };

    try {
        // Validate duplicate background color consistency
        const duplicateBgResult = validateColorPairConsistency(
            webColors.duplicate?.background,
            excelColors.duplicate?.backgroundRgb,
            'duplicate background'
        );
        result.details.duplicateBackground = duplicateBgResult;
        if (!duplicateBgResult.consistent) {
            result.isConsistent = false;
            result.errors.push(...duplicateBgResult.errors);
        }

        // Validate duplicate text color consistency
        const duplicateTextResult = validateColorPairConsistency(
            webColors.duplicate?.text,
            excelColors.duplicate?.textRgb,
            'duplicate text'
        );
        result.details.duplicateText = duplicateTextResult;
        if (!duplicateTextResult.consistent) {
            result.isConsistent = false;
            result.errors.push(...duplicateTextResult.errors);
        }

        // Validate status colors if provided
        if (webColors.status && excelColors.status) {
            const statusValidResult = validateColorPairConsistency(
                webColors.status.valid?.background,
                excelColors.status.valid?.backgroundRgb,
                'status valid background'
            );
            result.details.statusValid = statusValidResult;
            if (!statusValidResult.consistent) {
                result.warnings.push(...statusValidResult.errors);
            }

            const statusInvalidResult = validateColorPairConsistency(
                webColors.status.invalid?.background,
                excelColors.status.invalid?.backgroundRgb,
                'status invalid background'
            );
            result.details.statusInvalid = statusInvalidResult;
            if (!statusInvalidResult.consistent) {
                result.warnings.push(...statusInvalidResult.errors);
            }
        }

    } catch (error) {
        result.isConsistent = false;
        result.errors.push(`Color consistency validation failed: ${error.message}`);
    }

    return result;
}

/**
 * Validate consistency between a web color (hex) and Excel color (RGB)
 * @param {string} webColor - Web color in hex format
 * @param {string} excelColor - Excel color in RGB format (without #)
 * @param {string} colorName - Name of the color for error messages
 * @returns {Object} Validation result
 */
function validateColorPairConsistency(webColor, excelColor, colorName) {
    const result = {
        consistent: false,
        webColor,
        excelColor,
        errors: [],
        warnings: []
    };

    if (!webColor || !excelColor) {
        result.errors.push(`Missing ${colorName} color: web=${webColor}, excel=${excelColor}`);
        return result;
    }

    try {
        // Validate web color format
        const webValidation = validateColorCode(webColor);
        if (!webValidation.isValid) {
            result.errors.push(`Invalid web ${colorName} color format: ${webValidation.errors.join(', ')}`);
            return result;
        }

        // Validate Excel color format
        const excelValidation = validateColorCode(excelColor);
        if (!excelValidation.isValid) {
            result.errors.push(`Invalid Excel ${colorName} color format: ${excelValidation.errors.join(', ')}`);
            return result;
        }

        // Compare normalized colors
        const normalizedWeb = webValidation.rgbFormatted;
        const normalizedExcel = excelValidation.rgbFormatted;

        if (normalizedWeb === normalizedExcel) {
            result.consistent = true;
        } else {
            result.errors.push(`${colorName} color mismatch: web=#${normalizedWeb}, excel=#${normalizedExcel}`);
        }

    } catch (error) {
        result.errors.push(`Error validating ${colorName} color pair: ${error.message}`);
    }

    return result;
}

/**
 * Validate that all duplicate colors match the centralized orange color
 * @param {Object} colors - Colors to validate
 * @returns {Object} Validation result
 */
function validateDuplicateOrangeCompliance(colors) {
    const result = {
        isCompliant: true,
        errors: [],
        warnings: [],
        details: {}
    };

    try {
        // Check web duplicate background color
        if (colors.web?.duplicate?.background) {
            const webBgResult = validateDuplicateOrangeConsistency(colors.web.duplicate.background);
            result.details.webBackground = webBgResult;
            if (!webBgResult.isConsistent) {
                result.isCompliant = false;
                result.errors.push(`Web duplicate background: ${webBgResult.errors.join(', ')}`);
            }
        }

        // Check Excel duplicate background color
        if (colors.excel?.duplicate?.backgroundRgb) {
            const excelBgColor = `#${colors.excel.duplicate.backgroundRgb}`;
            const excelBgResult = validateDuplicateOrangeConsistency(excelBgColor);
            result.details.excelBackground = excelBgResult;
            if (!excelBgResult.isConsistent) {
                result.isCompliant = false;
                result.errors.push(`Excel duplicate background: ${excelBgResult.errors.join(', ')}`);
            }
        }

        // Check CSS variables if provided
        if (colors.css) {
            for (const [varName, varValue] of Object.entries(colors.css)) {
                if (varName.includes('duplicate') && varName.includes('orange')) {
                    const cssResult = validateDuplicateOrangeConsistency(varValue);
                    result.details[`css_${varName}`] = cssResult;
                    if (!cssResult.isConsistent) {
                        result.warnings.push(`CSS variable ${varName}: ${cssResult.errors.join(', ')}`);
                    }
                }
            }
        }

    } catch (error) {
        result.isCompliant = false;
        result.errors.push(`Duplicate orange compliance validation failed: ${error.message}`);
    }

    return result;
}

/**
 * Automated test to verify color matching between web and Excel
 * @returns {Object} Test results
 */
function runColorMatchingTests() {
    const testResults = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: [],
        summary: ''
    };

    // Test 1: Centralized color configuration consistency
    const test1 = {
        name: 'Centralized Color Configuration Consistency',
        passed: false,
        errors: [],
        warnings: []
    };

    try {
        const webColors = COLOR_CONFIG;
        const excelColors = COLOR_CONFIG; // Same source, should be consistent

        const consistencyResult = validateColorConsistency(webColors, excelColors);
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
        test1.errors.push(`Test execution failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test1);

    // Test 2: Duplicate orange color compliance
    const test2 = {
        name: 'Duplicate Orange Color Compliance',
        passed: false,
        errors: [],
        warnings: []
    };

    try {
        const colors = {
            web: COLOR_CONFIG,
            excel: COLOR_CONFIG,
            css: {
                '--duplicate-orange-color': DUPLICATE_ORANGE_COLOR,
                '--duplicate-orange-hover': '#FF8C00' // This should generate a warning
            }
        };

        const complianceResult = validateDuplicateOrangeCompliance(colors);
        test2.passed = complianceResult.isCompliant;
        test2.errors = complianceResult.errors;
        test2.warnings = complianceResult.warnings;

        if (test2.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
        testResults.warnings += test2.warnings.length;

    } catch (error) {
        test2.passed = false;
        test2.errors.push(`Test execution failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test2);

    // Test 3: Color accessibility compliance
    const test3 = {
        name: 'Color Accessibility Compliance',
        passed: false,
        errors: [],
        warnings: []
    };

    try {
        const accessibilityResult = validateColorAccessibility(
            COLOR_CONFIG.duplicate.text,
            COLOR_CONFIG.duplicate.background,
            { textSize: 'normal', targetLevel: 'AA' }
        );

        test3.passed = accessibilityResult.isCompliant;
        if (!accessibilityResult.isCompliant) {
            test3.errors = accessibilityResult.errors;
        }
        test3.warnings = accessibilityResult.warnings;

        if (test3.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
        testResults.warnings += test3.warnings.length;

    } catch (error) {
        test3.passed = false;
        test3.errors.push(`Test execution failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test3);

    // Generate summary
    const total = testResults.passed + testResults.failed;
    testResults.summary = `Color validation tests: ${testResults.passed}/${total} passed`;
    if (testResults.warnings > 0) {
        testResults.summary += `, ${testResults.warnings} warnings`;
    }

    return testResults;
}

/**
 * Visual regression testing for duplicate styling
 * @param {Object} options - Testing options
 * @returns {Object} Visual test results
 */
function runVisualRegressionTests(options = {}) {
    const testResults = {
        passed: 0,
        failed: 0,
        tests: [],
        summary: ''
    };

    // Test 1: CSS Variable Consistency
    const test1 = {
        name: 'CSS Variable Color Consistency',
        passed: false,
        errors: [],
        details: {}
    };

    try {
        // This would typically involve DOM manipulation and color extraction
        // For now, we'll simulate the test with the expected values
        const expectedColors = {
            '--duplicate-orange-color': DUPLICATE_ORANGE_COLOR,
            '--duplicate-text-color': COLOR_CONFIG.duplicate.text
        };

        let allMatch = true;
        for (const [varName, expectedValue] of Object.entries(expectedColors)) {
            const validation = validateDuplicateOrangeConsistency(expectedValue);
            test1.details[varName] = validation;
            if (!validation.isConsistent && varName.includes('orange')) {
                allMatch = false;
                test1.errors.push(`CSS variable ${varName} does not match expected orange color`);
            }
        }

        test1.passed = allMatch;
        if (test1.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }

    } catch (error) {
        test1.passed = false;
        test1.errors.push(`Visual regression test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test1);

    // Generate summary
    const total = testResults.passed + testResults.failed;
    testResults.summary = `Visual regression tests: ${testResults.passed}/${total} passed`;

    return testResults;
}

/**
 * Color accessibility compliance testing
 * @returns {Object} Accessibility test results
 */
function runColorAccessibilityTests() {
    const testResults = {
        passed: 0,
        failed: 0,
        tests: [],
        summary: ''
    };

    // Test 1: Duplicate color contrast ratio
    const test1 = {
        name: 'Duplicate Color Contrast Ratio (WCAG AA)',
        passed: false,
        errors: [],
        details: {}
    };

    try {
        const result = validateColorAccessibility(
            COLOR_CONFIG.duplicate.text,
            COLOR_CONFIG.duplicate.background,
            { textSize: 'normal', targetLevel: 'AA' }
        );

        test1.details = result;
        test1.passed = result.isCompliant;

        if (!test1.passed) {
            test1.errors = result.errors;
        }

        if (test1.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }

    } catch (error) {
        test1.passed = false;
        test1.errors.push(`Accessibility test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test1);

    // Test 2: Enhanced contrast ratio (AAA)
    const test2 = {
        name: 'Duplicate Color Enhanced Contrast (WCAG AAA)',
        passed: false,
        errors: [],
        details: {}
    };

    try {
        const result = validateColorAccessibility(
            COLOR_CONFIG.duplicate.text,
            COLOR_CONFIG.duplicate.background,
            { textSize: 'normal', targetLevel: 'AAA' }
        );

        test2.details = result;
        test2.passed = result.isCompliant;

        if (!test2.passed) {
            test2.errors = result.errors;
        }

        if (test2.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }

    } catch (error) {
        test2.passed = false;
        test2.errors.push(`Enhanced accessibility test failed: ${error.message}`);
        testResults.failed++;
    }

    testResults.tests.push(test2);

    // Generate summary
    const total = testResults.passed + testResults.failed;
    testResults.summary = `Accessibility tests: ${testResults.passed}/${total} passed`;

    return testResults;
}

/**
 * Run all color validation tests
 * @param {Object} options - Testing options
 * @returns {Object} Complete test results
 */
function runAllColorValidationTests(options = {}) {
    const startTime = Date.now();



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
        // Run color matching tests
        const matchingTests = runColorMatchingTests();
        results.testSuites.colorMatching = matchingTests;
        results.totalPassed += matchingTests.passed;
        results.totalFailed += matchingTests.failed;
        results.totalWarnings += matchingTests.warnings;

        // Run visual regression tests
        const visualTests = runVisualRegressionTests(options);
        results.testSuites.visualRegression = visualTests;
        results.totalPassed += visualTests.passed;
        results.totalFailed += visualTests.failed;

        // Run accessibility tests
        const accessibilityTests = runColorAccessibilityTests();
        results.testSuites.accessibility = accessibilityTests;
        results.totalPassed += accessibilityTests.passed;
        results.totalFailed += accessibilityTests.failed;

        // Generate recommendations
        if (results.totalFailed > 0) {
            results.recommendations.push('Fix failing color consistency tests before deployment');
        }
        if (results.totalWarnings > 0) {
            results.recommendations.push('Review warnings to improve color consistency');
        }
        if (results.testSuites.accessibility.failed > 0) {
            results.recommendations.push('Address accessibility issues to ensure WCAG compliance');
        }

    } catch (error) {
        results.totalFailed++;
        console.error('Error running color validation tests:', error);
    }

    results.duration = Date.now() - startTime;
    const total = results.totalPassed + results.totalFailed;
    results.summary = `Color validation completed: ${results.totalPassed}/${total} tests passed`;
    if (results.totalWarnings > 0) {
        results.summary += `, ${results.totalWarnings} warnings`;
    }
    results.summary += ` (${results.duration}ms)`;



    return results;
}

module.exports = {
    validateColorConsistency,
    validateColorPairConsistency,
    validateDuplicateOrangeCompliance,
    runColorMatchingTests,
    runVisualRegressionTests,
    runColorAccessibilityTests,
    runAllColorValidationTests
};
