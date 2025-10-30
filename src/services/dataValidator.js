const singaporePhoneValidator = require('./singaporePhoneValidator');

/**
 * Data Validator Service for Excel Processing
 * Validates and cleans Excel data before processing and storage
 */
class DataValidator {
    constructor() {
        // Phone number patterns for cleaning
        this.phoneCleaningPatterns = [
            /[\s\-\(\)\+]/g,  // Remove spaces, dashes, parentheses, plus signs
            /^65/,            // Remove Singapore country code prefix
            /[^\d]/g          // Remove any remaining non-digit characters
        ];
        
        // Validation statistics
        this.validationStats = {
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            duplicatesFound: 0,
            phoneNumbersCleaned: 0,
            mergedCellsProcessed: 0,
            errors: []
        };
    }

    /**
     * Validate individual row data quality
     * @param {Object} rowData - Row data object with phone, id, and metadata
     * @param {number} rowIndex - Row index for error reporting
     * @returns {Object} Validation result with isValid flag and cleaned data
     */
    validateRowData(rowData, rowIndex = 0) {
        const result = {
            isValid: false,
            cleanedData: null,
            errors: [],
            warnings: []
        };

        try {
            // Check if row data exists
            if (!rowData || typeof rowData !== 'object') {
                result.errors.push(`Row ${rowIndex}: Invalid row data structure`);
                return result;
            }

            // Validate required fields
            const requiredFieldsResult = this.validateRequiredFields(rowData, rowIndex);
            if (!requiredFieldsResult.isValid) {
                result.errors.push(...requiredFieldsResult.errors);
                return result;
            }

            // Clean phone number
            const phoneCleaningResult = this.cleanPhoneNumbers(rowData.phoneNumber, rowIndex);
            if (!phoneCleaningResult.isValid) {
                result.errors.push(...phoneCleaningResult.errors);
                return result;
            }

            // Handle merged cells in metadata
            const mergedCellsResult = this.handleMergedCells(rowData.metadata || {});
            if (mergedCellsResult.processed) {
                result.warnings.push(`Row ${rowIndex}: Processed merged cells in metadata`);
                this.validationStats.mergedCellsProcessed++;
            }

            // Create cleaned data object
            result.cleanedData = {
                id: String(rowData.id || '').trim(),
                phoneNumber: phoneCleaningResult.cleanedPhone,
                sourceWorksheet: rowData.sourceWorksheet || 'Unknown',
                metadata: mergedCellsResult.cleanedMetadata,
                originalRowIndex: rowIndex
            };

            result.isValid = true;
            this.validationStats.validRows++;

        } catch (error) {
            result.errors.push(`Row ${rowIndex}: Validation error - ${error.message}`);
            this.validationStats.invalidRows++;
        }

        return result;
    }

    /**
     * Clean phone numbers by removing formatting and validating structure
     * @param {string} phoneNumber - Raw phone number string
     * @param {number} rowIndex - Row index for error reporting
     * @returns {Object} Cleaning result with cleaned phone number
     */
    cleanPhoneNumbers(phoneNumber, rowIndex = 0) {
        const result = {
            isValid: false,
            cleanedPhone: null,
            errors: [],
            originalPhone: phoneNumber
        };

        try {
            if (!phoneNumber) {
                result.errors.push(`Row ${rowIndex}: Phone number is empty or null`);
                return result;
            }

            // Convert to string and trim
            let cleaned = String(phoneNumber).trim();

            if (!cleaned) {
                result.errors.push(`Row ${rowIndex}: Phone number is empty after trimming`);
                return result;
            }

            // Apply cleaning patterns
            for (const pattern of this.phoneCleaningPatterns) {
                if (pattern === /^65/) {
                    // Special handling for Singapore country code
                    if (cleaned.startsWith('65') && cleaned.length === 10) {
                        cleaned = cleaned.substring(2);
                    }
                } else {
                    cleaned = cleaned.replace(pattern, '');
                }
            }

            // Validate cleaned phone number structure
            if (!cleaned || cleaned.length === 0) {
                result.errors.push(`Row ${rowIndex}: Phone number is empty after cleaning`);
                return result;
            }

            // Check if it's a valid Singapore phone number format
            if (!this.isValidSingaporePhoneFormat(cleaned)) {
                result.errors.push(`Row ${rowIndex}: Invalid Singapore phone number format: ${cleaned}`);
                return result;
            }

            result.cleanedPhone = cleaned;
            result.isValid = true;
            this.validationStats.phoneNumbersCleaned++;

        } catch (error) {
            result.errors.push(`Row ${rowIndex}: Phone cleaning error - ${error.message}`);
        }

        return result;
    }

