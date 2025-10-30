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
   * Parse a phone number using libphonenumber-js
   * @param {string} phoneNumber - The phone number to parse
   * @returns {Object|null} - Parsed phone number object or null if invalid
   */
  parsePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return null;
    }

    try {
      return parsePhoneNumber(phoneNumber, this.singaporeCountryCode);
    } catch (error) {
      if (this.enableLogging) {
        console.warn(`Phone parsing error for ${phoneNumber}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Validate multiple phone numbers in batch
   * @param {Array<string>} phoneNumbers - Array of phone numbers to validate
   * @returns {Array<{phone: string, isValid: boolean}>} - Array of validation results
   */
  batchValidatePhones(phoneNumbers) {
    if (!Array.isArray(phoneNumbers)) {
      throw new Error('Phone numbers must be provided as an array');
    }

    const results = [];
    
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phone = phoneNumbers[i];
      const isValid = this.validateSingaporePhone(phone);
      
      results.push({
        phone: phone,
        isValid: isValid
      });
    }

    if (this.enableLogging) {
      const validCount = results.filter(r => r.isValid).length;
      console.log(`Batch validation completed: ${validCount}/${phoneNumbers.length} valid Singapore numbers`);
    }

    return results;
  }

  /**
   * Get the Singapore country code
   * @returns {string} - The Singapore country code (SG)
   */
  getSingaporeCountryCode() {
    return this.singaporeCountryCode;
  }

  /**
   * Get validation statistics for a batch of phone numbers
   * @param {Array<string>} phoneNumbers - Array of phone numbers to analyze
   * @returns {Object} - Statistics object with counts and percentages
   */
  getValidationStats(phoneNumbers) {
    const results = this.batchValidatePhones(phoneNumbers);
    const validCount = results.filter(r => r.isValid).length;
    const invalidCount = results.length - validCount;
    
    return {
      total: results.length,
      valid: validCount,
      invalid: invalidCount,
      validPercentage: results.length > 0 ? ((validCount / results.length) * 100).toFixed(2) : 0,
      invalidPercentage: results.length > 0 ? ((invalidCount / results.length) * 100).toFixed(2) : 0
    };
  }

  /**
   * Process phone numbers in chunks for better performance
   * @param {Array<string>} phoneNumbers - Array of phone numbers to validate
   * @param {Function} callback - Callback function to handle each chunk result
   * @returns {Promise<Array>} - Promise resolving to all validation results
   */
  async processInChunks(phoneNumbers, callback = null) {
    if (!Array.isArray(phoneNumbers)) {
      throw new Error('Phone numbers must be provided as an array');
    }

    const allResults = [];
    const totalChunks = Math.ceil(phoneNumbers.length / this.batchSize);
    
    for (let i = 0; i < phoneNumbers.length; i += this.batchSize) {
      const chunk = phoneNumbers.slice(i, i + this.batchSize);
      const chunkResults = this.batchValidatePhones(chunk);
      
      allResults.push(...chunkResults);
      
      if (callback && typeof callback === 'function') {
        const chunkNumber = Math.floor(i / this.batchSize) + 1;
        await callback(chunkResults, chunkNumber, totalChunks);
      }
      
      // Add small delay to prevent overwhelming the system
      if (i + this.batchSize < phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return allResults;
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