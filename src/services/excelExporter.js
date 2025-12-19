const XLSX = require('xlsx-js-style');
const singaporePhoneValidator = require('./singaporePhoneValidator');
const {
    createBaseStyle,
    createHeaderStyle,
    createStatusStyle
} = require('../utils/excelStylingConfig');

class ExcelExporter {
    constructor() {
        this.defaultHeaders = ['ID', 'Phone Number', 'Company Name', 'Physical Address', 'Email', 'Website', 'Carrier', 'Line Type'];
        this.maxRecordsPerExport = 50000; // Limit for performance
        this.maxFileSizeBytes = 50 * 1024 * 1024; // 50MB limit
    }

    /**
     * Validate export request before processing
     * @param {number} startRecord - Start record number
     * @param {number} endRecord - End record number
     * @returns {Object} Validation result
     */
    async validateExportRequest(startRecord, endRecord) {
        try {
            // Basic parameter validation
            const basicValidation = this.validateBasicParameters(startRecord, endRecord);
            if (!basicValidation.valid) {
                return basicValidation;
            }

            // Database validation
            const dbValidation = await CheckTable.validateExportRange(startRecord, endRecord);
            if (!dbValidation.valid) {
                return dbValidation;
            }

            // Performance validation
            const performanceValidation = this.validatePerformanceConstraints(
                dbValidation.recordCount
            );
            if (!performanceValidation.valid) {
                return performanceValidation;
            }

            return {
                valid: true,
                startRecord: dbValidation.startRecord,
                endRecord: dbValidation.endRecord,
                recordCount: dbValidation.recordCount,
                totalAvailable: dbValidation.totalAvailable,
                warning: dbValidation.warning
            };

        } catch (error) {
            console.error('Export validation failed:', error.message);
            return {
                valid: false,
                error: `Validation error: ${error.message}`
            };
        }
    }

    /**
     * Validate basic parameters
     * @param {*} startRecord - Start record parameter
     * @param {*} endRecord - End record parameter
     * @returns {Object} Validation result
     */
    validateBasicParameters(startRecord, endRecord) {
        // Check if parameters are provided
        if (startRecord === undefined || startRecord === null) {
            return {
                valid: false,
                error: 'Start record parameter is required'
            };
        }

        if (endRecord === undefined || endRecord === null) {
            return {
                valid: false,
                error: 'End record parameter is required'
            };
        }

        // Convert to numbers
        const start = Number(startRecord);
        const end = Number(endRecord);

        // Check if conversion was successful
        if (isNaN(start) || isNaN(end)) {
            return {
                valid: false,
                error: 'Start and end record must be valid numbers'
            };
        }

        // Check if they are integers
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
            return {
                valid: false,
                error: 'Start and end record must be integers'
            };
        }

        // Check if they are positive
        if (start < 1 || end < 1) {
            return {
                valid: false,
                error: 'Record numbers must be greater than 0'
            };
        }

        // Check if start <= end
        if (start > end) {
            return {
                valid: false,
                error: 'Start record must be less than or equal to end record'
            };
        }