    /**
     * Handle merged cells and extract data appropriately
     * @param {Object} metadata - Row metadata that may contain merged cell data
     * @returns {Object} Result with processed metadata
     */
    handleMergedCells(metadata) {
        const result = {
            processed: false,
            cleanedMetadata: {},
            mergedCellsFound: []
        };

        try {
            if (!metadata || typeof metadata !== 'object') {
                return result;
            }

            // Process each metadata field
            for (const [key, value] of Object.entries(metadata)) {
                if (value === null || value === undefined) {
                    continue;
                }

                const stringValue = String(value).trim();
                
                // Check for merged cell indicators (common patterns)
                if (this.isMergedCellValue(stringValue)) {
                    result.mergedCellsFound.push(key);
                    result.processed = true;
                    
                    // Extract meaningful data from merged cell
                    const extractedValue = this.extractFromMergedCell(stringValue);
                    if (extractedValue) {
                        result.cleanedMetadata[key] = extractedValue;
                    }
                } else {
                    // Regular cell value
                    result.cleanedMetadata[key] = stringValue;
                }
            }

        } catch (error) {
            console.warn('Error handling merged cells:', error.message);
            result.cleanedMetadata = metadata; // Fallback to original
        }

        return result;
    }

    /**
     * Detect duplicate phone numbers within a dataset
     * @param {Array} phoneRecords - Array of phone record objects
     * @returns {Object} Duplicate detection result
     */
    detectDuplicates(phoneRecords) {
        const result = {
            duplicatesFound: 0,
            uniqueRecords: [],
            duplicateGroups: {},
            duplicatePhones: new Set()
        };

        try {
            if (!Array.isArray(phoneRecords)) {
                throw new Error('Phone records must be an array');
            }

            const phoneMap = new Map();
            
            for (let i = 0; i < phoneRecords.length; i++) {
                const record = phoneRecords[i];
                const phone = record.phoneNumber;
                
                if (!phone) {
                    continue;
                }

                if (phoneMap.has(phone)) {
                    // Duplicate found
                    if (!result.duplicateGroups[phone]) {
                        result.duplicateGroups[phone] = [phoneMap.get(phone)];
                    }
                    result.duplicateGroups[phone].push(record);
                    result.duplicatePhones.add(phone);
                    result.duplicatesFound++;
                } else {
                    // First occurrence
                    phoneMap.set(phone, record);
                    result.uniqueRecords.push(record);
                }
            }

            this.validationStats.duplicatesFound = result.duplicatesFound;

        } catch (error) {
            console.error('Error detecting duplicates:', error.message);
            result.uniqueRecords = phoneRecords; // Fallback to original
        }

        return result;
    }

