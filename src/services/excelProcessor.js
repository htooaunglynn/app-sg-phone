const XLSX = require('xlsx');
const databaseManager = require('../utils/database');
const DataValidator = require('./dataValidator');
const phoneValidationProcessor = require('./phoneValidationProcessor');
const DuplicateDetectionService = require('./duplicateDetectionService');

class ExcelProcessor {
    constructor() {
        // Singapore phone number pattern: 8 digits starting with 6, 8, or 9
        this.phonePattern = /^[689]\d{7}$/;

        // Initialize data validator
        this.dataValidator = new DataValidator();

        // Initialize duplicate detection service
        this.duplicateDetectionService = new DuplicateDetectionService();

        // Batch processing configuration
        this.batchSize = 1000; // Process records in batches for large datasets

        // Performance monitoring
        this.performanceMetrics = {
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            filesProcessed: 0,
            recordsProcessed: 0,
            worksheetsProcessed: 0,
            largestFileSize: 0,
            largestRecordCount: 0,
            errorCount: 0,
            memoryUsage: {
                peak: 0,
                average: 0,
                samples: []
            }
        };

        // Performance optimization settings
        this.optimizationSettings = {
            maxFileSize: 50 * 1024 * 1024, // 50MB limit
            maxRecordsPerWorksheet: 100000, // 100k records per worksheet
            maxWorksheetsPerFile: 20, // Maximum worksheets to process
            streamingThreshold: 10000, // Use streaming for files with more records
            memoryThreshold: 100 * 1024 * 1024, // 100MB memory threshold
            enableCaching: true,
            cacheSize: 1000 // Cache up to 1000 column mappings
        };

        // Column mapping cache for performance
        this.columnMappingCache = new Map();

        // Error message templates for user-friendly feedback
        this.errorMessages = {
            INVALID_EXCEL: 'The uploaded file is not a valid Excel file or is corrupted. Please check your file and try again.',
            EMPTY_EXCEL: 'The Excel file appears to be empty or contains no readable data. Please ensure your Excel file has content.',
            NO_VALID_RECORDS: 'No valid phone records were found in the Excel file. Please ensure your Excel file contains phone number data.',
            INVALID_FORMAT: 'The Excel format is not recognized. Expected format: columns containing Id and Phone number data.',
            CORRUPTED_DATA: 'Some data in the Excel file appears to be corrupted or unreadable. Please check your source file.',
            PROCESSING_ERROR: 'An error occurred while processing the Excel file. Please try again or contact support if the problem persists.',
            NO_WORKSHEETS: 'No worksheets found in the Excel file or all worksheets are empty.',
            WORKSHEET_ERROR: 'Error processing worksheet data. Please ensure worksheets contain valid data.',
            STORAGE_ERROR: 'Error storing Excel data to backup table. Please try again.',
            VALIDATION_ERROR: 'Error validating Excel data. Some records may be invalid.'
        };
    }

    /**
     * Extract data from Excel buffer with performance monitoring
     * @param {Buffer} excelBuffer - The Excel file buffer
     * @returns {Promise<Array>} Array of phone records
     */
    async extractData(excelBuffer) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();

        try {
            // Validate input buffer
            if (!excelBuffer || !Buffer.isBuffer(excelBuffer)) {
                throw new Error(this.errorMessages.INVALID_EXCEL);
            }

            if (excelBuffer.length === 0) {
                throw new Error(this.errorMessages.EMPTY_EXCEL);
            }

            // Check file size limits for performance
            if (excelBuffer.length > this.optimizationSettings.maxFileSize) {
                throw new Error(`Excel file is too large (${Math.round(excelBuffer.length / 1024 / 1024)}MB). Maximum allowed size is ${Math.round(this.optimizationSettings.maxFileSize / 1024 / 1024)}MB.`);
            }

            // Update performance metrics
            this.performanceMetrics.largestFileSize = Math.max(this.performanceMetrics.largestFileSize, excelBuffer.length);

            // Parse Excel workbook
            const workbook = XLSX.read(excelBuffer, { type: 'buffer' });

            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error(this.errorMessages.NO_WORKSHEETS);
            }

            // Process all worksheets and collect phone records
            const allPhoneRecords = [];
            const processingReport = {
                worksheetsProcessed: [],
                totalRecords: 0,
                validRecords: 0,
                errors: []
            };

            for (const sheetName of workbook.SheetNames) {
                try {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetRecords = await this.parseWorksheet(worksheet, sheetName);

                    if (sheetRecords.length > 0) {
                        allPhoneRecords.push(...sheetRecords);
                        processingReport.worksheetsProcessed.push({
                            name: sheetName,
                            recordCount: sheetRecords.length
                        });
                        processingReport.validRecords += sheetRecords.length;
                    }

                    processingReport.totalRecords += sheetRecords.length;
                } catch (sheetError) {
                    processingReport.errors.push(`Error processing worksheet '${sheetName}': ${sheetError.message}`);
                    console.warn(`Error processing worksheet '${sheetName}':`, sheetError.message);
                }
            }

            if (allPhoneRecords.length === 0) {
                throw new Error(this.errorMessages.NO_VALID_RECORDS);
            }

            // Store processing report for later use
            this.lastProcessingReport = processingReport;

            // Update performance metrics
            const endTime = Date.now();
            const endMemory = process.memoryUsage();
            const processingTime = endTime - startTime;

            this.updatePerformanceMetrics(processingTime, allPhoneRecords.length, processingReport.worksheetsProcessed.length, startMemory, endMemory);