        return {
            valid: true,
            startRecord: start,
            endRecord: end
        };
    }

    /**
     * Validate performance constraints
     * @param {number} recordCount - Number of records to export
     * @returns {Object} Validation result
     */
    validatePerformanceConstraints(recordCount) {
        if (recordCount > this.maxRecordsPerExport) {
            return {
                valid: false,
                error: `Export request too large. Maximum ${this.maxRecordsPerExport} records allowed, requested ${recordCount}. Please use smaller ranges.`
            };
        }

        // Estimate file size (rough calculation)
        const estimatedSizeBytes = recordCount * 150; // ~150 bytes per record
        if (estimatedSizeBytes > this.maxFileSizeBytes) {
            return {
                valid: false,
                error: `Estimated file size too large (${Math.round(estimatedSizeBytes / 1024 / 1024)}MB). Please use smaller ranges.`
            };
        }

        return {
            valid: true,
            recordCount,
            estimatedSizeBytes
        };
    }

    /**
     * Generate Excel workbook from phone records array
     * @param {Array} records - Array of phone record objects
     * @param {Object} options - Export options
     * @returns {Object} Excel workbook object
     */
    generateExcel(records, options = {}) {
        try {
            if (!Array.isArray(records)) {
                throw new Error('Records must be an array');
            }

            // Create new workbook
            const workbook = XLSX.utils.book_new();

            // Format headers
            const headers = this.formatHeaders(options.customHeaders);

            // Prepare data for Excel
            const worksheetData = this.prepareWorksheetData(records, headers);

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

            // Apply enhanced formatting with styling parameters
            this.applyWorksheetFormatting(worksheet, worksheetData, records, {
                enableStyling: options.enableStyling !== false, // Default to true
                stylingOptions: options.stylingOptions || {}
            });

            // Add worksheet to workbook
            const sheetName = options.sheetName || 'Singapore Phone Records';
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);


            return workbook;

        } catch (error) {
            console.error('Failed to generate Excel workbook:', error.message);
            throw new Error(`Excel generation failed: ${error.message}`);
        }
    }

    /**
     * Format column headers for Excel export
     * @param {Array} customHeaders - Optional custom headers
     * @returns {Array} Formatted headers array
     */
    formatHeaders(customHeaders = null) {
        if (customHeaders && Array.isArray(customHeaders)) {
            return customHeaders;
        }

        return this.defaultHeaders;
    }

    /**
     * Prepare data for worksheet creation
     * @param {Array} records - Check table records array
     * @param {Array} headers - Column headers
     * @returns {Array} 2D array for worksheet
     */
    prepareWorksheetData(records, headers) {
        const worksheetData = [];

        // Add headers as first row
        worksheetData.push(headers);

        // Add data rows - support lowercase (db) and uppercase (legacy) field names
        records.forEach(record => {
            const row = [
                record.Id || record.id || '',
                record.Phone || record.phone || '',
                record.CompanyName || record['Company Name'] || record.companyName || record.company_name || '',
                record.PhysicalAddress || record['Physical Address'] || record.physicalAddress || record.physical_address || '',
                record.Email || record.email || '',
                record.Website || record.website || '',
                record.Carrier || record.carrier || '',
                record.LineType || record.line_type || record.lineType || ''
            ];
            worksheetData.push(row);
        });

        return worksheetData;
    }

    /**
     * Detect status value from record with fallback handling
     * Uses Singapore phone validation if Status field is not present
     * @param {Object} record - Record object to check for status
     * @returns {boolean|null} Status value or null if not found/invalid
     */
    detectStatusValue(record) {
        if (!record || typeof record !== 'object') {
            return null;
        }

        // Handle the primary 'Status' field (uppercase) and 'status' field (lowercase)
        // Accept boolean, number (0/1), or string representations
        const statusValue = record.Status !== undefined ? record.Status : record.status;

        if (statusValue !== undefined && statusValue !== null) {
            if (typeof statusValue === 'boolean') {
                return statusValue;
            }
            if (typeof statusValue === 'number') {
                return statusValue !== 0;
            }
            if (typeof statusValue === 'string') {
                const lowerValue = statusValue.toLowerCase().trim();
                if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
                    return true;
                }
                if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
                    return false;
                }
            }
        }

        // Fallback: Check for other common status-like fields
        const statusFields = ['isValid', 'valid', 'success', 'passed'];
        for (const field of statusFields) {
            if (record.hasOwnProperty(field)) {
                const value = record[field];
                if (typeof value === 'boolean') {
                    return value;
                }
                if (typeof value === 'number') {
                    return value !== 0;
                }
                if (typeof value === 'string') {
                    const lowerValue = value.toLowerCase().trim();
                    if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
                        return true;
                    }
                    if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
                        return false;
                    }
                }
            }
        }

        // If no status field found, validate using Singapore phone number validator
        const phoneNumber = record.Phone || record.phone || null;
        if (phoneNumber) {
            try {
                const isValidSingaporePhone = singaporePhoneValidator.validateSingaporePhone(phoneNumber);
                return isValidSingaporePhone;
            } catch (error) {
                console.warn(`Phone validation failed for ${phoneNumber}:`, error.message);
                return null;
            }
        }

        // No valid status field or phone number found
        return null;
    }

    /**
     * Apply formatting to worksheet with comprehensive validation and error handling
     * @param {Object} worksheet - XLSX worksheet object
     * @param {Array} data - Worksheet data array
     * @param {Array} records - Original records array for status checking
     * @param {Object} options - Styling options
     */
    applyWorksheetFormatting(worksheet, data, records = [], options = {}) {
        const {
            safeApplyStyle,
            batchApplyStyles,
            logStylingFailure,
            validateXLSXStyleObject,
            identifyDuplicatePhoneNumbers
        } = require('../utils/excelStylingConfig');

        try {
            // Check if styling is enabled (default: true)
            const enableStyling = options.enableStyling !== false;
            const stylingOptions = options.stylingOptions || {};

            // Auto-fit column widths based on content
            const columnWidths = this.calculateColumnWidths(worksheet, data);
            worksheet['!cols'] = columnWidths;

            // Auto-fit row heights based on content
            const rowHeights = this.calculateRowHeights(worksheet, data);
            worksheet['!rows'] = rowHeights;

            // Identify duplicate phone numbers before styling with comprehensive error handling
            let duplicatePhoneInfo = null;
            let duplicateDetectionFailed = false;

            try {
                duplicatePhoneInfo = identifyDuplicatePhoneNumbers(records);

                if (duplicatePhoneInfo && duplicatePhoneInfo.duplicateCount > 0) {

                    // Log duplicate detection success for audit trail
                    logStylingFailure('duplicatePhoneDetectionSuccess',
                        `Successfully identified ${duplicatePhoneInfo.duplicateCount} duplicate phone records`,
                        {
                            recordCount: records.length,
                            duplicatePhoneNumbers: duplicatePhoneInfo.duplicatePhoneNumbers.size,
                            duplicateRecords: duplicatePhoneInfo.duplicateCount,
                            severity: 'info'
                        }
                    );
                } else {
                }
            } catch (duplicateError) {
                duplicateDetectionFailed = true;

                logStylingFailure('duplicatePhoneDetectionError', duplicateError, {
                    recordCount: records.length,
                    errorType: duplicateError.name || 'UnknownError',
                    severity: 'warning'
                });

                console.warn('Duplicate phone detection failed, attempting graceful degradation:', duplicateError.message);

                // Try graceful degradation with fallback duplicate detection
                try {
                    duplicatePhoneInfo = this.fallbackDuplicateDetection(records);

                    if (duplicatePhoneInfo.duplicateCount > 0) {

                        logStylingFailure('duplicatePhoneDetectionFallbackSuccess',
                            `Fallback duplicate detection found ${duplicatePhoneInfo.duplicateCount} duplicates`,
                            {
                                recordCount: records.length,
                                fallbackMethod: duplicatePhoneInfo.fallbackMethod,
                                severity: 'info'
                            }
                        );
                    }
                } catch (fallbackError) {
                    console.error('Fallback duplicate detection also failed:', fallbackError.message);

                    logStylingFailure('duplicatePhoneDetectionFallbackError', fallbackError, {
                        recordCount: records.length,
                        originalError: duplicateError.message,
                        severity: 'error'
                    });

                    // Final graceful degradation - continue without duplicate detection
                    duplicatePhoneInfo = {
                        duplicatePhoneNumbers: new Set(),
                        duplicateRecordIndices: [],
                        phoneNumberMap: new Map(),
                        totalRecords: records.length,
                        duplicateCount: 0,
                        uniquePhoneCount: 0,
                        detectionFailed: true,
                        gracefulDegradation: true,
                        errorHandling: {
                            originalError: duplicateError.message,
                            fallbackError: fallbackError.message,
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }

            // Only apply styling if enabled
            if (enableStyling) {
                try {
                    const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
                    const styleApplications = [];

                    // Prepare base styling for all cells
                    for (let row = headerRange.s.r; row <= headerRange.e.r; row++) {
                        for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                            if (worksheet[cellAddress]) {
                                const baseStyle = createBaseStyle(stylingOptions);

                                // Validate style before adding to batch
                                const validation = validateXLSXStyleObject(baseStyle, { allowPartialApplication: true });
                                if (validation.valid || validation.correctedStyle) {
                                    styleApplications.push({
                                        cellAddress,
                                        style: validation.correctedStyle || baseStyle
                                    });
                                } else {
                                    logStylingFailure('baseStyleValidation',
                                        `Base style validation failed for cell ${cellAddress}`,
                                        { errors: validation.errors, cellAddress }
                                    );
                                }
                            }
                        }
                    }

                    // Apply base styles in batch
                    const baseStyleResult = batchApplyStyles(worksheet, styleApplications, {
                        allowPartialApplication: true,
                        useFallbackStyle: true
                    });

                    if (baseStyleResult.failed > 0) {
                        logStylingFailure('batchBaseStyles',
                            `Failed to apply base styles to ${baseStyleResult.failed} cells`,
                            {
                                successful: baseStyleResult.successful,
                                failed: baseStyleResult.failed,
                                severity: 'warning'
                            }
                        );
                    }

                    // Apply header styling with validation
                    const headerApplications = [];
                    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                        if (worksheet[cellAddress]) {
                            try {
                                const headerStyle = createHeaderStyle({
                                    preserveExistingFill: true,
                                    ...stylingOptions
                                });

                                const headerValidation = validateXLSXStyleObject(headerStyle, { allowPartialApplication: true });
                                if (headerValidation.valid || headerValidation.correctedStyle) {
                                    headerApplications.push({
                                        cellAddress,
                                        style: headerValidation.correctedStyle || headerStyle
                                    });
                                } else {
                                    logStylingFailure('headerStyleValidation',
                                        `Header style validation failed for cell ${cellAddress}`,
                                        { errors: headerValidation.errors, cellAddress }
                                    );
                                }
                            } catch (headerError) {
                                logStylingFailure('headerStyleCreation', headerError, { cellAddress });
                            }
                        }
                    }

                    // Apply header styles in batch
                    if (headerApplications.length > 0) {
                        const headerStyleResult = batchApplyStyles(worksheet, headerApplications, {
                            allowPartialApplication: true,
                            useFallbackStyle: true
                        });

                        if (headerStyleResult.failed > 0) {
                            logStylingFailure('batchHeaderStyles',
                                `Failed to apply header styles to ${headerStyleResult.failed} cells`,
                                {
                                    successful: headerStyleResult.successful,
                                    failed: headerStyleResult.failed,
                                    severity: 'warning'
                                }
                            );
                        }
                    }

                    // Apply status-based conditional formatting with validation
                    const statusApplications = [];
                    const duplicateApplications = [];

                    for (let row = 1; row <= headerRange.e.r; row++) {
                        const recordIndex = row - 1; // Adjust for header row
                        const record = records[recordIndex];

                        if (record) {
                            try {
                                // Check if this record has a duplicate phone number
                                // First check if record already has isDuplicate flag from server (preferred)
                                // Otherwise fall back to duplicate detection from current export batch
                                const isDuplicatePhone = record.isDuplicate !== undefined
                                    ? record.isDuplicate
                                    : (duplicatePhoneInfo && duplicatePhoneInfo.duplicateRecordIndices.includes(recordIndex));

                                // Detect and apply status-based formatting
                                const statusValue = this.detectStatusValue(record);

                                // Apply styling to entire row
                                for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                                    if (worksheet[cellAddress]) {
                                        try {
                                            // Duplicate styling takes precedence over status styling
                                            if (isDuplicatePhone) {
                                                const { createDuplicateStyle } = require('../utils/excelStylingConfig');
                                                const duplicateStyle = createDuplicateStyle(stylingOptions);

                                                const duplicateValidation = validateXLSXStyleObject(duplicateStyle, {
                                                    allowPartialApplication: true,
                                                    isDuplicateStyle: true
                                                });

                                                if (duplicateValidation.valid || duplicateValidation.correctedStyle) {
                                                    duplicateApplications.push({
                                                        cellAddress,
                                                        style: duplicateValidation.correctedStyle || duplicateStyle
                                                    });
                                                } else {
                                                    logStylingFailure('duplicateStyleValidation',
                                                        `Duplicate style validation failed for cell ${cellAddress}`,
                                                        {
                                                            errors: duplicateValidation.errors,
                                                            cellAddress,
                                                            recordIndex,
                                                            isDuplicatePhone: true
                                                        }
                                                    );
                                                }
                                            } else if (statusValue !== null) {
                                                // Apply status-based formatting only if not a duplicate phone
                                                const statusStyle = createStatusStyle(statusValue, stylingOptions);

                                                const statusValidation = validateXLSXStyleObject(statusStyle, { allowPartialApplication: true });
                                                if (statusValidation.valid || statusValidation.correctedStyle) {
                                                    statusApplications.push({
                                                        cellAddress,
                                                        style: statusValidation.correctedStyle || statusStyle
                                                    });
                                                } else {
                                                    logStylingFailure('statusStyleValidation',
                                                        `Status style validation failed for cell ${cellAddress}`,
                                                        {
                                                            errors: statusValidation.errors,
                                                            cellAddress,
                                                            statusValue,
                                                            recordIndex
                                                        }
                                                    );
                                                }
                                            }
                                        } catch (styleError) {
                                            logStylingFailure('rowStyleCreation', styleError, {
                                                cellAddress,
                                                statusValue,
                                                recordIndex,
                                                isDuplicatePhone
                                            });
                                        }
                                    }
                                }
                            } catch (detectionError) {
                                logStylingFailure('rowDetection', detectionError, {
                                    recordIndex,
                                    record: record ? 'present' : 'missing'
                                });
                            }
                        }
                    }

                    // Apply duplicate styles first (highest priority) with comprehensive error handling
                    let duplicateStylingResult = { successful: 0, failed: 0 };

                    if (duplicateApplications.length > 0) {
                        try {
                            duplicateStylingResult = batchApplyStyles(worksheet, duplicateApplications, {
                                allowPartialApplication: true,
                                useFallbackStyle: true // Use fallback if duplicate styling fails
                            });

                            if (duplicateStylingResult.successful > 0) {

                            }

                            if (duplicateStylingResult.failed > 0) {
                                logStylingFailure('batchDuplicateStylesPartialFailure',
                                    `Failed to apply duplicate styles to ${duplicateStylingResult.failed} cells, but Excel export will continue`,
                                    {
                                        successful: duplicateStylingResult.successful,
                                        failed: duplicateStylingResult.failed,
                                        totalAttempted: duplicateApplications.length,
                                        severity: 'warning'
                                    }
                                );

                                console.warn(`Duplicate styling partially failed: ${duplicateStylingResult.failed}/${duplicateApplications.length} cells failed, but export continues`);
                            }
                        } catch (duplicateStylingError) {
                            logStylingFailure('batchDuplicateStylesError', duplicateStylingError, {
                                attemptedCells: duplicateApplications.length,
                                severity: 'error'
                            });

                            console.error('Duplicate styling completely failed, continuing export without duplicate highlighting:', duplicateStylingError.message);

                            // Reset result to indicate complete failure
                            duplicateStylingResult = { successful: 0, failed: duplicateApplications.length };
                        }
                    } else if (duplicatePhoneInfo && duplicatePhoneInfo.duplicateCount > 0 && !duplicateDetectionFailed) {
                        // Log when duplicate records exist but no styling was applied
                        logStylingFailure('duplicateStylingSkipped',
                            'Duplicate phone records detected but no styling applications were created',
                            {
                                duplicateRecords: duplicatePhoneInfo.duplicateCount,
                                duplicatePhoneNumbers: duplicatePhoneInfo.duplicatePhoneNumbers.size,
                                severity: 'warning'
                            }
                        );
                    }

                    // Apply status styles in batch (lower priority than duplicate styles)
                    if (statusApplications.length > 0) {
                        const statusStyleResult = batchApplyStyles(worksheet, statusApplications, {
                            allowPartialApplication: true,
                            useFallbackStyle: false // Don't override status styles with fallback
                        });

                        if (statusStyleResult.failed > 0) {
                            logStylingFailure('batchStatusStyles',
                                `Failed to apply status styles to ${statusStyleResult.failed} cells`,
                                {
                                    successful: statusStyleResult.successful,
                                    failed: statusStyleResult.failed,
                                    severity: 'warning'
                                }
                            );
                        }
                    }


                    // Enhanced styling applied (logging removed)

                    stylingOptions,
                        baseStyles: baseStyleResult.successful,
                            headerStyles: headerApplications.length,
                                duplicateStyles: {
                        attempted: duplicateApplications.length,
                            successful: duplicateStylingResult.successful,
                                failed: duplicateStylingResult.failed
                    },
                    statusStyles: statusApplications.length,
                        duplicatePhoneInfo: duplicatePhoneInfo ? {
                            duplicatePhoneNumbers: duplicatePhoneInfo.duplicatePhoneNumbers.size,
                            duplicateRecords: duplicatePhoneInfo.duplicateCount,
                            detectionFailed: duplicatePhoneInfo.detectionFailed || false
                        } : null,
                            errorHandling: {
                        duplicateDetectionFailed,
                            duplicateStylingFailed: duplicateStylingResult.failed > 0,
                                exportContinued: true
                    },
                    totalFailures: baseStyleResult.failed + duplicateStylingResult.failed + (headerApplications.length > 0 ? 0 : 0) + (statusApplications.length > 0 ? 0 : 0)
                });

            } catch (stylingError) {
                logStylingFailure('worksheetStylingError', stylingError, {
                    enableStyling,
                    stylingOptions,
                    duplicateDetectionFailed,
                    severity: 'error'
                });
                console.warn('Styling failed but export will continue without formatting:', stylingError.message);
            }
        } else {
        }

    } catch(error) {
        logStylingFailure('applyWorksheetFormattingError', error, {
            enableStyling: options.enableStyling,
            recordCount: records.length,
            severity: 'error'
        });
        console.warn('Failed to apply worksheet formatting, continuing without styling:', error.message);

        // Ensure Excel export continues even if all formatting fails
        // This is critical for maintaining export functionality
        try {
            // At minimum, ensure column widths and row heights are set with auto-fit
            const columnWidths = this.calculateColumnWidths(worksheet, data);
            worksheet['!cols'] = columnWidths;

            const rowHeights = this.calculateRowHeights(worksheet, data);
            worksheet['!rows'] = rowHeights;


        } catch (fallbackError) {
            logStylingFailure('fallbackFormattingError', fallbackError, {
                severity: 'error'
            });
            console.error('Even fallback formatting failed, export will continue with no formatting:', fallbackError.message);
        }
    }
}

