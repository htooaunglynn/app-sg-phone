/**
 * Excel Styling Configuration and Utilities
 * Provides centralized styling configuration and utility functions for Excel exports
 */

const { DUPLICATE_ORANGE_COLOR, COLOR_CONFIG, validateColorCode, validateDuplicateOrangeConsistency } = require('./colorConfig');

/**
 * Centralized styling configuration object with Aptos Narrow font, 12pt size,
 * center alignment, and status-based color schemes
 * Updated to use XLSX-compatible format
 */
const EXCEL_STYLING_CONFIG = {
    // Base font configuration with fallback support
    font: {
        name: 'Aptos Narrow',
        sz: 12,  // Use 'sz' instead of 'size' for XLSX compatibility
        color: { rgb: '000000' } // Black
    },

    // Font fallback hierarchy for compatibility
    fontFallbacks: [
        'Aptos Narrow',
        'Aptos',
        'Calibri',
        'Arial'
    ],

    // Base alignment configuration
    alignment: {
        horizontal: 'center',
        vertical: 'center'
    },

    // Default border configuration for all cells
    border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    },

    // Status-based conditional formatting
    statusFormatting: {
        false: {
            fill: {
                patternType: 'solid',
                fgColor: { rgb: 'FF0000' } // Red background
            },
            font: {
                name: 'Aptos Narrow',
                sz: 12,  // Use 'sz' for XLSX compatibility
                color: { rgb: '000000' } // Black font
            },
            alignment: {
                horizontal: 'center',
                vertical: 'center'
            }
        },
        true: {
            fill: {
                patternType: 'solid',
                fgColor: { rgb: 'FFFFFF' } // White background
            },
            font: {
                name: 'Aptos Narrow',
                sz: 12,  // Use 'sz' for XLSX compatibility
                color: { rgb: '000000' } // Black font
            },
            alignment: {
                horizontal: 'center',
                vertical: 'center'
            }
        }
    },

    // Header row formatting
    header: {
        font: {
            name: 'Aptos Narrow',
            sz: 12,  // Use 'sz' for XLSX compatibility
            bold: true,
            color: { rgb: '000000' } // Black font
        },
        alignment: {
            horizontal: 'center',
            vertical: 'center'
        },
        fill: {
            patternType: 'solid',
            fgColor: { rgb: 'E6E6FA' } // Light lavender background (existing)
        }
    }
};

/**
 * Duplicate phone number styling configuration
 * Uses centralized color configuration for consistent orange background styling
 */
const DUPLICATE_STYLING_CONFIG = {
    duplicate: {
        fill: {
            patternType: 'solid',
            fgColor: { rgb: COLOR_CONFIG.duplicate.backgroundRgb } // Orange background from centralized config
        },
        font: {
            name: 'Aptos Narrow',
            sz: 12,  // Use 'sz' for XLSX compatibility
            color: { rgb: COLOR_CONFIG.duplicate.textRgb } // Black font from centralized config
        },
        alignment: {
            horizontal: 'center',
            vertical: 'center'
        }
    }
};

/**
 * Font fallback logic for compatibility with different Excel versions
 * @param {string} preferredFont - The preferred font name
 * @returns {string} Available font name with fallback
 */
function getFontWithFallback(preferredFont = 'Aptos Narrow') {
    // In a real implementation, you might check font availability
    // For now, we'll use the fallback hierarchy
    const fallbacks = EXCEL_STYLING_CONFIG.fontFallbacks;

    if (fallbacks.includes(preferredFont)) {
        return preferredFont;
    }

    // Return first fallback if preferred font not in list
    return fallbacks[0];
}

/**
 * Create base style object with font and alignment
 * @param {Object} options - Style options
 * @returns {Object} XLSX style object
 */
function createBaseStyle(options = {}) {
    const fontName = getFontWithFallback(options.fontName);

    return {
        font: {
            name: fontName,
            sz: options.fontSize || EXCEL_STYLING_CONFIG.font.sz,  // Use 'sz' for XLSX
            color: options.fontColor || EXCEL_STYLING_CONFIG.font.color,
            bold: options.bold || false
        },
        alignment: {
            horizontal: options.horizontalAlign || EXCEL_STYLING_CONFIG.alignment.horizontal,
            vertical: options.verticalAlign || EXCEL_STYLING_CONFIG.alignment.vertical
        },
        border: options.border || EXCEL_STYLING_CONFIG.border // Apply default border
    };
}

