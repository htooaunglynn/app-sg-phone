const databaseManager = require('../utils/database');
const singaporePhoneValidator = require('./singaporePhoneValidator');
const config = require('../utils/config');

/**
 * Phone Validation Processor Service
 * Handles validation of phone numbers within the check_table.
 */
class PhoneValidationProcessor {
    constructor() {
        this.batchSize = config.phoneValidation.batchValidationSize;
        this.enableLogging = config.phoneValidation.enableValidationLogging;

        // Performance monitoring
        this.performanceMetrics = {
            totalValidationTime: 0,
            averageValidationTime: 0,
            batchesProcessed: 0,
            recordsValidated: 0,
            validSingaporeNumbers: 0,
            invalidNumbers: 0,
            errorCount: 0,
            averageRecordsPerSecond: 0,
            peakMemoryUsage: 0,
            databaseOperationTime: 0,
            validationOperationTime: 0
        };
    }

    /**
     * Process all records from check_table and update their validation status.
     * @returns {Promise<Object>} - Processing results with statistics
     */
    async processAllRecords() {
        try {
            if (this.enableLogging) {
                console.log('Starting check_table processing...');
            }

            // Get all records from check_table
            const records = await databaseManager.getCheckRecords();

            if (records.length === 0) {
                if (this.enableLogging) {
                    console.log('No records found in check_table to process');
                }
                return {
                    processed: 0,
                    successful: 0,
                    failed: 0,
                    validSingaporeNumbers: 0,
                    invalidNumbers: 0
                };
            }

            if (this.enableLogging) {
                console.log(`Found ${records.length} records in check_table to process`);
            }

            // Process records in batches
            const results = await this.processBatchRecords(records);

            if (this.enableLogging) {
                console.log('check_table processing completed:', results);
            }

            return results;

        } catch (error) {
            console.error('Error processing check_table records:', error.message);
            throw error;
        }
    }

    /**
     * Process records in batches for better performance
     * @param {Array} records - Records from check_table
     * @returns {Promise<Object>} - Processing statistics
     */
    async processBatchRecords(records) {
        let processed = 0;
        let successful = 0;
        let failed = 0;
        let validSingaporeNumbers = 0;
        let invalidNumbers = 0;

        // Process records in chunks
        for (let i = 0; i < records.length; i += this.batchSize) {
            const batch = records.slice(i, i + this.batchSize);

            if (this.enableLogging) {
                console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(records.length / this.batchSize)} (${batch.length} records)`);
            }

            const batchResults = await this.processBatch(batch);

            processed += batchResults.processed;
            successful += batchResults.successful;
            failed += batchResults.failed;
            validSingaporeNumbers += batchResults.validSingaporeNumbers;
            invalidNumbers += batchResults.invalidNumbers;

            // Small delay between batches to prevent overwhelming the database
            if (i + this.batchSize < records.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return {
            processed,
            successful,
            failed,
            validSingaporeNumbers,
            invalidNumbers
        };
    }

    /**
     * Process a single batch of records
     * @param {Array} batch - Batch of records to process
     * @returns {Promise<Object>} - Batch processing statistics
     */
    async processBatch(batch) {
        let processed = 0;
        let successful = 0;
        let failed = 0;
        let validSingaporeNumbers = 0;
        let invalidNumbers = 0;

        for (const record of batch) {
            try {
                processed++;

                // Validate the phone number
                const isValidSingaporePhone = singaporePhoneValidator.validateSingaporePhone(record.Phone);

                // Update the record's status in check_table
                await databaseManager.updateCheckRecord(record.Id, {
                    status: isValidSingaporePhone
                });

                successful++;

                if (isValidSingaporePhone) {
                    validSingaporeNumbers++;
                } else {
                    invalidNumbers++;
                }

                if (this.enableLogging) {
                    console.log(`Processed record ${record.Id}: ${record.Phone} -> ${isValidSingaporePhone ? 'Valid Singapore' : 'Invalid'}`);
                }

            } catch (error) {
                failed++;
                console.error(`Failed to process record ${record.Id}:`, error.message);
                // Continue processing other records even if one fails
                continue;
            }
        }

        return {
            processed,
            successful,
            failed,
            validSingaporeNumbers,
            invalidNumbers
        };
    }

    /**
     * Process specific records by ID from check_table
     * @param {Array<string>} recordIds - Array of record IDs to process
     * @returns {Promise<Object>} - Processing results
     */
    async processSpecificRecords(recordIds) {
        try {
            if (!Array.isArray(recordIds) || recordIds.length === 0) {
                throw new Error('Record IDs must be provided as a non-empty array');
            }

            if (this.enableLogging) {
                console.log(`Processing specific records: ${recordIds.join(', ')}`);
            }

            const results = {
                processed: 0,
                successful: 0,
                failed: 0,
                validSingaporeNumbers: 0,
                invalidNumbers: 0,
                notFound: []
            };

            for (const recordId of recordIds) {
                try {
                    const recordResult = await databaseManager.query('SELECT id, phone FROM check_table WHERE id = $1', [recordId]);

                    if (recordResult.length === 0) {
                        results.notFound.push(recordId);
                        continue;
                    }

                    const record = recordResult[0];
                    results.processed++;

                    const isValidSingaporePhone = singaporePhoneValidator.validateSingaporePhone(record.Phone);

                    await databaseManager.updateCheckRecord(record.Id, {
                        status: isValidSingaporePhone
                    });

                    results.successful++;

                    if (isValidSingaporePhone) {
                        results.validSingaporeNumbers++;
                    } else {
                        results.invalidNumbers++;
                    }

                } catch (error) {
                    results.failed++;
                    console.error(`Failed to process record ${recordId}:`, error.message);
                }
            }

            return results;

        } catch (error) {
            console.error('Error processing specific records:', error.message);
            throw error;
        }
    }

    /**
     * Get processing status and statistics
     * @returns {Promise<Object>} - Current processing status
     */
    async getProcessingStatus() {
        try {
            const stats = await databaseManager.getTableStats();

            return {
                checkTableRecords: stats.checkTable,
                validatedPhones: stats.validatedPhones,
                invalidPhones: stats.invalidPhones,
            };

        } catch (error) {
            console.error('Error getting processing status:', error.message);
            throw error;
        }
    }

    /**
     * Reprocess records with updated validation logic
     * @returns {Promise<Object>} - Reprocessing results
     */
    async reprocessRecords() {
        try {
            if (this.enableLogging) {
                console.log(`Starting reprocessing.`);
            }
            return await this.processAllRecords();

        } catch (error) {
            console.error('Error during reprocessing:', error.message);
            throw error;
        }
    }

    /**
     * Validate processor configuration
     * @returns {Object} - Configuration validation result
     */
    validateConfiguration() {
        const issues = [];

        if (this.batchSize <= 0) {
            issues.push('Batch size must be greater than 0');
        }

        // Validate Singapore phone validator
        const validatorConfig = singaporePhoneValidator.validateConfiguration();
        if (!validatorConfig.isValid) {
            issues.push(...validatorConfig.issues);
        }

        return {
            isValid: issues.length === 0,
            issues: issues,
            batchSize: this.batchSize,
            loggingEnabled: this.enableLogging,
            validatorConfig: validatorConfig
        };
    }
}

// Export singleton instance
const phoneValidationProcessor = new PhoneValidationProcessor();
module.exports = phoneValidationProcessor;
