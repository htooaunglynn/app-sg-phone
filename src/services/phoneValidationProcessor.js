const databaseManager = require('../utils/database');
const singaporePhoneValidator = require('./singaporePhoneValidator');
const config = require('../utils/config');

/**
 * Phone Validation Processor Service
 * Handles processing records from backup_table to check_table with Singapore phone validation
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
     * Process all records from backup_table and populate check_table with validation results
     * @returns {Promise<Object>} - Processing results with statistics
     */
    async processBackupRecords() {
        try {
            if (this.enableLogging) {
                console.log('Starting backup_table to check_table processing...');
            }

            // Get all records from backup_table
            const backupRecords = await databaseManager.getBackupRecords();

            if (backupRecords.length === 0) {
                if (this.enableLogging) {
                    console.log('No records found in backup_table to process');
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
                console.log(`Found ${backupRecords.length} records in backup_table to process`);
            }

            // Process records in batches
            const results = await this.processBatchRecords(backupRecords);

            if (this.enableLogging) {
                console.log('Backup_table to check_table processing completed:', results);
            }

            return results;

        } catch (error) {
            console.error('Error processing backup records:', error.message);
            throw error;
        }
    }

    /**
     * Process records in batches for better performance
     * @param {Array} backupRecords - Records from backup_table
     * @returns {Promise<Object>} - Processing statistics
     */
    async processBatchRecords(backupRecords) {
        let processed = 0;
        let successful = 0;
        let failed = 0;
        let validSingaporeNumbers = 0;
        let invalidNumbers = 0;

        // Process records in chunks
        for (let i = 0; i < backupRecords.length; i += this.batchSize) {
            const batch = backupRecords.slice(i, i + this.batchSize);

            if (this.enableLogging) {
                console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(backupRecords.length / this.batchSize)} (${batch.length} records)`);
            }

            const batchResults = await this.processBatch(batch);

            processed += batchResults.processed;
            successful += batchResults.successful;
            failed += batchResults.failed;
            validSingaporeNumbers += batchResults.validSingaporeNumbers;
            invalidNumbers += batchResults.invalidNumbers;

            // Small delay between batches to prevent overwhelming the database
            if (i + this.batchSize < backupRecords.length) {
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

                // Check if record already exists in check_table
                const exists = await databaseManager.checkRecordExists(record.Id);

                // Validate the phone number
                const isValidSingaporePhone = singaporePhoneValidator.validateSingaporePhone(record.Phone);

                // Use company information directly from backup_table columns, with metadata as fallback
                const companyInfo = this.extractCompanyInfo(record);

                if (exists) {
                    // Update existing record in check_table with latest company data from backup_table
                    try {
                        await databaseManager.updateCheckRecord(record.Id, {
                            companyName: companyInfo.companyName,
                            physicalAddress: companyInfo.physicalAddress,
                            email: companyInfo.email,
                            website: companyInfo.website
                        });

                        if (this.enableLogging) {
                            console.log(`Updated existing check_table record ${record.Id} with latest company data`);
                        }
                    } catch (updateError) {
                        console.error(`Failed to update check_table record ${record.Id}:`, updateError.message);
                        // Continue processing but count as failed
                        failed++;
                        continue;
                    }
                } else {
                    // Insert new record into check_table with validation status and company fields
                    await databaseManager.insertCheckRecord(
                        record.Id,
                        record.Phone,
                        isValidSingaporePhone,
                        companyInfo.companyName,
                        companyInfo.physicalAddress,
                        companyInfo.email,
                        companyInfo.website
                    );
                }

                successful++;

                if (isValidSingaporePhone) {
                    validSingaporeNumbers++;
                } else {
                    invalidNumbers++;
                }

                if (this.enableLogging) {
                    const sourceType = this.getRecordSourceType(record);
                    console.log(`Processed ${sourceType} record ${record.Id}: ${record.Phone} -> ${isValidSingaporePhone ? 'Valid Singapore' : 'Invalid'}`);
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
     * Process specific records by ID from backup_table
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
                    // Get record from backup_table with company data and metadata
                    const backupRecord = await databaseManager.query(
                        'SELECT Id, Phone, CompanyName, PhysicalAddress, Email, Website, source_file, extracted_metadata FROM backup_table WHERE Id = ?',
                        [recordId]
                    );

                    if (backupRecord.length === 0) {
                        results.notFound.push(recordId);
                        continue;
                    }

                    const record = backupRecord[0];
                    results.processed++;

                    // Check if already exists in check_table
                    const exists = await databaseManager.checkRecordExists(record.Id);

                    // Validate and get company info from backup_table (prioritize direct columns over metadata)
                    const isValidSingaporePhone = singaporePhoneValidator.validateSingaporePhone(record.Phone);
                    const companyInfo = this.extractCompanyInfo(record); // Use main method that prioritizes direct columns

                    if (exists) {
                        // Update existing record in check_table with latest company data from backup_table
                        try {
                            await databaseManager.updateCheckRecord(record.Id, {
                                companyName: companyInfo.companyName,
                                physicalAddress: companyInfo.physicalAddress,
                                email: companyInfo.email,
                                website: companyInfo.website
                            });

                            if (this.enableLogging) {
                                console.log(`Updated existing check_table record ${record.Id} with latest company data`);
                            }
                        } catch (updateError) {
                            console.error(`Failed to update check_table record ${record.Id}:`, updateError.message);
                            results.failed++;
                            continue;
                        }
                    } else {
                        // Insert new record into check_table
                        await databaseManager.insertCheckRecord(
                            record.Id,
                            record.Phone,
                            isValidSingaporePhone,
                            companyInfo.companyName,
                            companyInfo.physicalAddress,
                            companyInfo.email,
                            companyInfo.website
                        );
                    }

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
                backupTableRecords: stats.backupTable,
                checkTableRecords: stats.checkTable,
                validatedPhones: stats.validatedPhones,
                invalidPhones: stats.invalidPhones,
                pendingProcessing: Math.max(0, stats.backupTable - stats.checkTable),
                processingComplete: stats.backupTable === stats.checkTable
            };

        } catch (error) {
            console.error('Error getting processing status:', error.message);
            throw error;
        }
    }

    /**
     * Reprocess records with updated validation logic
     * @param {boolean} forceReprocess - Whether to reprocess all records even if they exist
     * @returns {Promise<Object>} - Reprocessing results
     */
    async reprocessRecords(forceReprocess = false) {
        try {
            if (this.enableLogging) {
                console.log(`Starting reprocessing with forceReprocess: ${forceReprocess}`);
            }

            if (forceReprocess) {
                // Clear check_table before reprocessing
                await databaseManager.query('DELETE FROM check_table');
                if (this.enableLogging) {
                    console.log('Cleared check_table for complete reprocessing');
                }
            }

            // Process all backup records
            return await this.processBackupRecords();

        } catch (error) {
            console.error('Error during reprocessing:', error.message);
            throw error;
        }
    }

    /**
     * Extract company information from backup_table record (columns + metadata fallback)
     * @param {Object} record - Backup table record with company columns and metadata
     * @returns {Object} Company information object
     */
    extractCompanyInfo(record) {
        const companyInfo = {
            companyName: null,
            physicalAddress: null,
            email: null,
            website: null
        };

        // First priority: Use direct column data from backup_table
        companyInfo.companyName = record.CompanyName || null;
        companyInfo.physicalAddress = record.PhysicalAddress || null;
        companyInfo.email = record.Email || null;
        companyInfo.website = record.Website || null;

        // Second priority: Extract from metadata if columns are empty
        try {
            if (record.extracted_metadata && (!companyInfo.companyName || !companyInfo.email)) {
                const metadata = typeof record.extracted_metadata === 'string'
                    ? JSON.parse(record.extracted_metadata)
                    : record.extracted_metadata;

                if (metadata && metadata.company_info) {
                    const company = metadata.company_info;

                    // Fill in missing data from metadata
                    companyInfo.companyName = companyInfo.companyName || company.name || company.companyName || company.company || null;
                    companyInfo.physicalAddress = companyInfo.physicalAddress || company.address || company.physicalAddress || company.location || null;
                    companyInfo.email = companyInfo.email || company.email || company.mail || null;
                    companyInfo.website = companyInfo.website || company.website || company.url || company.site || null;
                }
            }
        } catch (error) {
            if (this.enableLogging) {
                console.warn(`Error extracting company info from metadata for record ${record.Id}:`, error.message);
            }
        }

        return companyInfo;
    }

    /**
     * Extract company information from Excel metadata (legacy method for backward compatibility)
     * @param {Object} record - Backup table record with metadata
     * @returns {Object} Company information object
     */
    extractCompanyInfoFromMetadata(record) {
        const companyInfo = {
            companyName: null,
            physicalAddress: null,
            email: null,
            website: null
        };

        try {
            if (record.extracted_metadata) {
                const metadata = typeof record.extracted_metadata === 'string'
                    ? JSON.parse(record.extracted_metadata)
                    : record.extracted_metadata;

                if (metadata && metadata.company_info) {
                    const company = metadata.company_info;

                    // Map company fields with fallbacks for different naming conventions
                    companyInfo.companyName = company.name || company.companyName || company.company || null;
                    companyInfo.physicalAddress = company.address || company.physicalAddress || company.location || null;
                    companyInfo.email = company.email || company.mail || null;
                    companyInfo.website = company.website || company.url || company.site || null;

                    // Handle additional column data that might contain company info
                    for (const [key, value] of Object.entries(company)) {
                        if (key.startsWith('column_') && value && !companyInfo.companyName) {
                            // Use first additional column as company name if no explicit company name found
                            companyInfo.companyName = value;
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            if (this.enableLogging) {
                console.warn(`Error extracting company info from metadata for record ${record.Id}:`, error.message);
            }
        }

        return companyInfo;
    }

    /**
     * Get the source type of a record (PDF or Excel)
     * @param {Object} record - Backup table record
     * @returns {string} Source type
     */
    getRecordSourceType(record) {
        try {
            if (record.extracted_metadata) {
                const metadata = typeof record.extracted_metadata === 'string'
                    ? JSON.parse(record.extracted_metadata)
                    : record.extracted_metadata;

                if (metadata && metadata.file_type) {
                    return metadata.file_type.toUpperCase();
                }
            }

            // Fallback: check source_file extension
            if (record.source_file) {
                const extension = record.source_file.toLowerCase().split('.').pop();
                if (extension === 'xlsx' || extension === 'xls') {
                    return 'EXCEL';
                } else if (extension === 'pdf') {
                    return 'PDF';
                }
            }

            return 'UNKNOWN';
        } catch (error) {
            return 'UNKNOWN';
        }
    }

    /**
     * Get Excel-specific validation statistics
     * @returns {Promise<Object>} Excel validation statistics
     */
    async getExcelValidationStats() {
        try {
            // Get all Excel records from backup_table
            const excelBackupRecords = await databaseManager.query(`
        SELECT Id, Phone, source_file, extracted_metadata
        FROM backup_table
        WHERE source_file LIKE '%.xlsx' OR source_file LIKE '%.xls'
           OR extracted_metadata LIKE '%"file_type":"excel"%'
      `);

            // Get corresponding check_table records
            const excelIds = excelBackupRecords.map(r => r.Id);
            let excelCheckRecords = [];

            if (excelIds.length > 0) {
                excelCheckRecords = await databaseManager.query(
                    'SELECT Id, Phone, Status FROM check_table WHERE Id IN (?)',
                    [excelIds]
                );
            }

            // Calculate statistics
            const stats = {
                totalExcelRecords: excelBackupRecords.length,
                validatedExcelRecords: excelCheckRecords.length,
                pendingValidation: excelBackupRecords.length - excelCheckRecords.length,
                validSingaporeNumbers: excelCheckRecords.filter(r => r.Status === 1).length,
                invalidNumbers: excelCheckRecords.filter(r => r.Status === 0).length,
                validationRate: excelBackupRecords.length > 0
                    ? ((excelCheckRecords.length / excelBackupRecords.length) * 100).toFixed(2)
                    : 0,
                singaporeValidRate: excelCheckRecords.length > 0
                    ? ((excelCheckRecords.filter(r => r.Status === 1).length / excelCheckRecords.length) * 100).toFixed(2)
                    : 0
            };

            return {
                success: true,
                stats: stats,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting Excel validation statistics:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get validation statistics by source type (PDF vs Excel)
     * @returns {Promise<Object>} Validation statistics by source type
     */
    async getValidationStatsBySourceType() {
        try {
            // Get all backup records with metadata
            const allBackupRecords = await databaseManager.query(`
        SELECT Id, Phone, source_file, extracted_metadata
        FROM backup_table
      `);

            // Get all check records
            const allCheckRecords = await databaseManager.query(`
        SELECT Id, Phone, Status
        FROM check_table
      `);

            // Create lookup for check records
            const checkRecordMap = new Map();
            allCheckRecords.forEach(record => {
                checkRecordMap.set(record.Id, record);
            });

            // Categorize records by source type
            const stats = {
                excel: { total: 0, validated: 0, valid: 0, invalid: 0 },
                pdf: { total: 0, validated: 0, valid: 0, invalid: 0 },
                unknown: { total: 0, validated: 0, valid: 0, invalid: 0 }
            };

            for (const backupRecord of allBackupRecords) {
                const sourceType = this.getRecordSourceType(backupRecord).toLowerCase();
                const category = sourceType === 'excel' ? 'excel' :
                    sourceType === 'pdf' ? 'pdf' : 'unknown';

                stats[category].total++;

                const checkRecord = checkRecordMap.get(backupRecord.Id);
                if (checkRecord) {
                    stats[category].validated++;
                    if (checkRecord.Status === 1) {
                        stats[category].valid++;
                    } else {
                        stats[category].invalid++;
                    }
                }
            }

            // Calculate percentages
            for (const category of Object.keys(stats)) {
                const categoryStats = stats[category];
                categoryStats.validationRate = categoryStats.total > 0
                    ? ((categoryStats.validated / categoryStats.total) * 100).toFixed(2)
                    : 0;
                categoryStats.singaporeValidRate = categoryStats.validated > 0
                    ? ((categoryStats.valid / categoryStats.validated) * 100).toFixed(2)
                    : 0;
            }

            return {
                success: true,
                statsBySourceType: stats,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting validation statistics by source type:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
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