/**
 * Create status-based style object
 * @param {boolean} status - Status value (true/false)
 * @param {Object} options - Additional style options
 * @returns {Object} XLSX style object with conditional formatting
 */
function createStatusStyle(status, options = {}) {
    const statusConfig = EXCEL_STYLING_CONFIG.statusFormatting[status];

    if (!statusConfig) {
        // Return base style if status not recognized
        return createBaseStyle(options);
    }

    const fontName = getFontWithFallback(statusConfig.font.name);

    return {
        font: {
            name: fontName,
            sz: statusConfig.font.sz,  // Use 'sz' for XLSX
            color: statusConfig.font.color,
            bold: options.bold || false
        },
        alignment: statusConfig.alignment,
        fill: statusConfig.fill,
        border: options.border || EXCEL_STYLING_CONFIG.border // Apply default border
    };
}

/**
 * Create header style object
 * @param {Object} options - Additional style options
 * @returns {Object} XLSX style object for headers
 */
function createHeaderStyle(options = {}) {
    const headerConfig = EXCEL_STYLING_CONFIG.header;
    const fontName = getFontWithFallback(headerConfig.font.name);

    return {
        font: {
            name: fontName,
            sz: headerConfig.font.sz,  // Use 'sz' for XLSX
            color: headerConfig.font.color,
            bold: headerConfig.font.bold
        },
        alignment: headerConfig.alignment,
        fill: options.preserveExistingFill ? headerConfig.fill : (options.fill || headerConfig.fill),
        border: options.border || EXCEL_STYLING_CONFIG.border // Apply default border
    };
}

/**
 * Create duplicate phone number style object with orange background
 * @param {Object} options - Additional style options
 * @returns {Object} XLSX style object for duplicate phone records
 */
function createDuplicateStyle(options = {}) {
    const duplicateConfig = DUPLICATE_STYLING_CONFIG.duplicate;
    const fontName = getFontWithFallback(duplicateConfig.font.name);

    return {
        font: {
            name: fontName,
            sz: duplicateConfig.font.sz,  // Use 'sz' for XLSX
            color: duplicateConfig.font.color,
            bold: options.bold || false
        },
        alignment: duplicateConfig.alignment,
        fill: duplicateConfig.fill,
        border: options.border || EXCEL_STYLING_CONFIG.border // Apply default border
    };
}

/**
 * Validate style object structure before application
 * @param {Object} styleObj - XLSX style object to validate
 * @returns {Object} Validation result
 */
function validateStyleObject(styleObj) {
    const result = {
        valid: true,
        errors: [],
        warnings: []
    };

    if (!styleObj || typeof styleObj !== 'object') {
        result.valid = false;
        result.errors.push('Style object must be a valid object');
        return result;
    }

    // Validate font structure
    if (styleObj.font) {
        if (typeof styleObj.font !== 'object') {
            result.valid = false;
            result.errors.push('Font property must be an object');
        } else {
            // Check font name
            if (styleObj.font.name && typeof styleObj.font.name !== 'string') {
                result.valid = false;
                result.errors.push('Font name must be a string');
            }

            // Check font size (XLSX uses 'sz' property)
            if (styleObj.font.sz && (typeof styleObj.font.sz !== 'number' || styleObj.font.sz <= 0)) {
                result.valid = false;
                result.errors.push('Font size must be a positive number');
            }

            // Check legacy 'size' property
            if (styleObj.font.size && (typeof styleObj.font.size !== 'number' || styleObj.font.size <= 0)) {
                result.warnings.push('Legacy font.size property detected, should use font.sz for XLSX compatibility');
            }

            // Check font color
            if (styleObj.font.color && (!styleObj.font.color.rgb || !isValidColorCode(styleObj.font.color.rgb))) {
                result.warnings.push('Font color should have valid RGB hex code');
            }
        }
    }

    // Validate alignment structure
    if (styleObj.alignment) {
        if (typeof styleObj.alignment !== 'object') {
            result.valid = false;
            result.errors.push('Alignment property must be an object');
        } else {
            const validHorizontal = ['left', 'center', 'right', 'fill', 'justify'];
            const validVertical = ['top', 'center', 'bottom', 'justify'];

            if (styleObj.alignment.horizontal && !validHorizontal.includes(styleObj.alignment.horizontal)) {
                result.warnings.push(`Invalid horizontal alignment: ${styleObj.alignment.horizontal}`);
            }

            if (styleObj.alignment.vertical && !validVertical.includes(styleObj.alignment.vertical)) {
                result.warnings.push(`Invalid vertical alignment: ${styleObj.alignment.vertical}`);
            }
        }
    }

    // Validate fill structure
    if (styleObj.fill) {
        if (typeof styleObj.fill !== 'object') {
            result.valid = false;
            result.errors.push('Fill property must be an object');
        } else {
            if (styleObj.fill.fgColor && (!styleObj.fill.fgColor.rgb || !isValidColorCode(styleObj.fill.fgColor.rgb))) {
                result.warnings.push('Fill color should have valid RGB hex code');
            }
        }
    }

    return result;
}

