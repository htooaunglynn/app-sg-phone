const config = require('../utils/config');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

/**
 * Singapore Phone Validator Service
 * Validates phone numbers to determine if they are Singapore phone numbers using libphonenumber-js
 */
class SingaporePhoneValidator {
    constructor() {
        this.singaporeCountryCode = config.phoneValidation.singaporeCountryCode;
        this.batchSize = config.phoneValidation.batchValidationSize;
        this.enableLogging = config.phoneValidation.enableValidationLogging;
    }

    /**
     * Validate if a phone number is a Singapore phone number using libphonenumber-js
     * @param {string} phoneNumber - The phone number to validate
     * @returns {boolean} - True if Singapore phone number, false otherwise
     */
    validateSingaporePhone(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            if (this.enableLogging) {
                console.warn('Invalid phone number input:', phoneNumber);
            }
            return false;
        }

        try {
            // Parse the phone number using libphonenumber-js
            const parsedNumber = parsePhoneNumber(phoneNumber, this.singaporeCountryCode);

            // Check if the number is valid and is from Singapore
            const isValid = parsedNumber &&
                isValidPhoneNumber(phoneNumber, this.singaporeCountryCode) &&
                parsedNumber.country === this.singaporeCountryCode;

            if (this.enableLogging) {
                console.log(`Phone validation: ${phoneNumber} -> ${parsedNumber ? parsedNumber.formatInternational() : 'invalid'} -> ${isValid}`);
            }

            return isValid;
        } catch (error) {
            if (this.enableLogging) {
                console.warn(`Phone validation error for ${phoneNumber}:`, error.message);
            }
            return false;
        }
    }



    /**
     * Validate configuration and libphonenumber-js integration
     * @returns {Object} - Configuration validation result
     */
    validateConfiguration() {
        const issues = [];

        if (!this.singaporeCountryCode) {
            issues.push('Singapore country code is not configured');
        }

        if (this.batchSize <= 0) {
            issues.push('Batch size must be greater than 0');
        }

        // Test libphonenumber-js with known valid Singapore numbers
        const testNumbers = ['+6591234567', '91234567', '+6581234567', '81234567'];
        const testResults = testNumbers.map(num => this.validateSingaporePhone(num));

        if (!testResults.some(result => result === true)) {
            issues.push('libphonenumber-js validation may not be working correctly - test numbers failed validation');
        }

        return {
            isValid: issues.length === 0,
            issues: issues,
            countryCode: this.singaporeCountryCode,
            batchSize: this.batchSize,
            loggingEnabled: this.enableLogging,
            libphonenumberIntegrated: true
        };
    }
}

// Export singleton instance
const singaporePhoneValidator = new SingaporePhoneValidator();
module.exports = singaporePhoneValidator;
