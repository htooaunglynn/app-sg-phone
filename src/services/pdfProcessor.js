const pdf = require('pdf-parse');
const databaseManager = require('../utils/database');

class PDFProcessor {
    constructor() {
        // Singapore phone number pattern: 8 digits starting with 6, 8, or 9
        this.phonePattern = /^[689]\d{7}$/;
        // Accept any Id format - removed specific identifier pattern validation

        // Error message templates for user-friendly feedback
        this.errorMessages = {
            INVALID_PDF: 'The uploaded file is not a valid PDF or is corrupted. Please check your file and try again.',
            EMPTY_PDF: 'The PDF file appears to be empty or contains no readable text. Please ensure your PDF has content.',
            NO_VALID_RECORDS: 'No valid phone records were found in the PDF. Please ensure your PDF contains data in the expected two-column format (Id and Phone).',
            INVALID_FORMAT: 'The PDF format is not recognized. Expected format: two columns with Id and Phone number.',
            CORRUPTED_DATA: 'Some data in the PDF appears to be corrupted or unreadable. Please check your source file.',
            PROCESSING_ERROR: 'An error occurred while processing the PDF. Please try again or contact support if the problem persists.'
        };
    }

    /**
     * Extract data from PDF buffer
     * @param {Buffer} pdfBuffer - The PDF file buffer
     * @returns {Promise<Array>} Array of phone records
     */
    async extractData(pdfBuffer) {
        try {
            // Validate input buffer
            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
                throw new Error(this.errorMessages.INVALID_PDF);
            }

            if (pdfBuffer.length === 0) {
                throw new Error(this.errorMessages.EMPTY_PDF);
            }

            // Check if buffer starts with PDF signature
            if (!this.isPDFBuffer(pdfBuffer)) {
                throw new Error(this.errorMessages.INVALID_PDF);
            }

            const data = await pdf(pdfBuffer);
            const textContent = data.text;

            if (!textContent || textContent.trim().length === 0) {
                throw new Error(this.errorMessages.EMPTY_PDF);
            }

            const phoneRecords = this.parseColumns(textContent);

            if (phoneRecords.length === 0) {
                throw new Error(this.errorMessages.NO_VALID_RECORDS);
            }

            return phoneRecords;
        } catch (error) {
            // Handle specific PDF parsing errors
            if (error.message.includes('Invalid PDF') || error.message.includes('PDF parsing')) {
                throw new Error(this.errorMessages.INVALID_PDF);
            }

            if (error.message.includes('encrypted') || error.message.includes('password')) {
                throw new Error('The PDF file is password protected or encrypted. Please provide an unprotected PDF file.');
            }

            if (error.message.includes('corrupted') || error.message.includes('damaged')) {
                throw new Error(this.errorMessages.CORRUPTED_DATA);
            }

            // If it's already one of our custom error messages, re-throw as is
            if (Object.values(this.errorMessages).includes(error.message)) {
                throw error;
            }

            // For any other unexpected errors, provide a generic message
            console.error('PDF processing error:', error);
            throw new Error(this.errorMessages.PROCESSING_ERROR);
        }
    }

    /**
     * Parse text content into columns and extract phone records
     * @param {string} textContent - Raw text from PDF
     * @returns {Array} Array of validated phone records
     */
    parseColumns(textContent) {
        try {
            if (!textContent || typeof textContent !== 'string') {
                throw new Error(this.errorMessages.CORRUPTED_DATA);
            }

            const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const phoneRecords = [];
            let validLineCount = 0;
            let totalLineCount = 0;

            for (const line of lines) {
                totalLineCount++;

                // Skip lines that are clearly headers or separators
                if (this.isHeaderOrSeparator(line)) {
                    continue;
                }

                // Split line by whitespace to separate columns
                const parts = line.split(/\s+/);

                if (parts.length >= 2) {
                    // First part is Id (accept any format), second is phone number
                    const id = parts[0];
                    const phoneNumber = parts[1];

                    // Only validate phone number format, accept any Id format
                    if (this.validatePhoneNumber(phoneNumber)) {
                        phoneRecords.push({
                            id: id,
                            phoneNumber: phoneNumber
                        });
                        validLineCount++;
                    }
                }
            }

            // If we processed many lines but found very few valid records, 
            // the format might be wrong
            if (totalLineCount > 10 && validLineCount === 0) {
                throw new Error(this.errorMessages.INVALID_FORMAT);
            }

            return phoneRecords;
        } catch (error) {
            if (Object.values(this.errorMessages).includes(error.message)) {
                throw error;
            }

            console.error('Column parsing error:', error);
            throw new Error(this.errorMessages.CORRUPTED_DATA);
        }
    }

    /**
     * Check if a line is likely a header or separator
     * @param {string} line - The line to check
     * @returns {boolean} True if line appears to be a header or separator
     */
    isHeaderOrSeparator(line) {
        // Common header patterns for two-column structure
        const headerPatterns = [
            /^id/i,
            /^identifier/i,
            /^phone/i,
            /^number/i,
            /^-+$/,
            /^=+$/,
            /^\*+$/,
            /^#+$/
        ];

        return headerPatterns.some(pattern => pattern.test(line));
    }

    /**
     * Validate two-column PDF structure
     * @param {Array} extractedData - Array of extracted records
     * @returns {Object} Validation result with success flag and details
     */
    validateTwoColumnStructure(extractedData) {
        if (!Array.isArray(extractedData) || extractedData.length === 0) {
            return {
                success: false,
                error: 'No data extracted or invalid data format'
            };
        }

        // Check if all records have both id and phoneNumber fields
        const invalidRecords = extractedData.filter(record => 
            !record.id || !record.phoneNumber || 
            typeof record.id !== 'string' || 
            typeof record.phoneNumber !== 'string'
        );

        if (invalidRecords.length > 0) {
            return {
                success: false,
                error: `Invalid two-column structure: ${invalidRecords.length} records missing Id or Phone data`
            };
        }

        return {
            success: true,
            recordCount: extractedData.length
        };
    }

    /**
     * Validate Singapore phone number format
     * @param {string} phoneNumber - The phone number to validate
     * @returns {boolean} True if valid
     */
    validatePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return false;
        }

        // Remove any non-digit characters for validation
        const cleanNumber = phoneNumber.replace(/\D/g, '');

        // Singapore phone numbers are 8 digits starting with 6, 8, or 9
        return this.phonePattern.test(cleanNumber);
    }

    /**
     * Check if buffer contains PDF signature
     * @param {Buffer} buffer - The buffer to check
     * @returns {boolean} True if buffer appears to be a PDF
     */
    isPDFBuffer(buffer) {
        if (!buffer || buffer.length < 4) {
            return false;
        }

        // PDF files start with %PDF
        const pdfSignature = buffer.slice(0, 4).toString();
        return pdfSignature === '%PDF';
    }

    /**
     * Validate the overall format of extracted data
     * @param {Array} extractedData - Array of phone records
     * @returns {Object} Validation result with success flag and errors
     */
    validateFormat(extractedData) {
        const errors = [];
        const warnings = [];

        if (!Array.isArray(extractedData)) {
            errors.push('Extracted data is not in the expected array format');
            return { success: false, errors, warnings };
        }

        if (extractedData.length === 0) {
            errors.push('No valid phone records found in the PDF');
            return { success: false, errors, warnings };
        }

        // Validate two-column structure
        const structureValidation = this.validateTwoColumnStructure(extractedData);
        if (!structureValidation.success) {
            errors.push(structureValidation.error);
            return { success: false, errors, warnings };
        }

        // Check for duplicate IDs
        const ids = new Set();
        const duplicates = [];
        const invalidRecords = [];

        for (let i = 0; i < extractedData.length; i++) {
            const record = extractedData[i];

            if (!record || typeof record !== 'object') {
                invalidRecords.push(`Record ${i + 1}: Invalid record structure`);
                continue;
            }

            if (!record.id || !record.phoneNumber) {
                invalidRecords.push(`Record ${i + 1}: Missing Id or phone number`);
                continue;
            }

            // Validate phone number format only (accept any Id format)
            if (!this.validatePhoneNumber(record.phoneNumber)) {
                invalidRecords.push(`Record ${i + 1}: Invalid phone number format "${record.phoneNumber}"`);
            }

            if (ids.has(record.id)) {
                duplicates.push(record.id);
            } else {
                ids.add(record.id);
            }
        }

        if (invalidRecords.length > 0) {
            errors.push(...invalidRecords);
        }

        if (duplicates.length > 0) {
            warnings.push(`Duplicate IDs found (will be skipped): ${duplicates.join(', ')}`);
        }

        // Check data quality
        const validRecordCount = extractedData.length - invalidRecords.length;
        if (validRecordCount < extractedData.length * 0.5) {
            warnings.push(`Low data quality: Only ${validRecordCount} out of ${extractedData.length} records are valid`);
        }

        return {
            success: errors.length === 0,
            errors,
            warnings,
            recordCount: extractedData.length,
            validRecordCount,
            duplicateCount: duplicates.length
        };
    }

    /**
     * Store extracted PDF data directly to backup_table
     * @param {Array} phoneRecords - Array of phone records with id and phoneNumber
     * @returns {Promise<Object>} Storage result with success flag and details
     */
    async storeToBackupTable(phoneRecords) {
        try {
            if (!Array.isArray(phoneRecords) || phoneRecords.length === 0) {
                throw new Error('No phone records provided for storage');
            }

            console.log(`Storing ${phoneRecords.length} records to backup_table...`);

            let insertedCount = 0;
            let duplicateCount = 0;
            let errorCount = 0;
            const errors = [];

            // Process records individually to handle duplicates gracefully
            for (const record of phoneRecords) {
                try {
                    const result = await databaseManager.insertBackupRecord(record.id, record.phoneNumber);
                    
                    if (result) {
                        insertedCount++;
                    } else {
                        // null result indicates duplicate (handled gracefully)
                        duplicateCount++;
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Failed to insert record ${record.id}: ${error.message}`);
                    console.error(`Error inserting record ${record.id}:`, error.message);
                }
            }

            const totalProcessed = insertedCount + duplicateCount + errorCount;

            console.log(`Backup storage completed: ${insertedCount} inserted, ${duplicateCount} duplicates, ${errorCount} errors`);

            return {
                success: insertedCount > 0 || (totalProcessed === phoneRecords.length && errorCount === 0),
                totalRecords: phoneRecords.length,
                insertedCount,
                duplicateCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Failed to store records to backup_table:', error.message);
            throw new Error(`Backup storage failed: ${error.message}`);
        }
    }

    /**
     * Enforce immutability by preventing updates/deletes to backup_table
     * This is a validation method to ensure backup_table remains immutable
     * @param {string} operation - The operation being attempted
     * @returns {boolean} Always returns false for update/delete operations
     */
    validateBackupTableOperation(operation) {
        const allowedOperations = ['INSERT', 'SELECT'];
        
        if (!allowedOperations.includes(operation.toUpperCase())) {
            throw new Error(`Operation ${operation} is not allowed on backup_table. Backup table is immutable.`);
        }
        
        return true;
    }

    /**
     * Process PDF and store directly to backup_table
     * @param {Buffer} pdfBuffer - The PDF file buffer
     * @returns {Promise<Object>} Processing and storage result
     */
    async processAndStoreToBackup(pdfBuffer) {
        try {
            // Extract data from PDF
            const phoneRecords = await this.extractData(pdfBuffer);
            
            if (!phoneRecords || phoneRecords.length === 0) {
                throw new Error('No valid phone records found in PDF');
            }

            // Validate format
            const validation = this.validateFormat(phoneRecords);
            if (!validation.success) {
                throw new Error(`PDF validation failed: ${validation.errors.join(', ')}`);
            }

            // Store to backup_table
            const storageResult = await this.storeToBackupTable(phoneRecords);

            return {
                success: storageResult.success,
                extractedRecords: phoneRecords.length,
                insertedRecords: storageResult.insertedCount,
                duplicateRecords: storageResult.duplicateCount,
                errorRecords: storageResult.errorCount,
                validation: {
                    warnings: validation.warnings || [],
                    errors: storageResult.errors || []
                }
            };

        } catch (error) {
            console.error('PDF processing and backup storage failed:', error.message);
            throw error;
        }
    }

    /**
     * Get user-friendly error message for a specific error type
     * @param {string} errorType - The error type key
     * @returns {string} User-friendly error message
     */
    getErrorMessage(errorType) {
        return this.errorMessages[errorType] || this.errorMessages.PROCESSING_ERROR;
    }

    /**
     * Create a detailed error report for debugging
     * @param {Error} error - The error that occurred
     * @param {Object} context - Additional context information
     * @returns {Object} Detailed error report
     */
    createErrorReport(error, context = {}) {
        return {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            userMessage: this.getUserFriendlyMessage(error.message)
        };
    }

    /**
     * Convert technical error message to user-friendly message
     * @param {string} technicalMessage - The technical error message
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(technicalMessage) {
        // Check if it's already a user-friendly message
        if (Object.values(this.errorMessages).includes(technicalMessage)) {
            return technicalMessage;
        }

        // Map common technical errors to user-friendly messages
        const errorMappings = [
            { pattern: /invalid pdf|pdf parsing|not a pdf/i, message: this.errorMessages.INVALID_PDF },
            { pattern: /empty|no content|no text/i, message: this.errorMessages.EMPTY_PDF },
            { pattern: /no valid records|no records found/i, message: this.errorMessages.NO_VALID_RECORDS },
            { pattern: /format|structure|column/i, message: this.errorMessages.INVALID_FORMAT },
            { pattern: /corrupt|damaged|unreadable/i, message: this.errorMessages.CORRUPTED_DATA }
        ];

        for (const mapping of errorMappings) {
            if (mapping.pattern.test(technicalMessage)) {
                return mapping.message;
            }
        }

        return this.errorMessages.PROCESSING_ERROR;
    }
}

module.exports = PDFProcessor;