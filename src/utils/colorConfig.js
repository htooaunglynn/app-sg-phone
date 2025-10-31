/**
 * Centralized Color Configuration
 * Provides consistent color definitions across web interface and Excel exports
 * Ensures color accessibility and validation compliance
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
 * Calculate contrast ratio between two colors
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
 * Get relative luminance of a color
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
 * Convert hex color to RGB
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
 * Validate color accessibility compliance
 * @param {string} foregroundColor - Foreground color (hex)
 * @param {string} backgroundColor - Background color (hex)
 * @param {Object} options - Validation options
 * @returns {Object} Accessibility validation result
 */
function validateColorAccessibility(foregroundColor, backgroundColor, options = {}) {
    const result = {
        isCompliant: false,
        contrastRatio: 0,
        level: 'fail',
        errors: [],
        warnings: [],
        recommendations: []
    };

    const { textSize = 'normal', targetLevel = 'AA' } = options;

    try {
        // Validate color formats
        const fgValidation = validateColorCode(foregroundColor);
        const bgValidation = validateColorCode(backgroundColor);

        if (!fgValidation.isValid) {
            result.errors.push(`Invalid foreground color: ${fgValidation.errors.join(', ')}`);
            return result;
        }

        if (!bgValidation.isValid) {
            result.errors.push(`Invalid background color: ${bgValidation.errors.join(', ')}`);
            return result;
        }

        // Calculate contrast ratio
        const contrastRatio = calculateContrastRatio(
            fgValidation.formatted,
            bgValidation.formatted
        );
        result.contrastRatio = Math.round(contrastRatio * 100) / 100;

        // Determine compliance level
        const requiredRatio = textSize === 'large' ? 
            COLOR_ACCESSIBILITY_CONFIG.contrastRatios.large : 
            COLOR_ACCESSIBILITY_CONFIG.contrastRatios.normal;

        const enhancedRatio = COLOR_ACCESSIBILITY_CONFIG.contrastRatios.enhanced;

        if (contrastRatio >= enhancedRatio) {
            result.level = 'AAA';
            result.isCompliant = true;
        } else if (contrastRatio >= requiredRatio) {
            result.level = 'AA';
            result.isCompliant = true;
        } else {
            result.level = 'fail';
            result.isCompliant = false;
            result.errors.push(`Contrast ratio ${result.contrastRatio}:1 is below required ${requiredRatio}:1`);
            result.recommendations.push(`Increase contrast to at least ${requiredRatio}:1 for ${targetLevel} compliance`);
        }

        // Add warnings for borderline cases
        if (result.isCompliant && contrastRatio < requiredRatio * 1.2) {
            result.warnings.push('Contrast ratio is close to minimum requirement, consider increasing for better accessibility');
        }

    } catch (error) {
        result.errors.push(`Accessibility validation failed: ${error.message}`);
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

/**
 * Validate all duplicate styling colors for accessibility
 * @returns {Object} Complete accessibility validation for duplicate colors
 */
function validateDuplicateColorAccessibility() {
    const duplicateConfig = COLOR_CONFIG.duplicate;
    
    return validateColorAccessibility(
        duplicateConfig.text,
        duplicateConfig.background,
        {
            textSize: 'normal',
            targetLevel: 'AA'
        }
    );
}

module.exports = {
    // Constants
    DUPLICATE_ORANGE_COLOR,
    COLOR_CONFIG,
    COLOR_ACCESSIBILITY_CONFIG,
    
    // Validation functions
    validateColorCode,
    validateColorAccessibility,
    validateDuplicateOrangeConsistency,
    validateDuplicateColorAccessibility,
    
    // Utility functions
    calculateContrastRatio,
    getRelativeLuminance,
    hexToRgb,
    getConsistentColor,
    getColorConfig
};