            return allPhoneRecords;
        } catch (error) {
            // Update error metrics
            this.performanceMetrics.errorCount++;

            // Handle specific Excel parsing errors
            if (error.message.includes('Unsupported file') || error.message.includes('Invalid file')) {
                throw new Error(this.errorMessages.INVALID_EXCEL);
            }

            if (error.message.includes('encrypted') || error.message.includes('password')) {
                throw new Error('The Excel file is password protected or encrypted. Please provide an unprotected Excel file.');
            }

            if (error.message.includes('corrupted') || error.message.includes('damaged')) {
                throw new Error(this.errorMessages.CORRUPTED_DATA);
            }

            // If it's already one of our custom error messages, re-throw as is
            if (Object.values(this.errorMessages).includes(error.message)) {
                throw error;
            }

            // For any other unexpected errors, provide a generic message
            console.error('Excel processing error:', error);
            throw new Error(this.errorMessages.PROCESSING_ERROR);
        }
    }

    /**
     * Parse individual worksheet and extract phone records
     * @param {Object} worksheet - XLSX worksheet object
     * @param {string} sheetName - Name of the worksheet
     * @returns {Promise<Array>} Array of phone records from this worksheet
     */
    async parseWorksheet(worksheet, sheetName = 'Unknown') {
        try {
            if (!worksheet) {
                return [];
            }

            // Convert worksheet to JSON array
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1, // Use array format to handle variable headers
                defval: '', // Default value for empty cells
                raw: false // Convert all values to strings
            });

            if (!jsonData || jsonData.length === 0) {
                return [];
            }

            // Find header row and data rows
            const { headerRowIndex, dataRows } = this.identifyDataStructure(jsonData);

            if (dataRows.length === 0) {
                return [];
            }

            // Identify phone and ID columns
            const columnMapping = this.identifyColumns(jsonData, headerRowIndex);

            if (!columnMapping.phoneColumns || columnMapping.phoneColumns.length === 0) {
                return [];
            }

            // Extract phone records with support for multiple phones per row
            const phoneRecords = [];
            let recordId = 1;

            for (const row of dataRows) {
                try {
                    const rowPhoneRecords = this.extractMultiplePhoneNumbersFromRow(
                        row,
                        columnMapping,
                        sheetName,
                        recordId
                    );

                    phoneRecords.push(...rowPhoneRecords);
                    recordId++;
                } catch (rowError) {
                    console.warn(`Error processing row in worksheet '${sheetName}':`, rowError.message);
                    continue;
                }
            }

            return phoneRecords;
        } catch (error) {
            console.error(`Error parsing worksheet '${sheetName}':`, error);
            throw new Error(`${this.errorMessages.WORKSHEET_ERROR}: ${error.message}`);
        }
    }

    /**
     * Identify data structure in worksheet
     * @param {Array} jsonData - Raw worksheet data as array
     * @returns {Object} Object with headerRowIndex and dataRows
     */
    identifyDataStructure(jsonData) {
        let headerRowIndex = -1;
        let dataStartIndex = 0;

        // Look for header row (first non-empty row with text content)
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
                const nonEmptyCount = row.filter(cell => cell && String(cell).trim()).length;
                if (nonEmptyCount >= 2) {
                    headerRowIndex = i;
                    dataStartIndex = i + 1;
                    break;
                }
            }
        }

        // If no clear header found, assume first row is data
        if (headerRowIndex === -1) {
            dataStartIndex = 0;
        }

        // Extract data rows (skip empty rows)
        const dataRows = [];
        for (let i = dataStartIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
                const nonEmptyCount = row.filter(cell => cell && String(cell).trim()).length;
                if (nonEmptyCount > 0) {
                    dataRows.push(row);
                }
            }
        }

        return { headerRowIndex, dataRows };
    }

    /**
     * Identify phone and ID columns in the data
     * @param {Array} jsonData - Raw worksheet data
     * @param {number} headerRowIndex - Index of header row (-1 if no header)
     * @returns {Object} Column mapping with phoneColumns, idColumn, and other fields
     */
    identifyColumns(jsonData, headerRowIndex) {
        const columnMapping = {
            phoneColumns: [],
            idColumn: null,
            companyColumns: {},
            totalColumns: 0
        };

        if (jsonData.length === 0) {
            return columnMapping;
        }

        const sampleRow = jsonData[Math.max(0, headerRowIndex + 1)] || jsonData[0];
        columnMapping.totalColumns = sampleRow.length;

        // If we have headers, use them for identification
        if (headerRowIndex >= 0 && jsonData[headerRowIndex]) {
            const headers = jsonData[headerRowIndex];
            columnMapping.phoneColumns = this.identifyPhoneColumnsByHeader(headers);
            columnMapping.idColumn = this.identifyIdColumnByHeader(headers);
            columnMapping.companyColumns = this.identifyCompanyColumnsByHeader(headers);
        }

        // If no phone columns found by header, try pattern matching on data
        if (columnMapping.phoneColumns.length === 0) {
            columnMapping.phoneColumns = this.identifyPhoneColumnsByPattern(jsonData, headerRowIndex + 1);
        }

        // If no ID column found by header, try to find one by pattern
        if (columnMapping.idColumn === null) {
            columnMapping.idColumn = this.identifyIdColumnByPattern(jsonData, headerRowIndex + 1);
        }

        return columnMapping;
    }

    /**
     * Identify phone columns by header names
     * @param {Array} headers - Header row array
     * @returns {Array} Array of column indices that likely contain phone numbers
     */
    identifyPhoneColumnsByHeader(headers) {
        const phonePatterns = [
            /phone/i, /mobile/i, /contact/i, /number/i, /tel/i, /cell/i, /手机/i, /电话/i
        ];

        const phoneColumns = [];
        for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').trim();
            if (phonePatterns.some(pattern => pattern.test(header))) {
                phoneColumns.push(i);
            }
        }

        return phoneColumns;
    }

    /**
     * Identify ID column by header name
     * @param {Array} headers - Header row array
     * @returns {number|null} Column index for ID column or null if not found
     */
    identifyIdColumnByHeader(headers) {
        const idPatterns = [
            /^id$/i, /identifier/i, /序号/i, /编号/i, /^no$/i, /number/i, /index/i
        ];

        for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').trim();
            if (idPatterns.some(pattern => pattern.test(header))) {
                return i;
            }
        }

        return null;
    }

    /**
     * Identify company-related columns by header names
     * @param {Array} headers - Header row array
     * @returns {Object} Object mapping field types to column indices
     */
    identifyCompanyColumnsByHeader(headers) {
        const companyColumns = {};

        const patterns = {
            name: [/name/i, /company/i, /企业/i, /公司/i, /姓名/i],
            email: [/email/i, /mail/i, /邮箱/i],
            address: [/address/i, /location/i, /地址/i],
            website: [/website/i, /url/i, /site/i, /网站/i]
        };

        for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').trim();

            for (const [fieldType, fieldPatterns] of Object.entries(patterns)) {
                if (fieldPatterns.some(pattern => pattern.test(header))) {
                    companyColumns[fieldType] = i;
                    break;
                }
            }
        }

        return companyColumns;
    }

    /**
     * Identify phone columns by data pattern matching
     * @param {Array} jsonData - Raw worksheet data
     * @param {number} startRow - Row index to start pattern matching
     * @returns {Array} Array of column indices that likely contain phone numbers
     */
    identifyPhoneColumnsByPattern(jsonData, startRow = 0) {
        const phoneColumns = [];
        const sampleSize = Math.min(10, jsonData.length - startRow);

        if (sampleSize <= 0 || !jsonData[startRow]) {
            return phoneColumns;
        }

        const columnCount = jsonData[startRow].length;

        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            let phoneCount = 0;
            let totalNonEmpty = 0;

            for (let rowIndex = startRow; rowIndex < startRow + sampleSize && rowIndex < jsonData.length; rowIndex++) {
                const row = jsonData[rowIndex];
                if (row && row[colIndex]) {
                    const cellValue = String(row[colIndex]).trim();
                    if (cellValue) {
                        totalNonEmpty++;
                        const cleanPhone = this.cleanPhoneNumber(cellValue);
                        if (cleanPhone && this.validatePhoneNumber(cleanPhone)) {
                            phoneCount++;
                        }
                    }
                }
            }

            // If more than 50% of non-empty cells in this column are valid phone numbers
            if (totalNonEmpty > 0 && (phoneCount / totalNonEmpty) > 0.5) {
                phoneColumns.push(colIndex);
            }
        }

        return phoneColumns;
    }

    /**
     * Identify ID column by data pattern matching
     * @param {Array} jsonData - Raw worksheet data
     * @param {number} startRow - Row index to start pattern matching
     * @returns {number|null} Column index for ID column or null if not found
     */
    identifyIdColumnByPattern(jsonData, startRow = 0) {
        const sampleSize = Math.min(10, jsonData.length - startRow);

        if (sampleSize <= 0 || !jsonData[startRow]) {
            return null;
        }

        const columnCount = jsonData[startRow].length;

        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            let uniqueValues = new Set();
            let totalNonEmpty = 0;

            for (let rowIndex = startRow; rowIndex < startRow + sampleSize && rowIndex < jsonData.length; rowIndex++) {
                const row = jsonData[rowIndex];
                if (row && row[colIndex]) {
                    const cellValue = String(row[colIndex]).trim();
                    if (cellValue) {
                        totalNonEmpty++;
                        uniqueValues.add(cellValue);
                    }
                }
            }

            // If all non-empty values are unique, likely an ID column
            if (totalNonEmpty > 0 && uniqueValues.size === totalNonEmpty && totalNonEmpty >= 3) {
                return colIndex;
            }
        }

        return null;
    }

    /**
     * Extract multiple phone numbers from a single row and create separate records
     * @param {Array} row - Row data array
     * @param {Object} columnMapping - Column mapping information
     * @param {string} sheetName - Name of the worksheet
     * @param {number} recordId - Base record ID for this row
     * @returns {Array} Array of phone records for this row
     */
    extractMultiplePhoneNumbersFromRow(row, columnMapping, sheetName, recordId) {
        const phoneRecords = [];
        const validPhoneNumbers = [];

        // First pass: collect all phone numbers from this row (including invalid ones)
        for (const phoneColIndex of columnMapping.phoneColumns) {
            const rawPhoneNumber = row[phoneColIndex];
            const phoneNumber = this.cleanPhoneNumber(rawPhoneNumber);

            // Include all phone numbers, even if they don't validate as Singapore numbers
            if (phoneNumber && phoneNumber.trim() !== '') {
                validPhoneNumbers.push({
                    phoneNumber: phoneNumber,
                    columnIndex: phoneColIndex,
                    isValidSingapore: this.validatePhoneNumber(phoneNumber)
                });
            }
        }

        // Second pass: create records with appropriate ID generation
        let phoneSequence = 1;
        const hasMultiplePhones = validPhoneNumbers.length > 1;

        for (const phoneData of validPhoneNumbers) {
            // Generate unique ID for each phone number
            let id;
            if (columnMapping.idColumn !== null && row[columnMapping.idColumn]) {
                const baseId = String(row[columnMapping.idColumn]).trim();
                // Only append sequence number if this row actually has multiple phone numbers
                id = hasMultiplePhones ? `${baseId}_${phoneSequence}` : baseId;
            } else {
                // Use phone number as the primary identifier for consistent duplicate detection
                // This ensures that records with the same phone get the same ID for company data updates
                id = phoneData.phoneNumber; // Use phone number directly as ID
            }

            // Extract metadata preserving row context and company information
            const metadata = this.extractRowMetadata(row, columnMapping, phoneData.columnIndex);
            const companyData = this.extractCompanyData(row, columnMapping);

            // Add multi-phone tracking metadata only when there are actually multiple phones
            if (hasMultiplePhones) {
                metadata.multiPhoneRow = true;
                metadata.phoneSequence = phoneSequence;
                metadata.totalPhonesInRow = validPhoneNumbers.length;
                metadata.baseRowId = columnMapping.idColumn !== null && row[columnMapping.idColumn] ?
                    String(row[columnMapping.idColumn]).trim() : `${sheetName}_${recordId}`;
            }

            phoneRecords.push({
                id: id,
                phoneNumber: phoneData.phoneNumber,
                sourceWorksheet: sheetName,
                companyName: companyData.companyName,
                physicalAddress: companyData.physicalAddress,
                email: companyData.email,
                website: companyData.website,
                metadata: {
                    ...metadata,
                    isValidSingaporeNumber: phoneData.isValidSingapore
                }
            });

            phoneSequence++;
        }

        return phoneRecords;
    }

    /**
     * Extract metadata from row for a specific phone number
     * @param {Array} row - Row data array
     * @param {Object} columnMapping - Column mapping information
     * @param {number} phoneColumnIndex - Index of the phone column being processed
     * @returns {Object} Metadata object
     */
    extractRowMetadata(row, columnMapping, phoneColumnIndex) {
        const metadata = {
            phoneColumnIndex: phoneColumnIndex
        };

        // Add any other non-phone, non-ID, non-company columns as additional metadata
        for (let i = 0; i < row.length; i++) {
            if (i !== columnMapping.idColumn &&
                !columnMapping.phoneColumns.includes(i) &&
                !Object.values(columnMapping.companyColumns).includes(i) &&
                row[i]) {
                metadata[`column_${i}`] = String(row[i]).trim();
            }
        }

        return metadata;
    }

    /**
     * Extract company data from row
     * @param {Array} row - Row data array
     * @param {Object} columnMapping - Column mapping information
     * @returns {Object} Company data object
     */
    extractCompanyData(row, columnMapping) {
        const companyData = {
            companyName: null,
            physicalAddress: null,
            email: null,
            website: null
        };

        // Extract company information from identified columns
        if (columnMapping.companyColumns.name !== undefined && row[columnMapping.companyColumns.name]) {
            companyData.companyName = String(row[columnMapping.companyColumns.name]).trim();
        }

        if (columnMapping.companyColumns.address !== undefined && row[columnMapping.companyColumns.address]) {
            companyData.physicalAddress = String(row[columnMapping.companyColumns.address]).trim();
        }

        if (columnMapping.companyColumns.email !== undefined && row[columnMapping.companyColumns.email]) {
            companyData.email = String(row[columnMapping.companyColumns.email]).trim();
        }

        if (columnMapping.companyColumns.website !== undefined && row[columnMapping.companyColumns.website]) {
            companyData.website = String(row[columnMapping.companyColumns.website]).trim();
        }

        return companyData;
    }

    /**
     * Clean and normalize phone number
     * @param {string} phoneNumber - Raw phone number string
     * @returns {string|null} Cleaned phone number or null if invalid
     */
    cleanPhoneNumber(phoneNumber) {
        if (!phoneNumber) {
            return null;
        }

        // Convert to string and remove all non-digit characters
        const cleaned = String(phoneNumber).replace(/\D/g, '');

        // Remove leading country codes (65 for Singapore)
        if (cleaned.startsWith('65') && cleaned.length === 10) {
            return cleaned.substring(2);
        }

        return cleaned || null;
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
     * Process mixed batch containing both new and potentially duplicate records
     * @param {Array} mixedBatch - Batch that may contain duplicates
     * @param {string} sourceFile - Source Excel filename
     * @returns {Promise<Object>} Mixed batch processing result
     */
    async processMixedBatch(mixedBatch, sourceFile) {
        const result = {
            success: false,
            totalRecords: mixedBatch.length,
            newRecordsProcessed: 0,
            duplicatesSkipped: 0,
            errors: [],
            newRecordIds: [],
            duplicateIds: []
        };

        try {
            // Step 1: Check for duplicates in the mixed batch
            const duplicateCheck = await this.duplicateDetectionService.checkForDuplicates(mixedBatch);

            // Step 2: Process only new records with transaction protection
            if (duplicateCheck.newRecords.length > 0) {
                const transactionResult = await databaseManager.transactionSafeDuplicateSkipping(
                    duplicateCheck.newRecords,
                    sourceFile
                );

                result.newRecordsProcessed = transactionResult.processedRecords;
                result.newRecordIds = transactionResult.processedRecordIds;
                result.errors.push(...transactionResult.errors);

                // Handle any additional duplicates found during transaction
                result.duplicatesSkipped += transactionResult.duplicatesSkipped;
                result.duplicateIds.push(...transactionResult.duplicateIds);
            }

            // Step 3: Add pre-detected duplicates to the result
            result.duplicatesSkipped += duplicateCheck.duplicateCount;
            result.duplicateIds.push(...duplicateCheck.duplicateIds);

            // Step 4: Log duplicate entries
            for (const duplicate of duplicateCheck.duplicates) {
                this.duplicateDetectionService.logDuplicateEntry(duplicate, sourceFile);
            }

            result.success = (result.newRecordsProcessed + result.duplicatesSkipped) === result.totalRecords;

            console.log(`Mixed batch processed: ${result.newRecordsProcessed} new records, ${result.duplicatesSkipped} duplicates skipped`);

        } catch (error) {
            result.errors.push(`Mixed batch processing error: ${error.message}`);
            console.error('Error processing mixed batch:', error.message);
        }

        return result;
    }

    /**
     * Handle partial batch failures with recovery mechanisms
     * @param {Array} failedBatch - Batch that failed processing
     * @param {string} sourceFile - Source Excel filename
     * @param {Error} originalError - Original error that caused failure
     * @returns {Promise<Object>} Recovery processing result
     */
    async handlePartialBatchFailure(failedBatch, sourceFile, originalError) {
        const recoveryResult = {
            success: false,
            originalBatchSize: failedBatch.length,
            recoveredRecords: 0,
            permanentFailures: 0,
            duplicatesFound: 0,
            errors: [],
            recoveredRecordIds: [],
            duplicateIds: [],
            failedRecordIds: []
        };

        try {
            console.log(`Attempting recovery for failed batch of ${failedBatch.length} records`);

            // Classify the original error
            const errorClassification = databaseManager.classifyDatabaseError(originalError);

            if (errorClassification.shouldRetry) {
                // For retryable errors, wait and try with smaller batches
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Process records individually for maximum recovery
                for (const record of failedBatch) {
                    try {
                        const singleRecordResult = await this.processMixedBatch([record], sourceFile);

                        if (singleRecordResult.success) {
                            recoveryResult.recoveredRecords += singleRecordResult.newRecordsProcessed;
                            recoveryResult.duplicatesFound += singleRecordResult.duplicatesSkipped;
                            recoveryResult.recoveredRecordIds.push(...singleRecordResult.newRecordIds);
                            recoveryResult.duplicateIds.push(...singleRecordResult.duplicateIds);
                        } else {
                            recoveryResult.permanentFailures++;
                            recoveryResult.failedRecordIds.push(record.id || record.Id);
                            recoveryResult.errors.push(...singleRecordResult.errors);
                        }

                    } catch (recordError) {
                        recoveryResult.permanentFailures++;
                        recoveryResult.failedRecordIds.push(record.id || record.Id);
                        recoveryResult.errors.push(`Record ${record.id || record.Id}: ${recordError.message}`);
                    }
                }
            } else {
                // For non-retryable errors, mark all as permanent failures
                recoveryResult.permanentFailures = failedBatch.length;
                recoveryResult.failedRecordIds = failedBatch.map(r => r.id || r.Id);
                recoveryResult.errors.push(`Non-retryable error: ${originalError.message}`);
            }

            recoveryResult.success = recoveryResult.recoveredRecords > 0 || recoveryResult.duplicatesFound > 0;

            console.log(`Batch recovery completed: ${recoveryResult.recoveredRecords} recovered, ${recoveryResult.duplicatesFound} duplicates, ${recoveryResult.permanentFailures} permanent failures`);

        } catch (recoveryError) {
            recoveryResult.errors.push(`Recovery failed: ${recoveryError.message}`);
            console.error('Batch recovery failed:', recoveryError.message);
        }

        return recoveryResult;
    }

    /**
     * Prepare Excel-specific metadata for backup table storage
     * @param {Object} record - Phone record with metadata
     * @param {string} sourceFile - Source Excel filename
     * @returns {Object} Excel metadata object
     */
    prepareExcelMetadata(record, sourceFile) {
        const metadata = {
            file_type: 'excel',
            source_file: sourceFile,
            extraction_timestamp: new Date().toISOString(),
            source_worksheet: record.sourceWorksheet,
            original_row_index: record.originalRowIndex,
            phone_column_index: record.metadata?.phoneColumnIndex,
            company_info: {},
            multi_phone_info: {}
        };

        // Handle multi-phone row metadata
        if (record.metadata?.multiPhoneRow) {
            metadata.multi_phone_info = {
                is_multi_phone_row: true,
                phone_sequence: record.metadata.phoneSequence,
                total_phones_in_row: record.metadata.totalPhonesInRow,
                base_row_id: record.metadata.baseRowId
            };
        }

        // Extract company information from record metadata
        if (record.metadata) {
            const companyFields = ['name', 'email', 'address', 'website', 'companyName'];
            for (const field of companyFields) {
                if (record.metadata[field]) {
                    metadata.company_info[field] = record.metadata[field];
                }
            }

            // Include any additional metadata columns
            for (const [key, value] of Object.entries(record.metadata)) {
                if (key.startsWith('column_') && value) {
                    metadata.company_info[key] = value;
                }
            }
        }

        return metadata;
    }

    /**
     * Create batches from array of records
     * @param {Array} records - Array of records to batch
     * @param {number} batchSize - Size of each batch
     * @returns {Array} Array of batches
     */
    createBatches(records, batchSize) {
        const batches = [];
        for (let i = 0; i < records.length; i += batchSize) {
            batches.push(records.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Handle Excel-specific storage errors with recovery
     * @param {Error} error - Storage error
     * @param {Array} failedRecords - Records that failed to store
     * @param {string} sourceFile - Source Excel filename
     * @returns {Promise<Object>} Error handling result
     */
    async handleStorageError(error, failedRecords, sourceFile) {
        const errorResult = {
            recovered: false,
            recoveredRecords: 0,
            permanentFailures: [],
            recoveryAttempts: 0
        };

        try {
            console.log(`Attempting to recover from storage error: ${error.message}`);

            // Check if it's a connection error
            if (error.message.includes('connection') || error.message.includes('timeout')) {
                // Wait and retry with smaller batches
                await new Promise(resolve => setTimeout(resolve, 2000));

                const smallBatches = this.createBatches(failedRecords, Math.floor(this.batchSize / 4));

                for (const batch of smallBatches) {
                    try {
                        const recoveryResult = await this.storeBatchToBackupTable(batch, sourceFile, 'recovery');
                        errorResult.recoveredRecords += recoveryResult.storedCount;
                        errorResult.recoveryAttempts++;
                    } catch (recoveryError) {
                        errorResult.permanentFailures.push(...batch);
                    }
                }

                errorResult.recovered = errorResult.recoveredRecords > 0;
            } else {
                // For other errors, mark as permanent failures
                errorResult.permanentFailures = failedRecords;
            }

        } catch (recoveryError) {
            console.error('Error recovery failed:', recoveryError.message);
            errorResult.permanentFailures = failedRecords;
        }

        return errorResult;
    }

    /**
     * Analyze multi-phone row processing results
     * @param {Array} phoneRecords - All extracted phone records
     * @returns {Object} Multi-phone analysis report
     */
    analyzeMultiPhoneRows(phoneRecords) {
        const analysis = {
            totalRecords: phoneRecords.length,
            singlePhoneRecords: 0,
            multiPhoneRecords: 0,
            multiPhoneRows: 0,
            phoneDistribution: {},
            baseRowGroups: {}
        };

        // Group records by base row ID for multi-phone analysis
        for (const record of phoneRecords) {
            if (record.metadata?.multiPhoneRow) {
                analysis.multiPhoneRecords++;

                const baseRowId = record.metadata.baseRowId;
                if (!analysis.baseRowGroups[baseRowId]) {
                    analysis.baseRowGroups[baseRowId] = {
                        phones: [],
                        totalPhones: record.metadata.totalPhonesInRow,
                        worksheet: record.sourceWorksheet
                    };
                    analysis.multiPhoneRows++;
                }

                analysis.baseRowGroups[baseRowId].phones.push({
                    id: record.id,
                    phone: record.phoneNumber,
                    sequence: record.metadata.phoneSequence
                });

                // Track phone distribution based on actual phones found, not columns
                const phoneCount = record.metadata.totalPhonesInRow;
                analysis.phoneDistribution[phoneCount] = (analysis.phoneDistribution[phoneCount] || 0) + 1;
            } else {
                analysis.singlePhoneRecords++;
            }
        }

        // Calculate statistics
        analysis.averagePhonesPerMultiRow = analysis.multiPhoneRows > 0 ?
            Math.round((analysis.multiPhoneRecords / analysis.multiPhoneRows) * 100) / 100 : 0;

        return analysis;
    }

    /**
     * Generate multi-phone processing report
     * @param {Array} phoneRecords - All extracted phone records
     * @returns {Object} Detailed multi-phone report
     */
    generateMultiPhoneReport(phoneRecords) {
        const analysis = this.analyzeMultiPhoneRows(phoneRecords);

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalRecords: analysis.totalRecords,
                singlePhoneRecords: analysis.singlePhoneRecords,
                multiPhoneRecords: analysis.multiPhoneRecords,
                multiPhoneRows: analysis.multiPhoneRows,
                averagePhonesPerMultiRow: analysis.averagePhonesPerMultiRow
            },
            phoneDistribution: analysis.phoneDistribution,
            multiPhoneRowDetails: [],
            recommendations: []
        };

        // Add details for each multi-phone row
        for (const [baseRowId, group] of Object.entries(analysis.baseRowGroups)) {
            report.multiPhoneRowDetails.push({
                baseRowId: baseRowId,
                worksheet: group.worksheet,
                phoneCount: group.totalPhones,
                phones: group.phones.sort((a, b) => a.sequence - b.sequence)
            });
        }

        // Generate recommendations
        if (analysis.multiPhoneRows > 0) {
            report.recommendations.push(
                `Found ${analysis.multiPhoneRows} rows with multiple phone numbers. ` +
                `Each phone number has been created as a separate record while preserving row context.`
            );
        }

        if (Object.keys(analysis.phoneDistribution).length > 1) {
            const maxPhones = Math.max(...Object.keys(analysis.phoneDistribution).map(Number));
            report.recommendations.push(
                `Rows contain varying numbers of phone numbers (up to ${maxPhones} per row). ` +
                `Consider standardizing data format for consistency.`
            );
        }

        return report;
    }

    /**
     * Trigger phone validation processing for Excel records
     * @param {Array} recordIds - Array of record IDs to validate
     * @returns {Promise<Object>} Validation processing results
     */
    async triggerPhoneValidation(recordIds = null) {
        try {
            console.log('Triggering Singapore phone validation for Excel records...');

            let validationResults;

            if (recordIds && Array.isArray(recordIds) && recordIds.length > 0) {
                // Process specific Excel records
                validationResults = await phoneValidationProcessor.processSpecificRecords(recordIds);
                console.log(`Excel-specific validation completed for ${recordIds.length} records:`, validationResults);
            } else {
                // Process all records in check_table (backup_table not used in PostgreSQL)
                validationResults = await phoneValidationProcessor.processBackupRecords();
                console.log('Batch validation completed for all Excel records:', validationResults);
            }

            return {
                success: true,
                validationResults: validationResults,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error triggering phone validation for Excel records:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process Excel file with integrated phone validation
     * @param {Buffer} excelBuffer - Excel file buffer
     * @param {string} sourceFile - Original filename
     * @param {boolean} autoValidate - Whether to automatically trigger validation
     * @returns {Promise<Object>} Complete processing results including validation
     */
    async processExcelWithValidation(excelBuffer, sourceFile = null, autoValidate = true) {
        try {
            console.log('Starting Excel processing with integrated validation...');

            // Step 1: Extract data from Excel
            const phoneRecords = await this.extractData(excelBuffer);
            console.log(`Extracted ${phoneRecords.length} phone records from Excel`);

            // Step 2: Store to backup table
            const storageResult = await this.storeToBackupTable(phoneRecords, sourceFile);
            console.log(`Storage completed: ${storageResult.storedRecords} records stored`);

            if (!storageResult.success) {
                const errorDetails = storageResult.errors.length > 0
                    ? storageResult.errors.join(', ')
                    : 'Unknown storage error';
                throw new Error(`Failed to store Excel records to backup table: ${errorDetails}`);
            }

            if (storageResult.storedRecords === 0 && storageResult.duplicatesSkipped === 0) {
                throw new Error('No records were stored or found. The Excel file may be empty or invalid.');
            }

            // Step 3: Trigger phone validation if enabled
            let validationResult = null;
            if (autoValidate) {
                // Get the IDs of successfully stored records
                const storedRecordIds = phoneRecords
                    .slice(0, storageResult.storedRecords)
                    .map(record => record.id);

                validationResult = await this.triggerPhoneValidation(storedRecordIds);
            }

            // Step 4: Generate comprehensive report with duplicate information
            const extractionReport = this.generateExtractionReport(phoneRecords, storageResult);

            return {
                success: true,
                extraction: {
                    totalRecords: phoneRecords.length,
                    extractionReport: extractionReport
                },
                storage: storageResult,
                validation: validationResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in Excel processing with validation:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get Excel processing status including validation status
     * @param {Array} recordIds - Array of record IDs to check
     * @returns {Promise<Object>} Processing and validation status
     */
    async getExcelProcessingStatus(recordIds = null) {
        try {
            // Get overall processing status
            const processingStatus = await phoneValidationProcessor.getProcessingStatus();

            // Get Excel-specific statistics if record IDs provided
            let excelSpecificStats = null;
            if (recordIds && Array.isArray(recordIds) && recordIds.length > 0) {

                const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(',');
                const checkRecords = await databaseManager.query(
                    `SELECT id, phone, status FROM check_table WHERE id IN (${placeholders})`,
                    recordIds
                );

                excelSpecificStats = {
                    totalExcelRecords: checkRecords.length,
                    validatedExcelRecords: checkRecords.length,
                    pendingValidation: 0,
                    validSingaporeNumbers: checkRecords.filter(r => r.Status === 1).length,
                    invalidNumbers: checkRecords.filter(r => r.Status === 0).length
                };
            }

            return {
                success: true,
                overallStatus: processingStatus,
                excelSpecificStats: excelSpecificStats,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting Excel processing status:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Generate detailed extraction report with duplicate handling information
     * @param {Array} phoneRecords - Extracted phone records
     * @param {Object} storageResult - Storage result with duplicate information
     * @returns {Object} Detailed extraction report
     */
    generateExtractionReport(phoneRecords = [], storageResult = null) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalRecords: phoneRecords.length,
                worksheetsProcessed: 0,
                phoneNumbersFound: phoneRecords.length,
                uniquePhoneNumbers: new Set(phoneRecords.map(r => r.phoneNumber)).size
            },
            worksheetDetails: {},
            columnMapping: {},
            dataQuality: {
                validPhoneNumbers: 0,
                recordsWithMetadata: 0,
                duplicatePhoneNumbers: 0
            },
            multiPhoneAnalysis: {},
            duplicateHandling: {
                enabled: true,
                duplicatesFound: 0,
                duplicatePercentage: 0,
                newRecordsStored: 0,
                duplicateReport: null
            },
            processingErrors: []
        };

        // Use last processing report if available
        if (this.lastProcessingReport) {
            report.summary.worksheetsProcessed = this.lastProcessingReport.worksheetsProcessed.length;
            report.processingErrors = this.lastProcessingReport.errors || [];

            // Build worksheet details
            for (const worksheet of this.lastProcessingReport.worksheetsProcessed) {
                report.worksheetDetails[worksheet.name] = {
                    recordCount: worksheet.recordCount,
                    phoneNumbers: phoneRecords
                        .filter(r => r.sourceWorksheet === worksheet.name)
                        .map(r => r.phoneNumber)
                };
            }
        }

        // Analyze data quality
        const phoneNumbers = phoneRecords.map(r => r.phoneNumber);
        const uniquePhones = new Set(phoneNumbers);

        report.dataQuality.validPhoneNumbers = phoneRecords.filter(r =>
            this.validatePhoneNumber(r.phoneNumber)
        ).length;

        report.dataQuality.recordsWithMetadata = phoneRecords.filter(r =>
            r.metadata && Object.keys(r.metadata).length > 1
        ).length;

        report.dataQuality.duplicatePhoneNumbers = phoneNumbers.length - uniquePhones.size;

        // Add multi-phone analysis
        report.multiPhoneAnalysis = this.analyzeMultiPhoneRows(phoneRecords);

        // Add duplicate handling information if storage result is provided
        if (storageResult) {
            report.duplicateHandling.duplicatesFound = storageResult.duplicatesSkipped || 0;
            report.duplicateHandling.duplicatePercentage = phoneRecords.length > 0 ?
                Math.round((report.duplicateHandling.duplicatesFound / phoneRecords.length) * 10000) / 100 : 0;
            report.duplicateHandling.newRecordsStored = storageResult.storedRecords || 0;
            report.duplicateHandling.duplicateReport = storageResult.duplicateReport;

            // Add duplicate statistics to summary
            report.summary.duplicatesSkipped = report.duplicateHandling.duplicatesFound;
            report.summary.newRecordsStored = report.duplicateHandling.newRecordsStored;
            report.summary.duplicatePercentage = report.duplicateHandling.duplicatePercentage;
        }

        return report;
    }
    /**
     * Update performance metrics after processing
     * @param {number} processingTime - Time taken to process in milliseconds
     * @param {number} recordCount - Number of records processed
     * @param {number} worksheetCount - Number of worksheets processed
     * @param {Object} startMemory - Memory usage at start
     * @param {Object} endMemory - Memory usage at end
     */
    updatePerformanceMetrics(processingTime, recordCount, worksheetCount, startMemory, endMemory) {
        this.performanceMetrics.filesProcessed++;
        this.performanceMetrics.recordsProcessed += recordCount;
        this.performanceMetrics.worksheetsProcessed += worksheetCount;
        this.performanceMetrics.totalProcessingTime += processingTime;
        this.performanceMetrics.averageProcessingTime = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.filesProcessed;
        this.performanceMetrics.largestRecordCount = Math.max(this.performanceMetrics.largestRecordCount, recordCount);

        // Track memory usage
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        this.performanceMetrics.memoryUsage.peak = Math.max(this.performanceMetrics.memoryUsage.peak, endMemory.heapUsed);
        this.performanceMetrics.memoryUsage.samples.push(memoryDelta);

        // Keep only last 100 samples for average calculation
        if (this.performanceMetrics.memoryUsage.samples.length > 100) {
            this.performanceMetrics.memoryUsage.samples.shift();
        }

        this.performanceMetrics.memoryUsage.average = this.performanceMetrics.memoryUsage.samples.reduce((a, b) => a + b, 0) / this.performanceMetrics.memoryUsage.samples.length;
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics object
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            memoryUsage: {
                ...this.performanceMetrics.memoryUsage,
                peakMB: Math.round(this.performanceMetrics.memoryUsage.peak / 1024 / 1024 * 100) / 100,
                averageMB: Math.round(this.performanceMetrics.memoryUsage.average / 1024 / 1024 * 100) / 100
            },
            averageRecordsPerSecond: this.performanceMetrics.averageProcessingTime > 0 ?
                Math.round((this.performanceMetrics.recordsProcessed / (this.performanceMetrics.totalProcessingTime / 1000)) * 100) / 100 : 0,
            averageProcessingTimeSeconds: Math.round(this.performanceMetrics.averageProcessingTime / 1000 * 100) / 100
        };
    }

    /**
     * Reset performance metrics
     */
    resetPerformanceMetrics() {
        this.performanceMetrics = {
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            filesProcessed: 0,
            recordsProcessed: 0,
            worksheetsProcessed: 0,
            largestFileSize: 0,
            largestRecordCount: 0,
            errorCount: 0,
            memoryUsage: {
                peak: 0,
                average: 0,
                samples: []
            }
        };
    }

    /**
     * Optimize Excel processing for large files
     * @param {Buffer} excelBuffer - Excel file buffer
     * @returns {Promise<Array>} Optimized processing result
     */
    async optimizedExtractData(excelBuffer) {
        const fileSize = excelBuffer.length;

        // Use streaming for large files
        if (fileSize > this.optimizationSettings.streamingThreshold) {
            return this.streamingExtractData(excelBuffer);
        }

        // Use regular processing for smaller files
        return this.extractData(excelBuffer);
    }

    /**
     * Streaming extraction for large Excel files
     * @param {Buffer} excelBuffer - Excel file buffer
     * @returns {Promise<Array>} Streamed processing result
     */
    async streamingExtractData(excelBuffer) {
        const startTime = Date.now();
        console.log('Using streaming mode for large Excel file processing');

        try {
            // Parse workbook with streaming options
            const workbook = XLSX.read(excelBuffer, {
                type: 'buffer',
                cellDates: false,
                cellNF: false,
                cellStyles: false,
                sheetStubs: false
            });

            const allPhoneRecords = [];
            const maxWorksheets = Math.min(workbook.SheetNames.length, this.optimizationSettings.maxWorksheetsPerFile);

            // Process worksheets in batches
            for (let i = 0; i < maxWorksheets; i++) {
                const sheetName = workbook.SheetNames[i];
                const worksheet = workbook.Sheets[sheetName];

                // Process worksheet in chunks
                const sheetRecords = await this.processWorksheetInChunks(worksheet, sheetName);
                allPhoneRecords.push(...sheetRecords);

                // Memory management - force garbage collection if available
                if (global.gc && allPhoneRecords.length % 10000 === 0) {
                    global.gc();
                }
            }

            const endTime = Date.now();
            console.log(`Streaming processing completed in ${endTime - startTime}ms for ${allPhoneRecords.length} records`);

            return allPhoneRecords;
        } catch (error) {
            console.error('Streaming extraction error:', error);
            throw error;
        }
    }

    /**
     * Process worksheet in chunks for memory efficiency
     * @param {Object} worksheet - XLSX worksheet
     * @param {string} sheetName - Worksheet name
     * @returns {Promise<Array>} Processed records
     */
    async processWorksheetInChunks(worksheet, sheetName) {
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            raw: false
        });

        if (!jsonData || jsonData.length === 0) {
            return [];
        }

        // Limit records per worksheet for performance
        const maxRecords = Math.min(jsonData.length, this.optimizationSettings.maxRecordsPerWorksheet);
        const limitedData = jsonData.slice(0, maxRecords);

        const { headerRowIndex, dataRows } = this.identifyDataStructure(limitedData);

        if (dataRows.length === 0) {
            return [];
        }

        const columnMapping = this.identifyColumns(limitedData, headerRowIndex);

        if (!columnMapping.phoneColumns || columnMapping.phoneColumns.length === 0) {
            return [];
        }

        // Process in chunks
        const chunkSize = 1000;
        const phoneRecords = [];

        for (let i = 0; i < dataRows.length; i += chunkSize) {
            const chunk = dataRows.slice(i, i + chunkSize);

            for (let j = 0; j < chunk.length; j++) {
                try {
                    const rowPhoneRecords = this.extractMultiplePhoneNumbersFromRow(
                        chunk[j],
                        columnMapping,
                        sheetName,
                        i + j + 1
                    );

                    phoneRecords.push(...rowPhoneRecords);
                } catch (rowError) {
                    console.warn(`Error processing row ${i + j + 1} in worksheet '${sheetName}':`, rowError.message);
                    continue;
                }
            }

            // Yield control periodically for large datasets
            if (i % 5000 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        return phoneRecords;
    }

    /**
     * Get processing statistics comparison between PDF and Excel
     * @returns {Promise<Object>} Comparison statistics
     */
    async getProcessingComparison() {
        try {
            // Get Excel processing stats
            const excelStats = this.getPerformanceMetrics();

            // Get validation stats by source type
            const validationStats = await phoneValidationProcessor.getValidationStatsBySourceType();

            return {
                success: true,
                comparison: {
                    excel: {
                        filesProcessed: excelStats.filesProcessed,
                        recordsProcessed: excelStats.recordsProcessed,
                        averageProcessingTime: excelStats.averageProcessingTimeSeconds,
                        averageRecordsPerSecond: excelStats.averageRecordsPerSecond,
                        memoryUsage: excelStats.memoryUsage,
                        errorRate: excelStats.filesProcessed > 0 ? (excelStats.errorCount / excelStats.filesProcessed) : 0
                    },
                    validation: validationStats.success ? validationStats.statsBySourceType : null,
                    systemHealth: {
                        memoryPeak: excelStats.memoryUsage.peakMB,
                        averageMemoryUsage: excelStats.memoryUsage.averageMB,
                        totalRecordsProcessed: excelStats.recordsProcessed
                    }
                }
            };
        } catch (error) {
            console.error('Error getting processing comparison:', error);
            return {
                success: false,
                error: 'Failed to retrieve processing comparison statistics'
            };
        }
    }

    /**
     * Process Excel file and save directly to check_table only
     * Note: backup_table and uploaded_files are not used in PostgreSQL schema
     * Simplified: Store ALL data without validation, update duplicates by ID+Phone
     * @param {Buffer} excelBuffer - Excel file buffer
     * @param {string} sourceFile - Original filename
     * @returns {Promise<Object>} Processing results
     */
    async processExcelDirectToCheckTable(excelBuffer, sourceFile = null) {
        const startTime = Date.now();

        try {
            console.log('Starting simplified Excel processing - storing ALL data...');

            // Step 1: Read Excel directly without column detection
            const records = await this.extractDataSimplified(excelBuffer);
            console.log(`Extracted ${records.length} records from Excel`);

            if (records.length === 0) {
                return {
                    success: false,
                    error: 'No records found in Excel file',
                    totalRecords: 0,
                    storedRecords: 0,
                    updatedRecords: 0,
                    validRecords: 0,
                    invalidRecords: 0
                };
            }

            // Step 2: Process each record - insert or update
            const result = {
                success: false,
                totalRecords: records.length,
                storedRecords: 0,
                updatedRecords: 0,
                validRecords: 0,
                invalidRecords: 0,
                errors: []
            };

            const singaporePhoneValidator = require('./singaporePhoneValidator');

            for (const record of records) {
                try {
                    const { id, phone, companyName, physicalAddress, email, website } = record;

                    if (!phone) {
                        console.warn(`Skipping record with no phone: ${id}`);
                        continue;
                    }

                    // Check if record exists by ID and Phone
                    const existing = await this.checkExistingRecordByIdAndPhone(id, phone);

                    // Validate Singapore phone (but store regardless)
                    const isValidSingapore = singaporePhoneValidator.validateSingaporePhone(phone);

                    if (existing) {
                        // Update existing record
                        await this.updateRecordInCheckTable(id, phone, {
                            companyName,
                            physicalAddress,
                            email,
                            website,
                            status: isValidSingapore ? 1 : 0
                        });
                        result.updatedRecords++;
                    } else {
                        // Insert new record
                        await databaseManager.insertCheckRecord(
                            id,
                            phone,
                            isValidSingapore,
                            companyName,
                            physicalAddress,
                            email,
                            website
                        );
                        result.storedRecords++;
                    }

                    if (isValidSingapore) {
                        result.validRecords++;
                    } else {
                        result.invalidRecords++;
                    }

                } catch (error) {
                    console.error(`Error processing record ${record.id}:`, error.message);
                    result.errors.push(`Record ${record.id}: ${error.message}`);
                }
            }

            result.success = result.storedRecords > 0 || result.updatedRecords > 0;

            const processingTime = Date.now() - startTime;
            console.log(`Excel processing completed in ${processingTime}ms:`);
            console.log(`- Total: ${result.totalRecords}`);
            console.log(`- New: ${result.storedRecords}`);
            console.log(`- Updated: ${result.updatedRecords}`);
            console.log(`- Valid SG: ${result.validRecords}`);
            console.log(`- Invalid: ${result.invalidRecords}`);

            return result;

        } catch (error) {
            console.error('Error in Excel processing:', error.message);
            return {
                success: false,
                error: error.message,
                totalRecords: 0,
                storedRecords: 0,
                updatedRecords: 0,
                validRecords: 0,
                invalidRecords: 0
            };
        }
    }

    /**
     * Simplified Excel data extraction - NO column detection
     * Expects Excel with columns: Id, Phone, Company Name, Physical Address, Email, Website
     * @param {Buffer} excelBuffer - Excel file buffer
     * @returns {Promise<Array>} Array of records
     */
    async extractDataSimplified(excelBuffer) {
        try {
            if (!excelBuffer || !Buffer.isBuffer(excelBuffer)) {
                throw new Error('Invalid Excel buffer');
            }

            if (excelBuffer.length === 0) {
                throw new Error('Empty Excel file');
            }

            // Parse Excel workbook
            const workbook = XLSX.read(excelBuffer, { type: 'buffer' });

            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('No worksheets found in Excel file');
            }

            const allRecords = [];

            // Process first worksheet only (or all if needed)
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON with first row as headers
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,
                    defval: ''
                });

                console.log(`Processing worksheet "${sheetName}": ${jsonData.length} rows`);

                // Map each row to our format
                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i];

                    // Extract data from various possible column names
                    const record = {
                        id: this.getFieldValue(row, ['Id', 'ID', 'id', 'No', 'Number', 'Record ID', 'RecordID']) || `Row_${i + 1}`,
                        phone: this.cleanPhoneNumber(
                            this.getFieldValue(row, [
                                // Common variants
                                'Phone', 'phone', 'Phone Number', 'PhoneNumber', 'Phone No', 'PhoneNo',
                                // Contact variants
                                'Contact', 'Contact Number', 'ContactNumber', 'Contact No', 'ContactNo',
                                // Tel variants
                                'Tel', 'Telephone', 'Tel No', 'Telephone Number',
                                // Mobile variants
                                'Mobile', 'Mobile Number', 'MobileNumber', 'Mobile No', 'MobileNo',
                                // Other common labels
                                'HP', 'Handphone', 'Hand Phone', 'WhatsApp', 'WhatsApp Number', 'Whatsapp', 'Whatsapp Number'
                            ])
                        ),
                        companyName: this.getFieldValue(row, ['Company Name', 'CompanyName', 'Company', 'Name', 'Business Name', 'Organisation', 'Organization']),
                        physicalAddress: this.getFieldValue(row, ['Physical Address', 'PhysicalAddress', 'Address', 'Addr', 'Location']),
                        email: this.getFieldValue(row, ['Email', 'email', 'E-mail', 'Mail', 'Email Address', 'EmailAddress']),
                        website: this.getFieldValue(row, ['Website', 'website', 'Web', 'URL', 'Site', 'Homepage'])
                    };

                    // Only include if we have at least a phone number
                    if (record.phone) {
                        allRecords.push(record);
                    }
                }
            }

            console.log(`Extracted ${allRecords.length} records total`);
            // Fallback: if no records found using simplified headers, try advanced extraction + mapping
            if (allRecords.length === 0) {
                try {
                    console.log('No records found with simplified extraction. Falling back to advanced detection...');
                    const advancedRecords = await this.extractData(excelBuffer);
                    const mapped = (advancedRecords || []).map((r, idx) => ({
                        id: r.id || `Row_${idx + 1}`,
                        phone: this.cleanPhoneNumber(r.phoneNumber),
                        companyName: r.companyName || null,
                        physicalAddress: r.physicalAddress || null,
                        email: r.email || null,
                        website: r.website || null
                    })).filter(r => r.phone);

                    console.log(`Advanced fallback extracted ${mapped.length} records`);
                    return mapped;
                } catch (fallbackErr) {
                    console.warn('Advanced extraction fallback failed:', fallbackErr.message);
                    return allRecords; // remain empty
                }
            }

            return allRecords;

        } catch (error) {
            console.error('Excel extraction error:', error);
            throw new Error(`Failed to extract Excel data: ${error.message}`);
        }
    }

    /**
     * Get field value from row object trying multiple possible column names
     * @param {Object} row - Excel row object
     * @param {Array} possibleNames - Array of possible column names
     * @returns {string|null} Field value or null
     */
    getFieldValue(row, possibleNames) {
        // 1) Exact header match first
        for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) {
                return String(row[name]).trim();
            }
        }

        // 2) Flexible header match: normalize keys and synonyms
        const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedRow = {};
        for (const key of Object.keys(row)) {
            normalizedRow[normalize(key)] = row[key];
        }

        for (const name of possibleNames) {
            const key = normalize(name);
            if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim()) {
                return String(normalizedRow[key]).trim();
            }
        }

        return null;
    }

    /**
     * Check if record exists by both ID and Phone
     * @param {string} id - Record ID
     * @param {string} phone - Phone number
     * @returns {Promise<boolean>} True if exists
     */
    async checkExistingRecordByIdAndPhone(id, phone) {
        try {
            const sql = `SELECT COUNT(*) as count FROM check_table WHERE id = $1 AND phone = $2`;
            const results = await databaseManager.query(sql, [id, phone]);
            return results[0].count > 0;
        } catch (error) {
            console.error('Error checking existing record:', error.message);
            return false;
        }
    }

    /**
     * Update record in check_table by ID and Phone
     * @param {string} id - Record ID
     * @param {string} phone - Phone number
     * @param {Object} data - Data to update
     * @returns {Promise<void>}
     */
    async updateRecordInCheckTable(id, phone, data) {
        try {
            const sql = `
                UPDATE check_table
                SET company_name = COALESCE($1, company_name),
                    physical_address = COALESCE($2, physical_address),
                    email = COALESCE($3, email),
                    website = COALESCE($4, website),
                    status = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6 AND phone = $7
            `;

            await databaseManager.query(sql, [
                data.companyName || null,
                data.physicalAddress || null,
                data.email || null,
                data.website || null,
                data.status !== undefined ? data.status : 0,
                id,
                phone
            ]);

            console.log(`Updated record: ID=${id}, Phone=${phone}`);

        } catch (error) {
            console.error(`Error updating record ${id}:`, error.message);
            throw error;
        }
    }

    /**
     * Check which phone numbers already exist in check_table
     * @param {Array} phoneNumbers - Array of phone numbers to check
     * @returns {Promise<Array>} Array of existing phone numbers
     */
    async checkExistingPhonesInCheckTable(phoneNumbers) {
        try {
            if (!phoneNumbers || phoneNumbers.length === 0) {
                return [];
            }

            const batchSize = 1000;
            const existingPhones = [];

            // Process in batches
            for (let i = 0; i < phoneNumbers.length; i += batchSize) {
                const batch = phoneNumbers.slice(i, i + batchSize);
                const placeholders = batch.map(() => '?').join(',');

                const sql = `SELECT DISTINCT phone as Phone FROM check_table WHERE phone IN (${placeholders})`;
                const results = await databaseManager.query(sql, batch);

                existingPhones.push(...results.map(r => r.Phone));
            }

            return existingPhones;

        } catch (error) {
            console.error('Error checking existing phones:', error.message);
            return [];
        }
    }

    /**
     * Update company data for existing phone number in check_table
     * @param {string} phone - Phone number
     * @param {Object} companyData - Company data to update
     * @returns {Promise<void>}
     */
    async updateCompanyDataInCheckTable(phone, companyData) {
        try {
            const sql = `
                UPDATE check_table
                SET company_name = COALESCE(?, company_name),
                    physical_address = COALESCE(?, physical_address),
                    email = COALESCE(?, email),
                    website = COALESCE(?, website),
                    updated_at = CURRENT_TIMESTAMP
                WHERE phone = ?
            `;

            await databaseManager.query(sql, [
                companyData.companyName || null,
                companyData.physicalAddress || null,
                companyData.email || null,
                companyData.website || null,
                phone
            ]);

            console.log(`Updated company data for phone: ${phone}`);

        } catch (error) {
            console.error(`Error updating company data for ${phone}:`, error.message);
            throw error;
        }
    }
}

module.exports = ExcelProcessor;