/**
 * Calculate optimal column widths based on content
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} data - Worksheet data array
 * @returns {Array} Array of column width objects
 */
calculateColumnWidths(worksheet, data) {
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
    if (!range) {
        // Return default widths if no range
        return [
            { wch: 20 }, { wch: 15 }, { wch: 25 },
            { wch: 35 }, { wch: 25 }, { wch: 25 }
        ];
    }

    const columnWidths = [];
    const minWidth = 10;
    const maxWidth = 100;
    const paddingChars = 2;

    for (let col = range.s.c; col <= range.e.c; col++) {
        let maxLength = 0;

        // Check all rows for this column
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];

            if (cell && cell.v != null) {
                const cellValue = String(cell.v);
                const cellLength = cellValue.length;

                // Account for multi-line content
                const lines = cellValue.split('\n');
                const longestLine = Math.max(...lines.map(line => line.length));

                maxLength = Math.max(maxLength, longestLine);
            }
        }

        // Add padding and constrain to min/max
        const width = Math.min(Math.max(maxLength + paddingChars, minWidth), maxWidth);
        columnWidths.push({ wch: width });
    }

    return columnWidths;
}

/**
 * Calculate optimal row heights based on content
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} data - Worksheet data array
 * @returns {Array} Array of row height objects
 */