/**
 * Validate and format color code
 * @param {string} colorCode - RGB hex color code
 * @returns {boolean} True if valid color code
 */
function isValidColorCode(colorCode) {
    if (typeof colorCode !== 'string') {
        return false;
    }

    // Remove # if present
    const cleanCode = colorCode.replace('#', '');

    // Check if it's a valid 6-character hex code
    const hexPattern = /^[0-9A-Fa-f]{6}$/;
    return hexPattern.test(cleanCode);
}

/**
 * Format color code to ensure proper format
 * @param {string} colorCode - RGB hex color code
 * @returns {string} Properly formatted color code
 */
function formatColorCode(colorCode) {
    if (!colorCode || typeof colorCode !== 'string') {
        return '000000'; // Default to black
    }

    // Remove # if present and convert to uppercase
    let cleanCode = colorCode.replace('#', '').toUpperCase();

    // Validate and return
    if (isValidColorCode(cleanCode)) {
        return cleanCode;
    }

    // Return default if invalid
    return '000000';
}

/**
 * Get complete styling configuration
 * @returns {Object} Complete styling configuration object
 */
function getStylingConfig() {
    return { ...EXCEL_STYLING_CONFIG };
}

/**
 * Create style object for specific cell type
 * @param {string} cellType - Type of cell ('header', 'data', 'status', 'duplicate')
 * @param {*} value - Cell value (for status-based styling)
 * @param {Object} options - Additional options
 * @returns {Object} XLSX style object
 */
function createCellStyle(cellType, value = null, options = {}) {
    switch (cellType) {
        case 'header':
            return createHeaderStyle(options);

        case 'duplicate':
            return createDuplicateStyle(options);

        case 'status':
            if (typeof value === 'boolean') {
                return createStatusStyle(value, options);
            }
        // Fall through to data style if not boolean

        case 'data':
        default:
            return createBaseStyle(options);
    }
}

/**
 * Apply font fallback logic to existing style object
 * @param {Object} styleObj - Existing style object
 * @returns {Object} Style object with font fallback applied
 */
function applyFontFallback(styleObj) {
    if (!styleObj || !styleObj.font) {
        return styleObj;
    }

    const updatedStyle = { ...styleObj };
    updatedStyle.font = { ...styleObj.font };
    updatedStyle.font.name = getFontWithFallback(styleObj.font.name);

    return updatedStyle;
}

/**
 * Comprehensive validation for XLSX styling object structure before application
 * @param {Object} styleObj - XLSX style object to validate
 * @param {Object} options - Validation options
 * @returns {Object} Detailed validation result
 */
