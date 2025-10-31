/**
 * Frontend Color Configuration
 * Provides consistent color definitions for web interface
 * Mirrors the server-side color configuration for consistency
 */

/**
 * Duplicate phone number orange color constant
 * This color is used consistently across web interface and Excel exports
 */
const DUPLICATE_ORANGE_COLOR = '#FFA500';

/**
 * Color configuration object with all system colors
 */
const COLOR_CONFIG = {
    // Duplicate styling colors
    duplicate: {
        background: DUPLICATE_ORANGE_COLOR,
        backgroundRgb: 'FFA500', // RGB format for Excel (without #)
        text: '#000000', // Black text for readability on orange background
        textRgb: '000000' // RGB format for Excel
    },
    
    // Status-based colors (existing)
    status: {
        valid: {
            background: '#FFFFFF',
            backgroundRgb: 'FFFFFF',
            text: '#000000',
            textRgb: '000000'
        },
        invalid: {
            background: '#FF0000',
            backgroundRgb: 'FF0000',
            text: '#000000',
            textRgb: '000000'
        }
    },
    
    // Header colors
    header: {
        background: '#E6E6FA', // Light lavender
        backgroundRgb: 'E6E6FA',
        text: '#000000',
        textRgb: '000000'
    },
    
    // Default colors
    default: {
        background: '#FFFFFF',
        backgroundRgb: 'FFFFFF',
        text: '#000000',
        textRgb: '000000'
    }
};

/**
 * Color accessibility configuration
 * Defines minimum contrast ratios and validation rules
 */
const COLOR_ACCESSIBILITY_CONFIG = {
    // WCAG 2.1 contrast ratio requirements
    contrastRatios: {
        normal: 4.5,    // Normal text minimum contrast ratio
        large: 3.0,     // Large text minimum contrast ratio
        enhanced: 7.0   // Enhanced contrast ratio for AAA compliance
    },
    
    // Color validation rules
    validation: {
        hexPattern: /^#?[0-9A-Fa-f]{6}$/,
        rgbPattern: /^[0-9A-Fa-f]{6}$/,
        minLength: 6,
        maxLength: 7 // Including # symbol
    }
};

/**
 * Validate color code format
 * @param {string} colorCode - Color code to validate (with or without #)
 * @returns {Object} Validation result
 */
function validateColorCode(colorCode) {
    const result = {
        isValid: false,
        formatted: null,
        rgbFormatted: null,
        errors: [],
        warnings: []
    };

    if (!colorCode || typeof colorCode !== 'string') {
        result.errors.push('Color code must be a non-empty string');
        return result;
    }

    const trimmed = colorCode.trim();
    
    // Check if it matches hex pattern
    if (!COLOR_ACCESSIBILITY_CONFIG.validation.hexPattern.test(trimmed)) {
        result.errors.push('Color code must be a valid 6-character hex code');
        return result;
    }

    // Format the color code
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const withoutHash = trimmed.replace('#', '').toUpperCase();

    result.isValid = true;
    result.formatted = withHash.toUpperCase();
    result.rgbFormatted = withoutHash;

    return result;
}

/**
 * Validate duplicate orange color consistency
 * @param {string} colorCode - Color code to validate against duplicate orange
 * @returns {Object} Consistency validation result
 */
function validateDuplicateOrangeConsistency(colorCode) {
    const result = {
        isConsistent: false,
        expectedColor: DUPLICATE_ORANGE_COLOR,
        providedColor: colorCode,
        errors: [],
        warnings: []
    };

    const validation = validateColorCode(colorCode);
    if (!validation.isValid) {
        result.errors.push(...validation.errors);
        return result;
    }

    const normalizedProvided = validation.formatted;
    const normalizedExpected = DUPLICATE_ORANGE_COLOR.toUpperCase();

    if (normalizedProvided === normalizedExpected) {
        result.isConsistent = true;
    } else {
        result.errors.push(`Color ${normalizedProvided} does not match expected duplicate orange ${normalizedExpected}`);
        result.warnings.push(`Use DUPLICATE_ORANGE_COLOR constant instead of hardcoded values`);
    }

    return result;
}

/**
 * Ensure consistent color usage between frontend CSS and Excel styling
 * @param {string} colorType - Type of color ('duplicate', 'status', etc.)
 * @param {string} colorProperty - Property ('background', 'text', etc.)
 * @returns {Object} Color information for both CSS and Excel
 */
function getConsistentColor(colorType, colorProperty) {
    const result = {
        css: null,
        excel: null,
        isValid: false,
        errors: []
    };

    if (!COLOR_CONFIG[colorType]) {
        result.errors.push(`Unknown color type: ${colorType}`);
        return result;
    }

    const colorConfig = COLOR_CONFIG[colorType];
    
    if (colorProperty === 'background') {
        result.css = colorConfig.background;
        result.excel = colorConfig.backgroundRgb;
    } else if (colorProperty === 'text') {
        result.css = colorConfig.text;
        result.excel = colorConfig.textRgb;
    } else {
        result.errors.push(`Unknown color property: ${colorProperty}`);
        return result;
    }

    result.isValid = true;
    return result;
}

/**
 * Get all color configuration for export
 * @returns {Object} Complete color configuration
 */
function getColorConfig() {
    return {
        ...COLOR_CONFIG,
        constants: {
            DUPLICATE_ORANGE_COLOR
        },
        accessibility: COLOR_ACCESSIBILITY_CONFIG
    };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.DUPLICATE_ORANGE_COLOR = DUPLICATE_ORANGE_COLOR;
    window.COLOR_CONFIG = COLOR_CONFIG;
    window.COLOR_ACCESSIBILITY_CONFIG = COLOR_ACCESSIBILITY_CONFIG;
    window.validateColorCode = validateColorCode;
    window.validateDuplicateOrangeConsistency = validateDuplicateOrangeConsistency;
    window.getConsistentColor = getConsistentColor;
    window.getColorConfig = getColorConfig;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DUPLICATE_ORANGE_COLOR,
        COLOR_CONFIG,
        COLOR_ACCESSIBILITY_CONFIG,
        validateColorCode,
        validateDuplicateOrangeConsistency,
        getConsistentColor,
        getColorConfig
    };
}