    /**
     * Validate that required fields exist and have valid data
     * @param {Object} rowData - Row data object
     * @param {number} rowIndex - Row index for error reporting
     * @returns {Object} Validation result
     */
    validateRequiredFields(rowData, rowIndex = 0) {
        const result = {
            isValid: true,
            errors: [],
            missingFields: []
        };

        try {
            // Check for phone number (required)
            if (!rowData.phoneNumber || String(rowData.phoneNumber).trim() === '') {
                result.errors.push(`Row ${rowIndex}: Phone number is required`);
                result.missingFields.push('phoneNumber');
                result.isValid = false;
            }

            // Check for ID (can be generated if missing, but warn)
            if (!rowData.id || String(rowData.id).trim() === '') {
                result.missingFields.push('id');
                // Note: This is not a fatal error as ID can be generated
            }

            // Validate data types
            if (rowData.phoneNumber && typeof rowData.phoneNumber !== 'string' && typeof rowData.phoneNumber !== 'number') {
                result.errors.push(`Row ${rowIndex}: Phone number must be a string or number`);
                result.isValid = false;
            }

        } catch (error) {
            result.errors.push(`Row ${rowIndex}: Required field validation error - ${error.message}`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * Validate batch of phone records
     * @param {Array} phoneRecords - Array of phone record objects
     * @returns {Object} Batch validation result
     */
    validateBatch(phoneRecords) {
        const result = {
            isValid: false,
            validRecords: [],
            invalidRecords: [],
            duplicateRecords: [],
            totalProcessed: 0,
            validationSummary: {
                totalRows: 0,
                validRows: 0,
                invalidRows: 0,
                duplicatesFound: 0,
                phoneNumbersCleaned: 0,
                mergedCellsProcessed: 0
            },
            errors: [],
            warnings: []
        };

        try {
            if (!Array.isArray(phoneRecords)) {
                result.errors.push('Phone records must be an array');
                return result;
            }

            // Reset validation stats
            this.resetValidationStats();

            // Validate each record
            for (let i = 0; i < phoneRecords.length; i++) {
                const record = phoneRecords[i];
                const validationResult = this.validateRowData(record, i + 1);

                if (validationResult.isValid) {
                    result.validRecords.push(validationResult.cleanedData);
                } else {
                    result.invalidRecords.push({
                        originalRecord: record,
                        rowIndex: i + 1,
                        errors: validationResult.errors
                    });
                }

                result.errors.push(...validationResult.errors);
                result.warnings.push(...validationResult.warnings);
            }

            // Detect duplicates in valid records
            const duplicateResult = this.detectDuplicates(result.validRecords);
            result.duplicateRecords = Object.values(duplicateResult.duplicateGroups).flat();
            result.validRecords = duplicateResult.uniqueRecords;

            // Update summary
            result.totalProcessed = phoneRecords.length;
            result.validationSummary = { ...this.validationStats };
            result.validationSummary.totalRows = phoneRecords.length;
            result.validationSummary.duplicatesFound = duplicateResult.duplicatesFound;

            result.isValid = result.validRecords.length > 0;

        } catch (error) {
            result.errors.push(`Batch validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Generate validation report
     * @param {Object} validationResult - Result from validateBatch
     * @returns {Object} Detailed validation report
     */
    generateValidationReport(validationResult) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalRecords: validationResult.totalProcessed || 0,
                validRecords: validationResult.validRecords?.length || 0,
                invalidRecords: validationResult.invalidRecords?.length || 0,
                duplicateRecords: validationResult.duplicateRecords?.length || 0,
                successRate: 0
            },
            dataQuality: {
                phoneNumbersCleaned: validationResult.validationSummary?.phoneNumbersCleaned || 0,
                mergedCellsProcessed: validationResult.validationSummary?.mergedCellsProcessed || 0,
                duplicatesRemoved: validationResult.validationSummary?.duplicatesFound || 0
            },
            errors: validationResult.errors || [],
            warnings: validationResult.warnings || [],
            invalidRecordDetails: validationResult.invalidRecords || []
        };

        // Calculate success rate
        if (report.summary.totalRecords > 0) {
            report.summary.successRate = Math.round(
                (report.summary.validRecords / report.summary.totalRecords) * 100
            );
        }

        return report;
    }

    /**
     * Check if a value appears to be from a merged cell
     * @param {string} value - Cell value to check
     * @returns {boolean} True if appears to be merged cell data
     */
    isMergedCellValue(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        // Common merged cell patterns
        const mergedCellPatterns = [
            /^[\s]*$/,                    // Empty or whitespace only
            /^(null|undefined|#N\/A)$/i,  // Common null values
            /^[\s]*-[\s]*$/,              // Dash or hyphen only
            /^[\s]*\.+[\s]*$/,            // Dots only
            /^\s*\|\s*$/,                 // Pipe character only
        ];

        return mergedCellPatterns.some(pattern => pattern.test(value));
    }

    /**
     * Extract meaningful data from merged cell value
     * @param {string} mergedValue - Merged cell value
     * @returns {string|null} Extracted value or null
     */
    extractFromMergedCell(mergedValue) {
        if (!mergedValue || typeof mergedValue !== 'string') {
            return null;
        }

        // Try to extract meaningful content
        const cleaned = mergedValue.trim();
        
        // If it's just formatting characters, return null
        if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '|') {
            return null;
        }

        // If it contains actual content, return it
        if (cleaned.length > 0 && !/^[\s\-\.\|]+$/.test(cleaned)) {
            return cleaned;
        }

        return null;
    }

    /**
     * Check if phone number matches Singapore format
     * @param {string} phoneNumber - Cleaned phone number
     * @returns {boolean} True if valid Singapore format
     */
    isValidSingaporePhoneFormat(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return false;
        }

        // Singapore phone numbers: 8 digits starting with 6, 8, or 9
        const singaporePattern = /^[689]\d{7}$/;
        return singaporePattern.test(phoneNumber);
    }

    /**
     * Reset validation statistics
     */
    resetValidationStats() {
        this.validationStats = {
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            duplicatesFound: 0,
            phoneNumbersCleaned: 0,
            mergedCellsProcessed: 0,
            errors: []
        };
    }

    /**
     * Get current validation statistics
     * @returns {Object} Current validation statistics
     */
    getValidationStats() {
        return { ...this.validationStats };
    }

    /**
     * Validate phone number using Singapore phone validator
     * @param {string} phoneNumber - Phone number to validate
     * @returns {boolean} True if valid Singapore phone number
     */
    validateWithSingaporeValidator(phoneNumber) {
        try {
            return singaporePhoneValidator.validateSingaporePhone(phoneNumber);
        } catch (error) {
            console.warn('Singapore phone validation error:', error.message);
            return false;
        }
    }

    /**
     * Clean and validate phone numbers in batch
     * @param {Array} phoneNumbers - Array of phone numbers to process
     * @returns {Object} Batch processing result
     */
    batchCleanAndValidate(phoneNumbers) {
        const result = {
            cleaned: [],
            invalid: [],
            duplicates: [],
            stats: {
                total: phoneNumbers.length,
                valid: 0,
                invalid: 0,
                duplicates: 0
            }
        };

        const phoneSet = new Set();

        for (let i = 0; i < phoneNumbers.length; i++) {
            const phone = phoneNumbers[i];
            const cleaningResult = this.cleanPhoneNumbers(phone, i + 1);

            if (cleaningResult.isValid) {
                const cleanedPhone = cleaningResult.cleanedPhone;
                
                if (phoneSet.has(cleanedPhone)) {
                    result.duplicates.push({
                        phone: cleanedPhone,
                        originalPhone: phone,
                        index: i + 1
                    });
                    result.stats.duplicates++;
                } else {
                    phoneSet.add(cleanedPhone);
                    result.cleaned.push({
                        phone: cleanedPhone,
                        originalPhone: phone,
                        index: i + 1
                    });
                    result.stats.valid++;
                }
            } else {
                result.invalid.push({
                    phone: phone,
                    index: i + 1,
                    errors: cleaningResult.errors
                });
                result.stats.invalid++;
            }
        }

        return result;
    }
}

module.exports = DataValidator;