function validateXLSXStyleObject(styleObj, options = {}) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        corrected: false,
        correctedStyle: null
    };

    try {
        // Basic structure validation
        if (!styleObj || typeof styleObj !== 'object') {
            result.valid = false;
            result.errors.push('Style object must be a valid object');
            return result;
        }

        let correctedStyle = { ...styleObj };

        // Validate and correct font structure
        if (styleObj.font) {
            const fontValidation = validateFontStructure(styleObj.font, options);
            if (!fontValidation.valid) {
                result.errors.push(...fontValidation.errors);
                result.valid = false;
            }
            if (fontValidation.warnings.length > 0) {
                result.warnings.push(...fontValidation.warnings);
            }
            if (fontValidation.corrected) {
                correctedStyle.font = fontValidation.correctedFont;
                result.corrected = true;
            }
        }

        // Validate and correct alignment structure
        if (styleObj.alignment) {
            const alignmentValidation = validateAlignmentStructure(styleObj.alignment);
            if (!alignmentValidation.valid) {
                result.errors.push(...alignmentValidation.errors);
                result.valid = false;
            }
            if (alignmentValidation.warnings.length > 0) {
                result.warnings.push(...alignmentValidation.warnings);
            }
            if (alignmentValidation.corrected) {
                correctedStyle.alignment = alignmentValidation.correctedAlignment;
                result.corrected = true;
            }
        }

        // Validate and correct fill structure
        if (styleObj.fill) {
            const fillValidation = validateFillStructure(styleObj.fill);
            if (!fillValidation.valid) {
                result.errors.push(...fillValidation.errors);
                result.valid = false;
            }
            if (fillValidation.warnings.length > 0) {
                result.warnings.push(...fillValidation.warnings);
            }
            if (fillValidation.corrected) {
                correctedStyle.fill = fillValidation.correctedFill;
                result.corrected = true;
            }
        }

        // Validate duplicate styling if present
        if (options.isDuplicateStyle) {
            const duplicateValidation = validateDuplicateStyleStructure(correctedStyle);
            if (!duplicateValidation.valid) {
                result.warnings.push(...duplicateValidation.warnings);
            }
            if (duplicateValidation.corrected) {
                correctedStyle = duplicateValidation.correctedStyle;
                result.corrected = true;
            }
        }

        // Validate XLSX library compatibility
        const compatibilityValidation = validateXLSXCompatibility(correctedStyle);
        if (!compatibilityValidation.valid) {
            result.warnings.push(...compatibilityValidation.warnings);
        }

        result.correctedStyle = result.corrected ? correctedStyle : styleObj;

    } catch (error) {
        result.valid = false;
        result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
}

/**
 * Validate font structure with comprehensive error handling
 * @param {Object} font - Font object to validate
 * @param {Object} options - Validation options
 * @returns {Object} Font validation result
 */
function validateFontStructure(font, options = {}) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        corrected: false,
        correctedFont: { ...font }
    };

    if (typeof font !== 'object') {
        result.valid = false;
        result.errors.push('Font property must be an object');
        return result;
    }

    // Validate and correct font name
    if (font.name !== undefined) {
        if (typeof font.name !== 'string' || font.name.trim() === '') {
            result.warnings.push('Invalid font name, applying fallback');
            result.correctedFont.name = getFontWithFallback();
            result.corrected = true;
        } else {
            // Check font availability and apply fallback if needed
            const availableFont = getFontWithFallback(font.name);
            if (availableFont !== font.name) {
                result.warnings.push(`Font '${font.name}' not available, using '${availableFont}'`);
                result.correctedFont.name = availableFont;
                result.corrected = true;
            }
        }
    }

    // Validate and correct font size (XLSX uses 'sz' property)
    if (font.sz !== undefined) {
        if (typeof font.sz !== 'number' || font.sz <= 0 || font.sz > 72) {
            result.warnings.push('Invalid font size, using default 12pt');
            result.correctedFont.sz = 12;
            result.corrected = true;
        }
    }

    // Support legacy 'size' property but convert to 'sz'
    if (font.size !== undefined && font.sz === undefined) {
        if (typeof font.size === 'number' && font.size > 0 && font.size <= 72) {
            result.warnings.push('Converting legacy font.size to font.sz for XLSX compatibility');
            result.correctedFont.sz = font.size;
            delete result.correctedFont.size;
            result.corrected = true;
        } else {
            result.warnings.push('Invalid legacy font size, using default 12pt');
            result.correctedFont.sz = 12;
            delete result.correctedFont.size;
            result.corrected = true;
        }
    }

    // Validate and correct font color
    if (font.color !== undefined) {
        if (!font.color || typeof font.color !== 'object' || !font.color.rgb) {
            result.warnings.push('Invalid font color structure, using default black');
            result.correctedFont.color = { rgb: '000000' };
            result.corrected = true;
        } else if (!isValidColorCode(font.color.rgb)) {
            result.warnings.push('Invalid font color code, using default black');
            result.correctedFont.color = { rgb: formatColorCode(font.color.rgb) };
            result.corrected = true;
        }
    }

    // Validate bold property
    if (font.bold !== undefined && typeof font.bold !== 'boolean') {
        result.warnings.push('Invalid bold property, converting to boolean');
        result.correctedFont.bold = Boolean(font.bold);
        result.corrected = true;
    }

    return result;
}

/**
 * Validate alignment structure with error correction
 * @param {Object} alignment - Alignment object to validate
 * @returns {Object} Alignment validation result
 */