calculateRowHeights(worksheet, data) {
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
    if (!range) {
        return [];
    }

    const rowHeights = [];
    const baseRowHeight = 15; // Base height in points
    const lineHeight = 15; // Height per line in points
    const maxRowHeight = 200; // Maximum row height

    for (let row = range.s.r; row <= range.e.r; row++) {
        let maxLines = 1;

        // Check all columns for this row
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];

            if (cell && cell.v != null) {
                const cellValue = String(cell.v);
                const lines = cellValue.split('\n').length;
                maxLines = Math.max(maxLines, lines);
            }
        }

        // Calculate height based on number of lines
        const height = Math.min(baseRowHeight + ((maxLines - 1) * lineHeight), maxRowHeight);
        rowHeights.push({ hpt: height });
    }

    return rowHeights;
}

/**
 * Fallback duplicate detection for Excel export when main detection fails
 * @param {Array} records - Array of records to check for duplicates
 * @returns {Object} Fallback duplicate detection result
 */
fallbackDuplicateDetection(records) {


    const fallbackResult = {
        duplicatePhoneNumbers: new Set(),
        duplicateRecordIndices: [],
        phoneNumberMap: new Map(),
        totalRecords: records.length,
        duplicateCount: 0,
        uniquePhoneCount: 0,
        detectionFailed: false,
        fallbackMethod: 'basic_phone_comparison',
        errorHandling: {
            fallbackUsed: true,
            timestamp: new Date().toISOString()
        }
    };

    try {
        const phoneGroups = {};
        const duplicateIndices = [];

        // Simple phone number grouping without complex normalization
        for (let i = 0; i < records.length; i++) {
            try {
                const record = records[i];
                const phone = record.Phone || record.phone || record.phoneNumber || '';

                if (phone) {
                    // Basic phone normalization - remove spaces and common separators
                    const normalizedPhone = phone.toString()
                        .replace(/[\s\-\(\)\+]/g, '')
                        .toLowerCase()
                        .trim();

                    if (normalizedPhone) {
                        if (!phoneGroups[normalizedPhone]) {
                            phoneGroups[normalizedPhone] = [];
                        }
                        phoneGroups[normalizedPhone].push(i);
                    }
                }
            } catch (recordError) {
                console.warn(`Error processing record ${i} in fallback detection:`, recordError);
                // Continue with other records
            }
        }

        // Identify duplicates from phone groups
        for (const [phone, indices] of Object.entries(phoneGroups)) {
            if (indices.length > 1) {
                fallbackResult.duplicatePhoneNumbers.add(phone);
                duplicateIndices.push(...indices);
                fallbackResult.phoneNumberMap.set(phone, indices);
            }
        }

        fallbackResult.duplicateRecordIndices = duplicateIndices;
        fallbackResult.duplicateCount = duplicateIndices.length;
        fallbackResult.uniquePhoneCount = Object.keys(phoneGroups).length;



        return fallbackResult;

    } catch (fallbackError) {
        console.error('Fallback duplicate detection failed:', fallbackError);

        // Return empty result as final fallback
        fallbackResult.detectionFailed = true;
        fallbackResult.errorHandling.fallbackError = fallbackError.message;
        fallbackResult.errorHandling.gracefulDegradation = true;

        return fallbackResult;
    }
}