function validateAlignmentStructure(alignment) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        corrected: false,
        correctedAlignment: { ...alignment }
    };

    if (typeof alignment !== 'object') {
        result.valid = false;
        result.errors.push('Alignment property must be an object');
        return result;
    }

    const validHorizontal = ['left', 'center', 'right', 'fill', 'justify', 'centerContinuous', 'distributed'];
    const validVertical = ['top', 'center', 'bottom', 'justify', 'distributed'];

    // Validate and correct horizontal alignment
    if (alignment.horizontal !== undefined) {
        if (typeof alignment.horizontal !== 'string' || !validHorizontal.includes(alignment.horizontal)) {
            result.warnings.push(`Invalid horizontal alignment '${alignment.horizontal}', using 'center'`);
            result.correctedAlignment.horizontal = 'center';
            result.corrected = true;
        }
    }

    // Validate and correct vertical alignment
    if (alignment.vertical !== undefined) {
        if (typeof alignment.vertical !== 'string' || !validVertical.includes(alignment.vertical)) {
            result.warnings.push(`Invalid vertical alignment '${alignment.vertical}', using 'center'`);
            result.correctedAlignment.vertical = 'center';
            result.corrected = true;
        }
    }

    return result;
}

/**
 * Validate fill structure with error correction
 * @param {Object} fill - Fill object to validate
 * @returns {Object} Fill validation result
 */
function validateFillStructure(fill) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        corrected: false,
        correctedFill: { ...fill }
    };

    if (typeof fill !== 'object') {
        result.valid = false;
        result.errors.push('Fill property must be an object');
        return result;
    }

    // Validate pattern type
    if (fill.patternType !== undefined) {
        const validPatterns = ['solid', 'none', 'gray125', 'gray0625', 'darkHorizontal', 'darkVertical', 'darkDown', 'darkUp', 'darkGrid', 'darkTrellis'];
        if (typeof fill.patternType !== 'string' || !validPatterns.includes(fill.patternType)) {
            result.warnings.push(`Invalid pattern type '${fill.patternType}', using 'solid'`);
            result.correctedFill.patternType = 'solid';
            result.corrected = true;
        }
    }

    // Validate foreground color
    if (fill.fgColor !== undefined) {
        if (!fill.fgColor || typeof fill.fgColor !== 'object' || !fill.fgColor.rgb) {
            result.warnings.push('Invalid fill foreground color structure, using default white');
            result.correctedFill.fgColor = { rgb: 'FFFFFF' };
            result.corrected = true;
        } else if (!isValidColorCode(fill.fgColor.rgb)) {
            result.warnings.push('Invalid fill color code, using corrected value');
            result.correctedFill.fgColor = { rgb: formatColorCode(fill.fgColor.rgb) };
            result.corrected = true;
        }
    }

    // Validate background color
    if (fill.bgColor !== undefined) {
        if (!fill.bgColor || typeof fill.bgColor !== 'object' || !fill.bgColor.rgb) {
            result.warnings.push('Invalid fill background color structure, removing property');
            delete result.correctedFill.bgColor;
            result.corrected = true;
        } else if (!isValidColorCode(fill.bgColor.rgb)) {
            result.warnings.push('Invalid background color code, using corrected value');
            result.correctedFill.bgColor = { rgb: formatColorCode(fill.bgColor.rgb) };
            result.corrected = true;
        }
    }

    return result;
}

/**
 * Validate duplicate style structure and ensure orange color compliance
 * @param {Object} styleObj - Style object to validate for duplicate styling
 * @returns {Object} Duplicate style validation result
 */
function validateDuplicateStyleStructure(styleObj) {
    const result = {
        valid: true,
        warnings: [],
        corrected: false,
        correctedStyle: { ...styleObj }
    };

    try {
        const expectedOrangeColor = COLOR_CONFIG.duplicate.backgroundRgb;
        
        // Validate that duplicate styling has orange background
        if (styleObj.fill && styleObj.fill.fgColor && styleObj.fill.fgColor.rgb) {
            const currentColor = styleObj.fill.fgColor.rgb.toUpperCase().replace('#', '');
            if (currentColor !== expectedOrangeColor) {
                result.warnings.push(`Duplicate style should use orange color #${expectedOrangeColor}, found #${currentColor}`);
                result.correctedStyle.fill = {
                    ...styleObj.fill,
                    fgColor: { rgb: expectedOrangeColor }
                };
                result.corrected = true;
            }
        } else {
            // Missing or invalid fill structure for duplicate style
            result.warnings.push('Duplicate style missing orange background, applying default');
            result.correctedStyle.fill = {
                patternType: 'solid',
                fgColor: { rgb: COLOR_CONFIG.duplicate.backgroundRgb }
            };
            result.corrected = true;
        }

        // Ensure text readability with black font on orange background
        if (styleObj.font && styleObj.font.color && styleObj.font.color.rgb) {
            const fontColor = styleObj.font.color.rgb.toUpperCase().replace('#', '');
            if (fontColor !== '000000') {
                result.warnings.push('Duplicate style should use black font for readability on orange background');
                result.correctedStyle.font = {
                    ...styleObj.font,
                    color: { rgb: COLOR_CONFIG.duplicate.textRgb }
                };
                result.corrected = true;
            }
        }

    } catch (error) {
        result.warnings.push(`Duplicate style validation error: ${error.message}`);
    }

    return result;
}

/**
 * Validate XLSX library compatibility
 * @param {Object} styleObj - Style object to check for compatibility
 * @returns {Object} Compatibility validation result
 */
function validateXLSXCompatibility(styleObj) {
    const result = {
        valid: true,
        warnings: []
    };

    try {
        // Check for properties that might not be supported in older XLSX versions
        if (styleObj.font && styleObj.font.scheme) {
            result.warnings.push('Font scheme property may not be supported in all XLSX versions');
        }

        if (styleObj.alignment && styleObj.alignment.readingOrder) {
            result.warnings.push('Reading order property may not be supported in all XLSX versions');
        }

        if (styleObj.protection) {
            result.warnings.push('Cell protection properties may not be supported in all XLSX versions');
        }

        // Check for complex fill patterns
        if (styleObj.fill && styleObj.fill.patternType &&
            !['solid', 'none'].includes(styleObj.fill.patternType)) {
            result.warnings.push('Complex fill patterns may not render consistently across Excel versions');
        }

    } catch (error) {
        result.warnings.push(`Compatibility check failed: ${error.message}`);
    }

    return result;
}

/**
 * Safe style application with comprehensive error handling
 * @param {Object} worksheet - XLSX worksheet object
 * @param {string} cellAddress - Cell address (e.g., 'A1')
 * @param {Object} styleObj - Style object to apply
 * @param {Object} options - Application options
 * @returns {Object} Application result
 */
function safeApplyStyle(worksheet, cellAddress, styleObj, options = {}) {
    const result = {
        success: false,
        applied: false,
        errors: [],
        warnings: []
    };

    try {
        // Validate inputs
        if (!worksheet || typeof worksheet !== 'object') {
            result.errors.push('Invalid worksheet object');
            return result;
        }

        if (!cellAddress || typeof cellAddress !== 'string') {
            result.errors.push('Invalid cell address');
            return result;
        }

        if (!worksheet[cellAddress]) {
            result.warnings.push(`Cell ${cellAddress} does not exist in worksheet`);
            return result;
        }

        // Validate style object
        const validation = validateXLSXStyleObject(styleObj, options);

        if (!validation.valid) {
            result.errors.push(...validation.errors);
            if (!options.allowPartialApplication) {
                return result;
            }
        }

        if (validation.warnings.length > 0) {
            result.warnings.push(...validation.warnings);
        }

        // Apply the style (use corrected style if available)
        const styleToApply = validation.correctedStyle || styleObj;

        try {
            worksheet[cellAddress].s = styleToApply;
            result.success = true;
            result.applied = true;

            if (validation.corrected) {
                result.warnings.push(`Style was automatically corrected for cell ${cellAddress}`);
            }

        } catch (styleError) {
            result.errors.push(`Failed to apply style to cell ${cellAddress}: ${styleError.message}`);

            // Try applying a fallback base style if original fails
            if (options.useFallbackStyle !== false) {
                try {
                    worksheet[cellAddress].s = createBaseStyle();
                    result.success = true;
                    result.applied = true;
                    result.warnings.push(`Applied fallback style to cell ${cellAddress} due to style error`);
                } catch (fallbackError) {
                    result.errors.push(`Fallback style also failed for cell ${cellAddress}: ${fallbackError.message}`);
                }
            }
        }

    } catch (error) {
        result.errors.push(`Unexpected error applying style: ${error.message}`);
    }

    return result;
}

/**
 * Log styling failures without breaking export functionality
 * @param {string} operation - The operation being performed
 * @param {Object} error - Error details
 * @param {Object} context - Additional context information
 */