/**
 * Format date for Excel display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
formatDate(date) {
    if (!date) return '';

    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';

        return dateObj.toLocaleString('en-SG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.warn('Failed to format date:', error.message);
        return String(date);
    }
}




/**
 * Generate Excel file buffer from records
 * @param {Array} records - Phone records array
 * @param {Object} options - Export options
 * @returns {Buffer} Excel file buffer
 */
generateExcelBuffer(records, options = {}) {
    try {
        const workbook = this.generateExcel(records, options);

        // Generate buffer with styling enabled
        const writeOptions = {
            type: 'buffer',
            bookType: 'xlsx',
            compression: true,
            cellStyles: options.enableStyling !== false // Enable cell styling (default: true)
        };

        const buffer = XLSX.write(workbook, writeOptions);


        return buffer;

    } catch (error) {
        console.error('Failed to generate Excel buffer:', error.message);
        throw error;
    }
}

    /**
     * Export records by range to Excel buffer with comprehensive validation
     * @param {number} startRecord - Start record number (1-based)
     * @param {number} endRecord - End record number (1-based)
     * @param {Object} options - Export options
     * @returns {Object} Export result with buffer and metadata
     */
    async exportRecordsByRange(startRecord, endRecord, options = {}) {
    const startTime = Date.now();

    try {


        // Validate export request
        const validation = await this.validateExportRequest(startRecord, endRecord);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                buffer: null,
                metadata: {
                    startRecord,
                    endRecord,
                    recordCount: 0,
                    validationFailed: true,
                    exportDate: new Date().toISOString()
                }
            };
        }

        // Use validated parameters
        const validatedStart = validation.startRecord;
        const validatedEnd = validation.endRecord;

        // Get records from check_table with error handling
        const result = await this.getCheckRecordsWithRetry(validatedStart, validatedEnd);

        if (!result.success) {
            return {
                success: false,
                error: `Database error: ${result.error}`,
                buffer: null,
                metadata: {
                    startRecord: validatedStart,
                    endRecord: validatedEnd,
                    recordCount: 0,
                    databaseError: true,
                    exportDate: new Date().toISOString()
                }
            };
        }

        if (result.records.length === 0) {
            return {
                success: true,
                buffer: null,
                metadata: {
                    startRecord: validatedStart,
                    endRecord: validatedEnd,
                    recordCount: 0,
                    totalAvailable: result.totalAvailable,
                    message: 'No records found in specified range',
                    exportDate: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime
                }
            };
        }

        // Generate Excel buffer with error handling and styling options
        const buffer = await this.generateExcelBufferWithValidation(result.records, {
            sheetName: options.sheetName || `Records ${validatedStart}-${result.endRecord}`,
            customHeaders: options.customHeaders,
            enableStyling: options.enableStyling !== false,
            stylingOptions: options.stylingOptions || {}
        });

        if (!buffer) {
            return {
                success: false,
                error: 'Failed to generate Excel file',
                buffer: null,
                metadata: {
                    startRecord: validatedStart,
                    endRecord: validatedEnd,
                    recordCount: result.totalReturned,
                    excelGenerationFailed: true,
                    exportDate: new Date().toISOString()
                }
            };
        }

        const metadata = {
            startRecord: result.startRecord,
            endRecord: result.endRecord,
            requestedEndRecord: endRecord,
            recordCount: result.totalReturned,
            totalAvailable: result.totalAvailable,
            fileSize: buffer.length,
            exportDate: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            warning: validation.warning || (result.endRecord < endRecord ?
                `End record adjusted from ${endRecord} to ${result.endRecord}` : null)
        };



        return {
            success: true,
            buffer,
            metadata
        };

    } catch (error) {
        console.error('Failed to export records by range:', error.message);

        return {
            success: false,
            error: `Export failed: ${error.message}`,
            buffer: null,
            metadata: {
                startRecord,
                endRecord,
                recordCount: 0,
                unexpectedError: true,
                exportDate: new Date().toISOString(),
                processingTimeMs: Date.now() - startTime
            }
        };
    }
}

    /**
     * Get check table records with retry logic for database failures
     * @param {number} startRecord - Start record number
     * @param {number} endRecord - End record number
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Object} Database result
     */
    async getCheckRecordsWithRetry(startRecord, endRecord, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {

            const result = await CheckTable.getRecordsByRange(startRecord, endRecord);

            if (result.success) {
                return result;
            }

            lastError = new Error(result.error);

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s

                await new Promise(resolve => setTimeout(resolve, delay));
            }

        } catch (error) {
            lastError = error;
            console.error(`Check table query attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    return {
        success: false,
        error: lastError ? lastError.message : 'Check table query failed after retries'
    };
}

    /**
     * Generate Excel buffer with validation and error handling
     * @param {Array} records - Phone records array
     * @param {Object} options - Export options
     * @returns {Buffer|null} Excel file buffer or null on failure
     */
    async generateExcelBufferWithValidation(records, options = {}) {
    try {
        // Validate records array
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Invalid records array provided');
        }

        // Validate record structure
        const sampleRecord = records[0];
        if (!this.validateRecordStructure(sampleRecord)) {
            throw new Error('Invalid record structure detected');
        }

        // Generate Excel with memory monitoring and styling options
        const memoryBefore = process.memoryUsage();
        const buffer = this.generateExcelBuffer(records, {
            ...options,
            enableStyling: options.enableStyling !== false, // Ensure styling is enabled by default
            stylingOptions: options.stylingOptions || {}
        });
        const memoryAfter = process.memoryUsage();

        const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed;


        // Validate generated buffer
        if (!buffer || buffer.length === 0) {
            throw new Error('Generated Excel buffer is empty');
        }

        // Check file size limits
        if (buffer.length > this.maxFileSizeBytes) {
            throw new Error(`Generated file too large: ${Math.round(buffer.length / 1024 / 1024)}MB`);
        }

        return buffer;

    } catch (error) {
        console.error('Excel buffer generation failed:', error.message);
        return null;
    }
}

/**
 * Validate record structure for check table
 * @param {Object} record - Check table record object
 * @returns {boolean} True if valid structure
 */
validateRecordStructure(record) {
    if (!record || typeof record !== 'object') {
        return false;
    }

    // More flexible validation - just check for Id and Phone (minimum required)
    // Status field is optional for exports from frontend
    const requiredFields = ['Id', 'Phone'];
    return requiredFields.every(field => record.hasOwnProperty(field));
}

    /**
     * Export all records to Excel buffer
     * @param {Object} options - Export options
     * @returns {Object} Export result with buffer and metadata
     */
    async exportAllRecords(options = {}) {
    try {


        // Get total record count first
        const totalRecords = await CheckTable.getTotalRecordCount();

        if (totalRecords === 0) {
            return {
                success: true,
                buffer: null,
                metadata: {
                    recordCount: 0,
                    message: 'No records available for export'
                }
            };
        }

        // Export all records (1 to totalRecords)
        return await this.exportRecordsByRange(1, totalRecords, options);

    } catch (error) {
        console.error('Failed to export all records:', error.message);

        return {
            success: false,
            error: error.message,
            buffer: null,
            metadata: {
                recordCount: 0,
                exportDate: new Date().toISOString()
            }
        };
    }
}

/**
 * Get suggested filename for Excel export
 * @param {Object} metadata - Export metadata
 * @returns {string} Suggested filename
 */
getSuggestedFilename(metadata) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');

    if (metadata.startRecord && metadata.endRecord) {
        return `singapore_phone_check_${metadata.startRecord}-${metadata.endRecord}_${timestamp}.xlsx`;
    }

    return `singapore_phone_check_${timestamp}.xlsx`;
}

    /**
     * Validate export parameters (legacy method for backward compatibility)
     * @param {number} startRecord - Start record number
     * @param {number} endRecord - End record number
     * @returns {Object} Validation result
     */
    async validateExportParameters(startRecord, endRecord) {
    return await this.validateExportRequest(startRecord, endRecord);
}

/**
 * Create user-friendly error messages for different failure scenarios
 * @param {string} errorType - Type of error
 * @param {Object} details - Error details
 * @returns {string} User-friendly error message
 */
createUserFriendlyErrorMessage(errorType, details = {}) {
    const errorMessages = {
        'validation_failed': 'Invalid export parameters. Please check your start and end record numbers.',
        'database_error': 'Unable to retrieve records from database. Please try again later.',
        'no_records': 'No records found in the specified range.',
        'file_too_large': 'The requested export is too large. Please try a smaller range.',
        'excel_generation_failed': 'Failed to generate Excel file. Please try again.',
        'network_error': 'Network connection issue. Please check your connection and try again.',
        'server_error': 'Server error occurred. Please contact support if the problem persists.',
        'timeout_error': 'Export request timed out. Please try a smaller range.',
        'memory_error': 'Not enough memory to process this export. Please try a smaller range.'
    };

    let baseMessage = errorMessages[errorType] || 'An unexpected error occurred during export.';

    // Add specific details if available
    if (details.recordCount) {
        baseMessage += ` (Requested: ${details.recordCount} records)`;
    }

    if (details.suggestion) {
        baseMessage += ` Suggestion: ${details.suggestion}`;
    }

    return baseMessage;
}

/**
 * Handle and categorize different types of export errors
 * @param {Error} error - The error object
 * @param {Object} context - Context information
 * @returns {Object} Categorized error response
 */
handleExportError(error, context = {}) {
    const errorMessage = error.message.toLowerCase();
    let errorType = 'server_error';
    let userMessage = '';
    let suggestion = '';

    // Categorize error types
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        errorType = 'validation_failed';
        suggestion = 'Please ensure start and end record numbers are valid positive integers.';
    } else if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        errorType = 'database_error';
        suggestion = 'Please try again in a few moments.';
    } else if (errorMessage.includes('timeout')) {
        errorType = 'timeout_error';
        suggestion = 'Try exporting a smaller range of records.';
    } else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
        errorType = 'memory_error';
        suggestion = 'Try exporting fewer records at a time.';
    } else if (errorMessage.includes('file size') || errorMessage.includes('too large')) {
        errorType = 'file_too_large';
        suggestion = 'Try exporting a smaller range of records.';
    } else if (errorMessage.includes('excel') || errorMessage.includes('generation')) {
        errorType = 'excel_generation_failed';
        suggestion = 'Please try again or contact support if the problem persists.';
    }

    userMessage = this.createUserFriendlyErrorMessage(errorType, {
        recordCount: context.recordCount,
        suggestion
    });

    return {
        errorType,
        userMessage,
        originalError: error.message,
        suggestion,
        context
    };
}

/**
 * Get export status and progress information
 * @param {Object} metadata - Export metadata
 * @returns {Object} Status information
 */
getExportStatus(metadata) {
    const status = {
        isComplete: false,
        hasWarnings: false,
        hasErrors: false,
        messages: []
    };

    if (metadata.success === false) {
        status.hasErrors = true;
        status.messages.push({
            type: 'error',
            message: metadata.error || 'Export failed'
        });
    } else {
        status.isComplete = true;
        status.messages.push({
            type: 'success',
            message: `Successfully exported ${metadata.recordCount} records`
        });
    }

    if (metadata.warning) {
        status.hasWarnings = true;
        status.messages.push({
            type: 'warning',
            message: metadata.warning
        });
    }

    if (metadata.processingTimeMs > 30000) { // > 30 seconds
        status.hasWarnings = true;
        status.messages.push({
            type: 'warning',
            message: 'Export took longer than expected. Consider using smaller ranges for better performance.'
        });
    }

    return status;
}

    /**
     * Export check table records to Excel buffer
     * @param {Array} records - Check table records array
     * @param {Object} options - Export options
     * @returns {Object} Export result with buffer and metadata
     */
    async exportCheckTableRecords(records, options = {}) {
    const startTime = Date.now();

    try {


        if (!Array.isArray(records) || records.length === 0) {
            return {
                success: true,
                buffer: null,
                metadata: {
                    recordCount: 0,
                    message: 'No records provided for export',
                    exportDate: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime
                }
            };
        }

        // Generate Excel buffer with styling options
        const buffer = await this.generateExcelBufferWithValidation(records, {
            sheetName: options.sheetName || 'Check Table Export',
            customHeaders: options.customHeaders,
            enableStyling: options.enableStyling !== false,
            stylingOptions: options.stylingOptions || {}
        });

        if (!buffer) {
            return {
                success: false,
                error: 'Failed to generate Excel file',
                buffer: null,
                metadata: {
                    recordCount: records.length,
                    excelGenerationFailed: true,
                    exportDate: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime
                }
            };
        }

        const metadata = {
            startRecord: options.startRecord || 1,
            endRecord: options.endRecord || records.length,
            recordCount: records.length,
            totalAvailable: options.totalAvailable || records.length,
            fileSize: buffer.length,
            exportDate: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            source: 'check_table'
        };



        return {
            success: true,
            buffer,
            metadata
        };

    } catch (error) {
        console.error('Failed to export check table records:', error.message);

        return {
            success: false,
            error: `Export failed: ${error.message}`,
            buffer: null,
            metadata: {
                recordCount: records ? records.length : 0,
                unexpectedError: true,
                exportDate: new Date().toISOString(),
                processingTimeMs: Date.now() - startTime,
                source: 'check_table'
            }
        };
    }
}

/**
 * Get export recommendations based on request parameters
 * @param {number} startRecord - Start record number
 * @param {number} endRecord - End record number
 * @param {number} totalRecords - Total available records
 * @returns {Object} Recommendations
 */
getExportRecommendations(startRecord, endRecord, totalRecords) {
    const requestedCount = endRecord - startRecord + 1;
    const recommendations = [];

    if (requestedCount > 10000) {
        recommendations.push({
            type: 'performance',
            message: 'Large export detected. Consider breaking into smaller chunks for better performance.',
            suggestion: `Try exporting in batches of 5,000-10,000 records.`
        });
    }

    if (endRecord > totalRecords) {
        recommendations.push({
            type: 'range',
            message: `End record ${endRecord} exceeds available records (${totalRecords}).`,
            suggestion: `Export will be limited to record ${totalRecords}.`
        });
    }

    if (startRecord > totalRecords * 0.9) {
        recommendations.push({
            type: 'efficiency',
            message: 'Exporting from near the end of the dataset.',
            suggestion: 'Consider if you need all these records or if a more recent subset would suffice.'
        });
    }

    return recommendations;
}
}

module.exports = ExcelExporter;