function logStylingFailure(operation, error, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        operation,
        error: error.message || error,
        context,
        severity: context.severity || 'warning'
    };

    // Log to console with appropriate level
    if (logEntry.severity === 'error') {
        console.error(`[STYLING ERROR] ${timestamp} - ${operation}:`, error, context);
    } else {
        console.warn(`[STYLING WARNING] ${timestamp} - ${operation}:`, error, context);
    }

    // In a production environment, you might want to send this to a logging service
    // Example: sendToLoggingService(logEntry);
}

/**
 * Batch apply styles with error handling and logging
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} styleApplications - Array of {cellAddress, style} objects
 * @param {Object} options - Batch application options
 * @returns {Object} Batch application result
 */
function batchApplyStyles(worksheet, styleApplications, options = {}) {
    const result = {
        totalAttempted: styleApplications.length,
        successful: 0,
        failed: 0,
        warnings: 0,
        errors: [],
        warnings: []
    };

    if (!Array.isArray(styleApplications)) {
        result.errors.push('Style applications must be an array');
        return result;
    }

    for (const application of styleApplications) {
        try {
            const { cellAddress, style } = application;
            const applyResult = safeApplyStyle(worksheet, cellAddress, style, options);

            if (applyResult.success) {
                result.successful++;
            } else {
                result.failed++;
                result.errors.push(...applyResult.errors);
            }

            if (applyResult.warnings.length > 0) {
                result.warnings++;
                result.warnings.push(...applyResult.warnings);
            }

        } catch (error) {
            result.failed++;
            result.errors.push(`Batch application error: ${error.message}`);

            logStylingFailure('batchApplyStyles', error, {
                cellAddress: application.cellAddress,
                severity: 'error'
            });
        }
    }

    // Log summary if there were issues
    if (result.failed > 0 || result.warnings > 0) {
        logStylingFailure('batchApplyStyles',
            `Batch styling completed with ${result.failed} failures and ${result.warnings} warnings`,
            {
                totalAttempted: result.totalAttempted,
                successful: result.successful,
                failed: result.failed,
                warnings: result.warnings,
                severity: result.failed > 0 ? 'error' : 'warning'
            }
        );
    }

    return result;
}

/**
 * Identify duplicate phone numbers within a record array for Excel export
 * @param {Array} records - Array of records with phone number properties
 * @returns {Object} Object containing duplicate phone information
 */
function identifyDuplicatePhoneNumbers(records) {
    const result = {
        duplicatePhoneNumbers: new Set(),
        duplicateRecordIndices: [],
        phoneNumberMap: new Map(),
        totalRecords: records.length,
        duplicateCount: 0,
        uniquePhoneCount: 0
    };

    if (!Array.isArray(records) || records.length === 0) {
        return result;
    }

    // Build phone number map first
    const phoneMap = buildDuplicatePhoneMap(records);
    result.phoneNumberMap = phoneMap;

    // Identify duplicates
    for (const [phoneNumber, recordIndices] of phoneMap.entries()) {
        if (recordIndices.length > 1) {
            result.duplicatePhoneNumbers.add(phoneNumber);
            result.duplicateRecordIndices.push(...recordIndices);
            result.duplicateCount += recordIndices.length;
        }
    }

    result.uniquePhoneCount = phoneMap.size;

    return result;
}

/**
 * Build a map of phone numbers to record indices for duplicate detection
 * @param {Array} records - Array of records with phone number properties
 * @returns {Map} Map of phone numbers to array of record indices
 */
function buildDuplicatePhoneMap(records) {
    const phoneMap = new Map();

    if (!Array.isArray(records)) {
        return phoneMap;
    }

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const phoneNumber = extractPhoneNumber(record);

        if (phoneNumber) {
            const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
            
            if (sanitizedPhone) {
                if (!phoneMap.has(sanitizedPhone)) {
                    phoneMap.set(sanitizedPhone, []);
                }
                phoneMap.get(sanitizedPhone).push(i);
            }
        }
    }

    return phoneMap;
}

/**
 * Extract phone number from record with multiple field name support
 * @param {Object} record - Record object
 * @returns {string|null} Phone number or null if not found
 */
function extractPhoneNumber(record) {
    if (!record || typeof record !== 'object') {
        return null;
    }

    // Check various possible phone number field names
    const phoneFields = ['phoneNumber', 'Phone', 'phone', 'PhoneNumber', 'PHONE'];
    
    for (const field of phoneFields) {
        if (record[field] != null) {
            return String(record[field]).trim();
        }
    }

    return null;
}

/**
 * Sanitize phone number for consistent duplicate detection
 * @param {string} phoneNumber - Raw phone number string
 * @returns {string|null} Sanitized phone number or null if invalid
 */
function sanitizePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return null;
    }

    // Remove all non-digit characters except + at the beginning
    let sanitized = phoneNumber.trim();
    
    // Handle international format with +
    if (sanitized.startsWith('+')) {
        sanitized = '+' + sanitized.slice(1).replace(/\D/g, '');
    } else {
        sanitized = sanitized.replace(/\D/g, '');
    }

    // Validate minimum length (at least 7 digits for a valid phone number)
    if (sanitized.replace(/^\+/, '').length < 7) {
        return null;
    }

    // Validate maximum length (international numbers typically max 15 digits)
    if (sanitized.replace(/^\+/, '').length > 15) {
        return null;
    }

    return sanitized;
}

/**
 * Validate phone number format and structure
 * @param {string} phoneNumber - Phone number to validate
 * @returns {Object} Validation result with details
 */
function validatePhoneNumber(phoneNumber) {
    const result = {
        isValid: false,
        sanitized: null,
        errors: [],
        warnings: []
    };

    if (!phoneNumber) {
        result.errors.push('Phone number is empty or null');
        return result;
    }

    if (typeof phoneNumber !== 'string') {
        result.errors.push('Phone number must be a string');
        return result;
    }

    const trimmed = phoneNumber.trim();
    if (trimmed.length === 0) {
        result.errors.push('Phone number is empty after trimming');
        return result;
    }

    // Attempt to sanitize
    const sanitized = sanitizePhoneNumber(trimmed);
    if (!sanitized) {
        result.errors.push('Phone number could not be sanitized to valid format');
        return result;
    }

    result.sanitized = sanitized;
    result.isValid = true;

    // Add warnings for potential issues
    if (trimmed !== sanitized) {
        result.warnings.push('Phone number was modified during sanitization');
    }

    if (sanitized.length < 10 && !sanitized.startsWith('+')) {
        result.warnings.push('Phone number may be too short for standard format');
    }

    return result;
}

/**
 * Get duplicate phone number statistics for Excel export
 * @param {Array} records - Array of records
 * @returns {Object} Statistics about duplicate phone numbers
 */
function getDuplicatePhoneStatistics(records) {
    const duplicateInfo = identifyDuplicatePhoneNumbers(records);
    
    return {
        totalRecords: duplicateInfo.totalRecords,
        uniquePhoneNumbers: duplicateInfo.uniquePhoneCount,
        duplicatePhoneNumbers: duplicateInfo.duplicatePhoneNumbers.size,
        recordsWithDuplicatePhones: duplicateInfo.duplicateCount,
        duplicateRate: duplicateInfo.totalRecords > 0 ? 
            (duplicateInfo.duplicateCount / duplicateInfo.totalRecords) * 100 : 0,
        phoneNumberFrequency: Array.from(duplicateInfo.phoneNumberMap.entries())
            .filter(([phone, indices]) => indices.length > 1)
            .map(([phone, indices]) => ({ phone, count: indices.length }))
            .sort((a, b) => b.count - a.count)
    };
}

module.exports = {
    EXCEL_STYLING_CONFIG,
    DUPLICATE_STYLING_CONFIG,
    getFontWithFallback,
    createBaseStyle,
    createStatusStyle,
    createHeaderStyle,
    createDuplicateStyle,
    validateStyleObject,
    isValidColorCode,
    formatColorCode,
    getStylingConfig,
    createCellStyle,
    applyFontFallback,
    // New comprehensive validation and error handling functions
    validateXLSXStyleObject,
    validateFontStructure,
    validateAlignmentStructure,
    validateFillStructure,
    validateDuplicateStyleStructure,
    validateXLSXCompatibility,
    safeApplyStyle,
    logStylingFailure,
    batchApplyStyles,
    // Duplicate phone number detection utilities for Excel export
    identifyDuplicatePhoneNumbers,
    buildDuplicatePhoneMap,
    extractPhoneNumber,
    sanitizePhoneNumber,
    validatePhoneNumber,
    getDuplicatePhoneStatistics,
    // Centralized color configuration exports
    DUPLICATE_ORANGE_COLOR,
    COLOR_CONFIG,
    // Color validation functions
    validateColorCode,
    validateDuplicateOrangeConsistency
};
