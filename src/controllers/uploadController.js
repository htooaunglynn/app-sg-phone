const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ExcelProcessor = require('../services/excelProcessor');
const FileManager = require('../services/fileManager');
const PhoneRecord = require('../models/PhoneRecord');
const databaseManager = require('../utils/database');
const phoneValidationProcessor = require('../services/phoneValidationProcessor');

class UploadController {
    constructor() {
        this.excelProcessor = new ExcelProcessor();
        this.fileManager = new FileManager();
        this.setupMulter();
    }

    /**
     * Configure multer for file uploads
     */
    setupMulter() {
        // Configure storage
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadDir = process.env.UPLOAD_DIR || './uploads';
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                // Generate unique filename with timestamp
                const timestamp = Date.now();
                const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filename = `${timestamp}_${originalName}`;
                cb(null, filename);
            }
        });

        // File filter to accept Excel files only
        const fileFilter = (req, file, cb) => {
            const allowedMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel' // .xls
            ];

            if (allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only Excel files are allowed'), false);
            }
        };

        // Configure multer with limits
        this.upload = multer({
            storage: storage,
            fileFilter: fileFilter,
            limits: {
                fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
                files: 1 // Only one file at a time
            }
        });
    }

    /**
     * Get multer middleware for single file upload
     */
    getUploadMiddleware() {
        return this.upload.single('file');
    }

    /**
     * Handle file upload and processing with file-first approach for enhanced file management
     */
    async handleUpload(req, res) {
        const startTime = Date.now();
        let uploadedFilePath = null;
        let savedFileInfo = null;

        try {
            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded. Please select an Excel file.',
                    code: 'NO_FILE'
                });
            }

            uploadedFilePath = req.file.path;
            const originalFilename = req.file.originalname;

            console.log(`Processing uploaded file: ${originalFilename} (${req.file.size} bytes)`);

            // Detect file type and validate
            const fileType = this.detectFileType(originalFilename, req.file.mimetype);
            if (!fileType) {
                await this.cleanupFile(uploadedFilePath);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid file type. Only Excel files are accepted.',
                    code: 'INVALID_FILE_TYPE'
                });
            }

            // Read file buffer
            const fileBuffer = await fs.readFile(uploadedFilePath);

            // STEP 1: Save original file first (file-first approach) with enhanced security
            try {
                const clientId = req.ip || req.connection.remoteAddress;
                const saveOptions = {
                    strictSecurity: process.env.STRICT_SECURITY === 'true',
                    enableStreaming: process.env.ENABLE_FILE_STREAMING !== 'false'
                };

                let saveResult;
                if (fileType === 'excel') {
                    saveResult = await this.fileManager.saveOriginalExcel(
                        fileBuffer,
                        originalFilename,
                        clientId,
                        saveOptions
                    );
                }

                savedFileInfo = saveResult.fileInfo;

                // Record file metadata in database with enhanced information
                await databaseManager.insertFileMetadataWithType(
                    savedFileInfo.originalName,
                    savedFileInfo.storedFilename,
                    savedFileInfo.fileSize,
                    fileType,
                    savedFileInfo.checksum
                );

                console.log(`Enhanced ${fileType.toUpperCase()} saved: ${savedFileInfo.storedFilename} (streaming: ${savedFileInfo.streamingUsed})`);

                // Log security flags if any
                if (savedFileInfo.securityFlags && savedFileInfo.securityFlags.length > 0) {
                    console.warn(`Security flags for ${savedFileInfo.storedFilename}:`, savedFileInfo.securityFlags);
                }
            } catch (saveError) {
                await this.cleanupFile(uploadedFilePath);
                return res.status(500).json({
                    success: false,
                    error: `Failed to save original Excel file with enhanced security: ` + saveError.message,
                    code: 'ENHANCED_FILE_SAVE_ERROR',
                    details: {
                        fileType: fileType,
                        securityEnhanced: true,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // STEP 2: Process file and extract data based on file type
            let phoneRecords = [];
            let extractionReport = null;

            try {
                if (fileType === 'excel') {
                    phoneRecords = await this.excelProcessor.extractData(fileBuffer);
                    extractionReport = this.excelProcessor.generateExtractionReport(phoneRecords);

                    console.log(`Excel processing completed: ${phoneRecords.length} records extracted`);
                }
            } catch (processingError) {
                // Log detailed error information for Excel files
                if (fileType === 'excel') {
                    this.logExcelProcessingError(processingError, {
                        filename: originalFilename,
                        storedFilename: savedFileInfo?.storedFilename,
                        fileSize: req.file.size,
                        step: 'data_extraction',
                        clientId: req.ip || req.connection.remoteAddress
                    });
                }

                // Update file status to failed
                await databaseManager.updateFileProcessingStatus(savedFileInfo.storedFilename, 'failed', 0);

                await this.cleanupFile(uploadedFilePath);
                return res.status(400).json({
                    success: false,
                    error: `Excel processing failed: ` + processingError.message,
                    code: 'EXCEL_PROCESSING_ERROR',
                    details: {
                        fileType: fileType,
                        suggestions: this.generateProcessingSuggestions(processingError.message, fileType),
                        originalFile: savedFileInfo.storedFilename
                    }
                });
            }

            if (!phoneRecords || phoneRecords.length === 0) {
                // Update file status to failed
                await databaseManager.updateFileProcessingStatus(savedFileInfo.storedFilename, 'failed', 0);

                await this.cleanupFile(uploadedFilePath);
                return res.status(400).json({
                    success: false,
                    error: 'No valid phone records found in the Excel file.',
                    code: 'NO_VALID_RECORDS',
                    details: {
                        extractionReport: extractionReport,
                        suggestions: [
                            'Ensure the Excel file contains columns with phone numbers',
                            'Check that phone numbers are in a recognizable format (8-digit Singapore numbers)',
                            'Verify the Excel file is not password protected or corrupted',
                            'Ensure worksheets contain data and are not empty'
                        ],
                        originalFile: savedFileInfo.storedFilename
                    }
                });
            }

            // STEP 3: Store records in backup_table with metadata
            let backupResults;
            if (fileType === 'excel') {
                backupResults = await this.excelProcessor.storeToBackupTable(
                    phoneRecords,
                    savedFileInfo.storedFilename
                );
            } else {
                backupResults = await this.storeToBackupTableWithMetadata(
                    phoneRecords,
                    savedFileInfo.storedFilename,
                    extractionReport
                );
            }

            if (!backupResults.success) {
                // Update file status to failed
                await databaseManager.updateFileProcessingStatus(savedFileInfo.storedFilename, 'failed', 0);

                await this.cleanupFile(uploadedFilePath);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to store records in backup table.',
                    code: 'BACKUP_STORAGE_ERROR',
                    details: {
                        error: backupResults.error,
                        originalFile: savedFileInfo.storedFilename,
                        duplicateHandling: {
                            enabled: true,
                            duplicatesFound: backupResults.duplicatesSkipped || 0,
                            duplicateHandlingStatus: 'storage_failed'
                        }
                    }
                });
            }

            // STEP 4: Update file processing status to processed with duplicate handling information
            const duplicateHandlingMetadata = {
                duplicatesSkipped: backupResults.duplicatesSkipped || 0,
                duplicatePercentage: phoneRecords.length > 0 ?
                    Math.round(((backupResults.duplicatesSkipped || 0) / phoneRecords.length) * 10000) / 100 : 0,
                duplicateHandlingEnabled: true,
                duplicateHandlingStatus: (backupResults.duplicatesSkipped || 0) > 0 ? 'duplicates_skipped' : 'no_duplicates_found'
            };

            await databaseManager.updateFileProcessingStatus(
                savedFileInfo.storedFilename,
                'processed',
                backupResults.inserted || backupResults.storedRecords || 0,
                duplicateHandlingMetadata
            );

            // STEP 5: Trigger Singapore phone validation process
            let validationResults = null;
            try {
                validationResults = await phoneValidationProcessor.processBackupRecords();
            } catch (validationError) {
                console.warn('Phone validation process failed:', validationError.message);
                // Continue with response even if validation fails - data is safely stored in backup_table
            }

            // STEP 6: Clean up temporary uploaded file
            await this.cleanupFile(uploadedFilePath);

            // Calculate processing time
            const processingTime = Date.now() - startTime;

            // Get updated statistics for both tables
            const tableStats = await databaseManager.getTableStats();
            const fileStats = await databaseManager.getFileStats();

            // Success response with enhanced file management information and duplicate handling details
            const duplicatesSkipped = backupResults.duplicatesSkipped || backupResults.skipped || backupResults.skippedRecords || 0;
            const duplicatePercentage = phoneRecords.length > 0 ?
                Math.round((duplicatesSkipped / phoneRecords.length) * 10000) / 100 : 0;

            // Create duplicate handling status message
            let duplicateStatusMessage = '';
            if (duplicatesSkipped > 0) {
                duplicateStatusMessage = ` (${duplicatesSkipped} duplicates skipped - ${duplicatePercentage}%)`;
            }

            res.status(200).json({
                success: true,
                message: `${fileType.toUpperCase()} processed successfully${duplicateStatusMessage}`,
                data: {
                    file: {
                        originalName: savedFileInfo.originalName,
                        storedFilename: savedFileInfo.storedFilename,
                        fileType: fileType,
                        fileSize: savedFileInfo.fileSize,
                        uploadTimestamp: savedFileInfo.uploadTimestamp,
                        checksum: savedFileInfo.checksum
                    },
                    extraction: {
                        recordsExtracted: phoneRecords.length,
                        extractionReport: extractionReport,
                        processingTimeMs: processingTime
                    },
                    backupTable: {
                        recordsInserted: backupResults.inserted || backupResults.storedRecords || 0,
                        recordsSkipped: backupResults.skipped || backupResults.skippedRecords || 0,
                        totalRecords: tableStats.backupTable
                    },
                    duplicateHandling: {
                        enabled: true,
                        duplicatesFound: duplicatesSkipped,
                        duplicatePercentage: duplicatePercentage,
                        newRecordsStored: backupResults.inserted || backupResults.storedRecords || 0,
                        duplicateReport: backupResults.duplicateReport || null,
                        duplicateIds: backupResults.duplicateIds || [],
                        duplicateHandlingStatus: duplicatesSkipped > 0 ? 'duplicates_skipped' : 'no_duplicates_found'
                    },
                    checkTable: {
                        recordsValidated: validationResults ? validationResults.successful : 0,
                        singaporePhones: validationResults ? validationResults.validSingaporeNumbers : 0,
                        nonSingaporePhones: validationResults ? validationResults.invalidNumbers : 0,
                        totalRecords: tableStats.checkTable
                    },
                    fileManagement: {
                        totalFilesUploaded: fileStats.totalFiles,
                        totalProcessedFiles: fileStats.processedFiles,
                        totalStorageUsed: fileStats.totalSize,
                        phoneValidationStatus: validationResults ? 'completed' : 'failed'
                    }
                }
            });

            const totalDuplicatesSkipped = backupResults.duplicatesSkipped || 0;
            const duplicateInfo = totalDuplicatesSkipped > 0 ? `, ${totalDuplicatesSkipped} duplicates skipped` : '';
            console.log(`Enhanced upload completed: ${phoneRecords.length} records processed in ${processingTime}ms, ${backupResults.inserted || backupResults.storedRecords || 0} new records stored${duplicateInfo}, file saved as ${savedFileInfo.storedFilename}`);

        } catch (error) {
            console.error('Upload processing error:', error);

            // Update file status to failed if we have saved file info
            if (savedFileInfo) {
                try {
                    await databaseManager.updateFileProcessingStatus(savedFileInfo.storedFilename, 'failed', 0);
                } catch (updateError) {
                    console.error('Failed to update file status:', updateError.message);
                }
            }

            // Clean up temporary uploaded file on error
            if (uploadedFilePath) {
                await this.cleanupFile(uploadedFilePath);
            }

            // Handle specific error types with enhanced error messages
            if (error.message.includes('File too large')) {
                return res.status(413).json({
                    success: false,
                    error: 'File size exceeds the maximum limit of 10MB.',
                    code: 'FILE_TOO_LARGE',
                    details: {
                        suggestions: ['Try compressing the PDF file', 'Split large PDFs into smaller files']
                    }
                });
            }

            if (error.message.includes('Only PDF and Excel files are allowed')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid file type. Only Excel files are accepted.',
                    code: 'INVALID_FILE_TYPE',
                    details: {
                        suggestions: [
                            'Convert your file to Excel format',
                            'Ensure the file has a .xlsx or .xls extension',
                            'Check that the file is not corrupted'
                        ]
                    }
                });
            }

            // Enhanced Excel processing error handling
            const excelErrorMessages = [
                'The uploaded file is not a valid Excel file',
                'The Excel file appears to be empty',
                'No worksheets found in the Excel file',
                'The Excel format is not recognized',
                'Some data in the Excel file appears to be corrupted',
                'Excel file is password protected',
                'No valid phone records were found in the Excel file',
                'Error processing worksheet data'
            ];

            const isExcelError = excelErrorMessages.some(msg => error.message.includes(msg));

            if (isExcelError) {
                return res.status(400).json({
                    success: false,
                    error: error.message,
                    code: 'EXCEL_PROCESSING_ERROR',
                    details: {
                        suggestions: this.generateProcessingSuggestions(error.message, 'excel'),
                        originalFile: savedFileInfo ? savedFileInfo.storedFilename : null,
                        fileType: 'excel'
                    }
                });
            }

            // Generic server error with enhanced details
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred while processing the file. Please try again.',
                code: 'SERVER_ERROR',
                details: {
                    originalFile: savedFileInfo ? savedFileInfo.storedFilename : null,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    /**
     * Clean up uploaded file
     */
    async cleanupFile(filePath) {
        try {
            if (filePath) {
                await fs.unlink(filePath);
                console.log(`Cleaned up file: ${filePath}`);
            }
        } catch (error) {
            console.warn(`Failed to cleanup file ${filePath}:`, error.message);
        }
    }

    /**
     * Handle multer errors
     */
    handleMulterError(error, req, res, next) {
        if (error instanceof multer.MulterError) {
            switch (error.code) {
                case 'LIMIT_FILE_SIZE':
                    return res.status(413).json({
                        success: false,
                        error: 'File size exceeds the maximum limit of 10MB.',
                        code: 'FILE_TOO_LARGE'
                    });
                case 'LIMIT_FILE_COUNT':
                    return res.status(400).json({
                        success: false,
                        error: 'Only one file can be uploaded at a time.',
                        code: 'TOO_MANY_FILES'
                    });
                case 'LIMIT_UNEXPECTED_FILE':
                    return res.status(400).json({
                        success: false,
                        error: 'Unexpected file field. Please use "file" as the field name.',
                        code: 'UNEXPECTED_FIELD'
                    });
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'File upload error: ' + error.message,
                        code: 'UPLOAD_ERROR'
                    });
            }
        }

        if (error.message === 'Only Excel files are allowed') {
            return res.status(400).json({
                success: false,
                error: 'Invalid file type. Only Excel files are accepted.',
                code: 'INVALID_FILE_TYPE'
            });
        }

        // Pass other errors to the next error handler
        next(error);
    }

    /**
     * Store extracted phone records to backup_table with enhanced metadata
     */
    async storeToBackupTableWithMetadata(phoneRecords, sourceFile, extractionReport) {
        try {
            let inserted = 0;
            let skipped = 0;
            const errors = [];

            for (const record of phoneRecords) {
                try {
                    // Prepare metadata for storage
                    const metadata = {
                        extractedFrom: sourceFile,
                        extractionReport: extractionReport,
                        recordMetadata: record.metadata || null,
                        extractionTimestamp: new Date().toISOString()
                    };

                    const result = await databaseManager.insertBackupRecordWithMetadata(
                        record.id,
                        record.phoneNumber,
                        sourceFile,
                        JSON.stringify(metadata)
                    );

                    if (result) {
                        inserted++;
                    } else {
                        skipped++; // Duplicate record
                    }
                } catch (error) {
                    errors.push(`Failed to insert record ${record.id}: ${error.message}`);
                    console.error(`Failed to insert backup record ${record.id}:`, error.message);
                }
            }

            return {
                success: true,
                inserted: inserted,
                skipped: skipped,
                errors: errors,
                totalProcessed: phoneRecords.length
            };

        } catch (error) {
            console.error('Failed to store records to backup table:', error.message);
            return {
                success: false,
                error: error.message,
                inserted: 0,
                skipped: 0
            };
        }
    }

    /**
     * Store extracted phone records to backup_table (legacy method for backward compatibility)
     */
    async storeToBackupTable(phoneRecords) {
        try {
            let inserted = 0;
            let skipped = 0;
            const errors = [];

            for (const record of phoneRecords) {
                try {
                    const result = await databaseManager.insertBackupRecord(record.id, record.phoneNumber);
                    if (result) {
                        inserted++;
                    } else {
                        skipped++; // Duplicate record
                    }
                } catch (error) {
                    errors.push(`Failed to insert record ${record.id}: ${error.message}`);
                    console.error(`Failed to insert backup record ${record.id}:`, error.message);
                }
            }

            return {
                success: true,
                inserted: inserted,
                skipped: skipped,
                errors: errors,
                totalProcessed: phoneRecords.length
            };

        } catch (error) {
            console.error('Failed to store records to backup table:', error.message);
            return {
                success: false,
                error: error.message,
                inserted: 0,
                skipped: 0
            };
        }
    }

    /**
     * Log Excel processing errors with detailed context
     */
    logExcelProcessingError(error, context = {}) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            errorType: 'EXCEL_PROCESSING_ERROR',
            message: error.message,
            stack: error.stack,
            context: {
                filename: context.filename || 'unknown',
                fileSize: context.fileSize || 0,
                processingStep: context.step || 'unknown',
                clientId: context.clientId || 'unknown',
                ...context
            }
        };

        console.error('Excel Processing Error:', JSON.stringify(errorLog, null, 2));

        // In production, you might want to send this to a logging service
        if (process.env.NODE_ENV === 'production' && process.env.ERROR_LOGGING_ENDPOINT) {
            // Send to external logging service
            this.sendToLoggingService(errorLog).catch(logError => {
                console.warn('Failed to send error to logging service:', logError.message);
            });
        }

        return errorLog;
    }

    /**
     * Send error logs to external logging service (placeholder)
     */
    async sendToLoggingService(errorLog) {
        // Placeholder for external logging service integration
        // This could be integrated with services like Winston, Sentry, etc.
        return Promise.resolve();
    }

    /**
     * Detect file type based on filename and MIME type
     */
    detectFileType(filename, mimeType) {
        const lowerFilename = filename.toLowerCase();

        // Excel files only
        if ((lowerFilename.endsWith('.xlsx') && mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
            (lowerFilename.endsWith('.xls') && mimeType === 'application/vnd.ms-excel')) {
            return 'excel';
        }

        return null;
    }

    /**
     * Generate processing suggestions based on error messages
     */
    generateProcessingSuggestions(errorMessage, fileType = 'excel') {
        const suggestions = [];

        if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
            suggestions.push('Remove password protection from the Excel file');
            suggestions.push('Save the Excel file without encryption or password protection');
            suggestions.push('Ensure the Excel file is not read-only or protected');
        }

        if (errorMessage.includes('empty') || errorMessage.includes('no content')) {
            suggestions.push('Ensure the Excel file contains data in worksheets');
            suggestions.push('Check that worksheets are not empty or hidden');
            suggestions.push('Verify that the Excel file has readable content');
        }

        if (errorMessage.includes('phone') || errorMessage.includes('records')) {
            suggestions.push('Ensure the Excel file contains columns with phone numbers');
            suggestions.push('Phone numbers should be in Singapore format (8 digits starting with 6, 8, or 9)');
            suggestions.push('Check that phone numbers are in clearly labeled columns (Phone, Mobile, Contact, etc.)');
            suggestions.push('Ensure worksheets contain data and are not empty');
        }

        if (errorMessage.includes('table') || errorMessage.includes('structure')) {
            suggestions.push('Ensure data is organized in clear columns with headers');
            suggestions.push('Avoid complex merged cells or nested table structures');
            suggestions.push('Use separate columns for different data types (ID, Phone, Company, etc.)');
        }

        if (errorMessage.includes('format') || errorMessage.includes('parsing')) {
            suggestions.push('Try saving the Excel file from the original source again');
            suggestions.push('Ensure the Excel file is not corrupted during transfer');
            suggestions.push('Use a standard Excel format (.xlsx or .xls)');
            suggestions.push('Avoid using complex Excel features like macros or advanced formatting');
        }

        // Excel-specific error handling
        if (fileType === 'excel') {
            if (errorMessage.includes('worksheet') || errorMessage.includes('sheet')) {
                suggestions.push('Ensure at least one worksheet contains data');
                suggestions.push('Check that worksheet names are not corrupted');
                suggestions.push('Verify that worksheets are not hidden or protected');
            }

            if (errorMessage.includes('column') || errorMessage.includes('mapping')) {
                suggestions.push('Use clear column headers (Phone, Mobile, Contact, ID, etc.)');
                suggestions.push('Ensure phone numbers are in separate columns');
                suggestions.push('Avoid merged cells in header rows');
                suggestions.push('Place data in consistent column positions');
            }

            if (errorMessage.includes('corrupted') || errorMessage.includes('damaged')) {
                suggestions.push('Try opening the Excel file in Excel to verify it works');
                suggestions.push('Save a new copy of the Excel file');
                suggestions.push('Check if the file was corrupted during upload');
            }
        }

        // Default suggestions if no specific error patterns match
        if (suggestions.length === 0) {
            suggestions.push('Ensure the Excel file contains clear columns with phone numbers');
            suggestions.push('Check that the file is a valid, unprotected Excel file (.xlsx or .xls)');
            suggestions.push('Verify that phone numbers are in Singapore format (8 digits)');
            suggestions.push('Make sure worksheets contain data and are not empty');
        }

        return suggestions;
    }

    /**
     * Clean up temporary files with enhanced error handling
     */
    async cleanupTempFiles() {
        try {
            const result = await this.fileManager.cleanupTempFiles(60); // Clean files older than 1 hour
            console.log(`Temp file cleanup completed: ${result.deletedCount} files deleted`);

            if (result.errorCount > 0) {
                console.warn(`Temp file cleanup had ${result.errorCount} errors:`, result.errors);
            }

            return result;
        } catch (error) {
            console.error('Temp file cleanup failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * List uploaded PDF files with metadata and processing status
     */
    async listUploadedFiles(req, res) {
        try {
            const {
                limit = 50,
                offset = 0,
                status = null,
                sortBy = 'upload_timestamp',
                sortOrder = 'desc'
            } = req.query;

            // Get files from database with metadata
            const dbFiles = await databaseManager.getUploadedFiles(
                parseInt(limit) || 50,
                parseInt(offset) || 0,
                status
            );

            // Get file system information (simplified for now)
            const fsFiles = [];

            // Use database files directly for now with duplicate handling information
            const mergedFiles = dbFiles.map(dbFile => ({
                id: dbFile.id,
                original_filename: dbFile.original_filename,
                stored_filename: dbFile.stored_filename,
                file_size: dbFile.file_size,
                file_type: dbFile.file_type,
                checksum: dbFile.checksum,
                upload_timestamp: dbFile.upload_timestamp,
                processing_status: dbFile.processing_status,
                records_extracted: dbFile.records_extracted,
                worksheets_processed: dbFile.worksheets_processed,
                processed_at: dbFile.processed_at,
                duplicate_handling: {
                    enabled: true,
                    duplicates_skipped: dbFile.duplicates_skipped || 0,
                    duplicate_percentage: dbFile.duplicate_percentage || 0,
                    duplicate_handling_status: dbFile.duplicate_handling_status || 'unknown',
                    new_records_stored: (dbFile.records_extracted || 0) - (dbFile.duplicates_skipped || 0)
                }
            }));

            // Get file statistics
            const fileStats = await databaseManager.getFileStats();

            res.status(200).json({
                success: true,
                data: {
                    files: mergedFiles,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: fileStats.totalFiles,
                        hasMore: mergedFiles.length === parseInt(limit)
                    },
                    statistics: {
                        database: fileStats
                    },
                    filters: {
                        status: status,
                        sortBy: sortBy,
                        sortOrder: sortOrder
                    }
                }
            });

        } catch (error) {
            console.error('Failed to list uploaded files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve file list',
                code: 'FILE_LIST_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Download original PDF file
     */
    async downloadFile(req, res) {
        try {
            const { filename } = req.params;

            if (!filename) {
                return res.status(400).json({
                    success: false,
                    error: 'Filename is required',
                    code: 'MISSING_FILENAME'
                });
            }

            // Validate filename format (security check)
            if (!this.isValidFilename(filename)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid filename format',
                    code: 'INVALID_FILENAME'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(filename);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in database',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Get file buffer from file system
            const fileBuffer = await this.fileManager.getFileBuffer(filename);

            // Set appropriate headers based on file type
            const fileType = fileMetadata.file_type || 'pdf';
            let contentType = 'application/pdf';

            if (fileType === 'excel') {
                if (fileMetadata.original_filename.toLowerCase().endsWith('.xlsx')) {
                    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                } else {
                    contentType = 'application/vnd.ms-excel';
                }
            }

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.original_filename}"`);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            // Send file
            res.send(fileBuffer);

            console.log(`File downloaded: ${filename} (${fileBuffer.length} bytes)`);

        } catch (error) {
            console.error('Failed to download file:', error);

            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to download file',
                code: 'DOWNLOAD_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Delete/archive uploaded PDF file (admin only)
     */
    async deleteFile(req, res) {
        try {
            const { filename } = req.params;
            const { permanent = false } = req.query;

            if (!filename) {
                return res.status(400).json({
                    success: false,
                    error: 'Filename is required',
                    code: 'MISSING_FILENAME'
                });
            }

            // Validate filename format (security check)
            if (!this.isValidFilename(filename)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid filename format',
                    code: 'INVALID_FILENAME'
                });
            }

            // Check if file exists in database
            const fileMetadata = await databaseManager.getFileMetadata(filename);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in database',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // For now, we'll just mark as archived in database rather than permanent deletion
            // In a production system, you might want to move files to archive storage
            if (permanent === 'true') {
                // Permanent deletion (use with caution)
                await this.fileManager.deleteFile(filename);
                await databaseManager.deleteFileMetadata(filename);

                console.log(`File permanently deleted: ${filename}`);

                res.status(200).json({
                    success: true,
                    message: 'File permanently deleted',
                    data: {
                        filename: filename,
                        originalName: fileMetadata.original_filename,
                        deletedAt: new Date().toISOString(),
                        action: 'permanent_deletion'
                    }
                });
            } else {
                // Soft deletion - mark as archived
                await databaseManager.updateFileProcessingStatus(filename, 'archived', fileMetadata.records_extracted);

                console.log(`File archived: ${filename}`);

                res.status(200).json({
                    success: true,
                    message: 'File archived successfully',
                    data: {
                        filename: filename,
                        originalName: fileMetadata.original_filename,
                        archivedAt: new Date().toISOString(),
                        action: 'archive',
                        note: 'File is archived but still accessible. Use permanent=true to delete permanently.'
                    }
                });
            }

        } catch (error) {
            console.error('Failed to delete/archive file:', error);

            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to delete/archive file',
                code: 'DELETE_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Merge database file information with file system information
     */
    mergeFileInformation(dbFiles, fsFiles) {
        const merged = [];
        const fsFileMap = new Map();

        // Create map of file system files by filename
        fsFiles.forEach(fsFile => {
            fsFileMap.set(fsFile.filename, fsFile);
        });

        // Merge database records with file system information
        dbFiles.forEach(dbFile => {
            const fsFile = fsFileMap.get(dbFile.stored_filename);

            merged.push({
                id: dbFile.id,
                originalFilename: dbFile.original_filename,
                storedFilename: dbFile.stored_filename,
                fileSize: dbFile.file_size,
                checksum: dbFile.checksum,
                uploadTimestamp: dbFile.upload_timestamp,
                processingStatus: dbFile.processing_status,
                recordsExtracted: dbFile.records_extracted,
                processedAt: dbFile.processed_at,
                fileSystem: {
                    exists: !!fsFile,
                    actualSize: fsFile ? fsFile.size : null,
                    created: fsFile ? fsFile.created : null,
                    modified: fsFile ? fsFile.modified : null,
                    accessed: fsFile ? fsFile.accessed : null
                },
                integrity: {
                    sizeMatch: fsFile ? (dbFile.file_size === fsFile.size) : false,
                    accessible: !!fsFile
                }
            });
        });

        return merged;
    }

    /**
     * Validate filename format for security
     */
    isValidFilename(filename) {
        if (!filename || typeof filename !== 'string') return false;

        // Check for path traversal attempts
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return false;
        }

        // Check for valid filename patterns - supports both PDF and Excel files
        // Format: YYYY-MM-DDTHH-MM-SS-SSSZ_filename_hash.ext
        const validPattern = /^[\d\-T:Z]+_[a-zA-Z0-9_\-().\s]+_[a-f0-9]{8}\.(xlsx|xls|pdf)$/i;

        return validPattern.test(filename);
    }

    /**
     * Get upload status and progress for dual-table architecture with file management and duplicate handling
     */
    async getUploadStatus(req, res) {
        try {
            const tableStats = await databaseManager.getTableStats();
            const fileStats = await databaseManager.getFileStats();
            const processingStatus = await phoneValidationProcessor.getProcessingStatus();
            const storageStats = await this.fileManager.getStorageStats();

            // Get duplicate handling statistics
            const duplicateStats = await databaseManager.getDuplicateHandlingStats();

            res.status(200).json({
                success: true,
                data: {
                    backupTable: {
                        totalRecords: tableStats.backupTable,
                        status: 'active'
                    },
                    checkTable: {
                        totalRecords: tableStats.checkTable,
                        validatedPhones: tableStats.validatedPhones,
                        invalidPhones: tableStats.invalidPhones,
                        status: 'active'
                    },
                    duplicateHandling: {
                        enabled: true,
                        totalDuplicatesSkipped: duplicateStats.totalDuplicatesSkipped || 0,
                        filesWithDuplicates: duplicateStats.filesWithDuplicates || 0,
                        averageDuplicatePercentage: duplicateStats.averageDuplicatePercentage || 0,
                        lastDuplicateDetection: duplicateStats.lastDuplicateDetection || null,
                        duplicateHandlingStatus: 'active'
                    },
                    fileManagement: {
                        totalFiles: fileStats.totalFiles,
                        processedFiles: fileStats.processedFiles,
                        pendingFiles: fileStats.pendingFiles,
                        failedFiles: fileStats.failedFiles,
                        totalStorageSize: fileStats.totalSize,
                        totalRecordsExtracted: fileStats.totalRecordsExtracted,
                        storageStats: {
                            totalFiles: storageStats.totalFiles,
                            totalSize: storageStats.totalSize,
                            averageSize: storageStats.averageSize,
                            oldestFile: storageStats.oldestFile,
                            newestFile: storageStats.newestFile
                        }
                    },
                    processing: {
                        pendingValidation: processingStatus.pendingProcessing,
                        isComplete: processingStatus.processingComplete
                    },
                    databaseStatus: 'connected'
                }
            });
        } catch (error) {
            console.error('Failed to get upload status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve upload status',
                code: 'STATUS_ERROR'
            });
        }
    }

    /**
     * Get processing status for a specific file
     */
    async getProcessingStatus(req, res) {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    error: 'File ID is required',
                    code: 'MISSING_FILE_ID'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(fileId);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Get processing status based on file type with duplicate handling information
            let processingStatus = {
                fileId: fileId,
                originalFilename: fileMetadata.original_filename,
                fileType: fileMetadata.file_type || 'pdf',
                processingStatus: fileMetadata.processing_status,
                recordsExtracted: fileMetadata.records_extracted,
                uploadTimestamp: fileMetadata.upload_timestamp,
                processedAt: fileMetadata.processed_at,
                duplicateHandling: {
                    enabled: true,
                    duplicatesSkipped: fileMetadata.duplicates_skipped || 0,
                    duplicatePercentage: fileMetadata.duplicate_percentage || 0,
                    duplicateHandlingStatus: fileMetadata.duplicate_handling_status || 'unknown'
                }
            };

            // For Excel files, get additional processing details
            if (fileMetadata.file_type === 'excel') {
                try {
                    const extractionReport = fileMetadata.extraction_report ?
                        JSON.parse(fileMetadata.extraction_report) : null;

                    processingStatus.excelDetails = {
                        worksheetsProcessed: fileMetadata.worksheets_processed || 0,
                        extractionReport: extractionReport
                    };

                    // Get validation status for Excel records
                    if (fileMetadata.processing_status === 'processed') {
                        const validationStatus = await this.excelProcessor.getExcelProcessingStatus();
                        processingStatus.validationStatus = validationStatus;
                    }
                } catch (parseError) {
                    console.warn('Error parsing Excel extraction report:', parseError.message);
                }
            }

            res.status(200).json({
                success: true,
                data: processingStatus
            });

        } catch (error) {
            console.error('Failed to get processing status:', error);

            // Handle specific error types
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in system',
                    code: 'FILE_NOT_FOUND'
                });
            }

            if (error.message.includes('Database')) {
                return res.status(503).json({
                    success: false,
                    error: 'Database connection error. Please try again later.',
                    code: 'DATABASE_ERROR'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve processing status',
                code: 'STATUS_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get detailed extraction report for a specific file
     */
    async getExtractionReport(req, res) {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    error: 'File ID is required',
                    code: 'MISSING_FILE_ID'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(fileId);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Parse extraction report
            let extractionReport = null;
            if (fileMetadata.extraction_report) {
                try {
                    extractionReport = JSON.parse(fileMetadata.extraction_report);
                } catch (parseError) {
                    console.warn('Error parsing extraction report:', parseError.message);
                }
            }

            const reportData = {
                fileId: fileId,
                originalFilename: fileMetadata.original_filename,
                fileType: fileMetadata.file_type || 'pdf',
                processingStatus: fileMetadata.processing_status,
                recordsExtracted: fileMetadata.records_extracted,
                uploadTimestamp: fileMetadata.upload_timestamp,
                processedAt: fileMetadata.processed_at,
                extractionReport: extractionReport,
                duplicateHandling: {
                    enabled: true,
                    duplicatesSkipped: fileMetadata.duplicates_skipped || 0,
                    duplicatePercentage: fileMetadata.duplicate_percentage || 0,
                    duplicateHandlingStatus: fileMetadata.duplicate_handling_status || 'unknown',
                    duplicateReport: extractionReport?.duplicateHandling?.duplicateReport || null,
                    duplicateIds: extractionReport?.duplicateHandling?.duplicateIds || [],
                    duplicateSummary: this.generateDuplicateSummary(fileMetadata, extractionReport)
                }
            };

            // For Excel files, add additional details
            if (fileMetadata.file_type === 'excel') {
                reportData.excelSpecific = {
                    worksheetsProcessed: fileMetadata.worksheets_processed || 0,
                    columnMapping: extractionReport?.columnMapping || null,
                    worksheetDetails: extractionReport?.worksheetDetails || null,
                    multiPhoneAnalysis: extractionReport?.multiPhoneAnalysis || null,
                    duplicateAnalysis: {
                        duplicateHandlingEnabled: true,
                        duplicatesFoundInExtraction: extractionReport?.duplicateHandling?.duplicatesFound || 0,
                        duplicatePercentageInExtraction: extractionReport?.duplicateHandling?.duplicatePercentage || 0,
                        duplicateReportDetails: extractionReport?.duplicateHandling?.duplicateReport || null
                    }
                };
            }

            res.status(200).json({
                success: true,
                data: reportData
            });

        } catch (error) {
            console.error('Failed to get extraction report:', error);

            // Handle specific error types
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in system',
                    code: 'FILE_NOT_FOUND'
                });
            }

            if (error.message.includes('parsing') || error.message.includes('JSON')) {
                return res.status(500).json({
                    success: false,
                    error: 'Extraction report data is corrupted. Please reprocess the file.',
                    code: 'REPORT_CORRUPTED'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve extraction report',
                code: 'REPORT_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get worksheet information for Excel files
     */
    async getWorksheetInfo(req, res) {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    error: 'File ID is required',
                    code: 'MISSING_FILE_ID'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(fileId);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Check if it's an Excel file
            if (fileMetadata.file_type !== 'excel') {
                return res.status(400).json({
                    success: false,
                    error: 'Worksheet information is only available for Excel files',
                    code: 'NOT_EXCEL_FILE'
                });
            }

            // Parse extraction report to get worksheet details
            let worksheetInfo = null;
            if (fileMetadata.extraction_report) {
                try {
                    const extractionReport = JSON.parse(fileMetadata.extraction_report);
                    worksheetInfo = {
                        worksheetsProcessed: fileMetadata.worksheets_processed || 0,
                        worksheetDetails: extractionReport.worksheetDetails || {},
                        columnMapping: extractionReport.columnMapping || {},
                        summary: extractionReport.summary || {}
                    };
                } catch (parseError) {
                    console.warn('Error parsing worksheet information:', parseError.message);
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    fileId: fileId,
                    originalFilename: fileMetadata.original_filename,
                    worksheetInfo: worksheetInfo
                }
            });

        } catch (error) {
            console.error('Failed to get worksheet information:', error);

            // Handle specific error types
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in system',
                    code: 'FILE_NOT_FOUND'
                });
            }

            if (error.message.includes('parsing') || error.message.includes('JSON')) {
                return res.status(500).json({
                    success: false,
                    error: 'Worksheet information is corrupted. Please reprocess the Excel file.',
                    code: 'WORKSHEET_DATA_CORRUPTED'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve worksheet information',
                code: 'WORKSHEET_INFO_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Generate duplicate summary information for user feedback
     * @param {Object} fileMetadata - File metadata from database
     * @param {Object} extractionReport - Extraction report with duplicate information
     * @returns {Object} Duplicate summary for user display
     */
    generateDuplicateSummary(fileMetadata, extractionReport) {
        const duplicatesSkipped = fileMetadata.duplicates_skipped || 0;
        const duplicatePercentage = fileMetadata.duplicate_percentage || 0;
        const totalRecords = fileMetadata.records_extracted || 0;
        const newRecordsStored = totalRecords - duplicatesSkipped;

        const summary = {
            totalRecordsInFile: totalRecords,
            newRecordsStored: newRecordsStored,
            duplicatesSkipped: duplicatesSkipped,
            duplicatePercentage: duplicatePercentage,
            duplicateHandlingEnabled: true,
            processingResult: duplicatesSkipped > 0 ? 'duplicates_found_and_skipped' : 'no_duplicates_found',
            userMessage: this.generateDuplicateUserMessage(duplicatesSkipped, duplicatePercentage, totalRecords),
            recommendations: this.generateDuplicateRecommendations(duplicatesSkipped, duplicatePercentage, totalRecords)
        };

        // Add detailed duplicate information if available from extraction report
        if (extractionReport?.duplicateHandling?.duplicateReport) {
            const duplicateReport = extractionReport.duplicateHandling.duplicateReport;
            summary.duplicateDetails = {
                duplicatesBySourceFile: duplicateReport.summary?.duplicatesBySourceFile || {},
                phoneNumberFrequency: duplicateReport.phoneNumberFrequency || {},
                recommendations: duplicateReport.recommendations || []
            };
        }

        return summary;
    }

    /**
     * Generate user-friendly duplicate handling message
     * @param {number} duplicatesSkipped - Number of duplicates skipped
     * @param {number} duplicatePercentage - Percentage of duplicates
     * @param {number} totalRecords - Total records in file
     * @returns {string} User-friendly message
     */
    generateDuplicateUserMessage(duplicatesSkipped, duplicatePercentage, totalRecords) {
        if (duplicatesSkipped === 0) {
            return `All ${totalRecords} records were new and successfully stored.`;
        }

        const newRecords = totalRecords - duplicatesSkipped;

        if (duplicatePercentage >= 100) {
            return `All ${totalRecords} records were duplicates and were skipped. No new data was added.`;
        }

        if (duplicatePercentage >= 50) {
            return `${newRecords} new records were stored, but ${duplicatesSkipped} duplicates (${duplicatePercentage}%) were skipped. This file contains a high percentage of duplicate data.`;
        }

        if (duplicatePercentage >= 10) {
            return `${newRecords} new records were stored. ${duplicatesSkipped} duplicates (${duplicatePercentage}%) were automatically skipped.`;
        }

        return `${newRecords} new records were stored. ${duplicatesSkipped} duplicates (${duplicatePercentage}%) were found and skipped.`;
    }

    /**
     * Generate recommendations based on duplicate analysis
     * @param {number} duplicatesSkipped - Number of duplicates skipped
     * @param {number} duplicatePercentage - Percentage of duplicates
     * @param {number} totalRecords - Total records in file
     * @returns {Array} Array of recommendation strings
     */
    generateDuplicateRecommendations(duplicatesSkipped, duplicatePercentage, totalRecords) {
        const recommendations = [];

        if (duplicatesSkipped === 0) {
            recommendations.push('No duplicates found. All data was successfully processed.');
            return recommendations;
        }

        if (duplicatePercentage >= 100) {
            recommendations.push('This file contains only duplicate data. Consider checking if this file has been uploaded before.');
            recommendations.push('Review your data sources to avoid uploading the same file multiple times.');
        } else if (duplicatePercentage >= 50) {
            recommendations.push('High duplicate percentage detected. Consider reviewing data sources for overlap.');
            recommendations.push('You may want to clean your data before uploading to reduce processing time.');
        } else if (duplicatePercentage >= 10) {
            recommendations.push('Moderate number of duplicates found. This is normal for overlapping datasets.');
            recommendations.push('The system automatically handled duplicates without affecting data integrity.');
        } else {
            recommendations.push('Low duplicate percentage is normal and was handled automatically.');
        }

        // Add general recommendations
        recommendations.push('Duplicate detection ensures data integrity by preventing duplicate entries in the system.');

        if (duplicatesSkipped > 100) {
            recommendations.push('Large number of duplicates may indicate data quality issues at the source.');
        }

        return recommendations;
    }

    /**
     * Get detailed duplicate statistics for a specific file
     */
    async getDuplicateStatistics(req, res) {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    error: 'File ID is required',
                    code: 'MISSING_FILE_ID'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(fileId);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Parse extraction report to get detailed duplicate information
            let duplicateDetails = null;
            if (fileMetadata.extraction_report) {
                try {
                    const extractionReport = JSON.parse(fileMetadata.extraction_report);
                    duplicateDetails = extractionReport.duplicateHandling || null;
                } catch (parseError) {
                    console.warn('Error parsing duplicate information:', parseError.message);
                }
            }

            // Generate comprehensive duplicate statistics
            const duplicateStatistics = {
                fileId: fileId,
                originalFilename: fileMetadata.original_filename,
                fileType: fileMetadata.file_type,
                processingStatus: fileMetadata.processing_status,
                duplicateHandling: {
                    enabled: true,
                    summary: {
                        totalRecords: fileMetadata.records_extracted || 0,
                        duplicatesSkipped: fileMetadata.duplicates_skipped || 0,
                        newRecordsStored: (fileMetadata.records_extracted || 0) - (fileMetadata.duplicates_skipped || 0),
                        duplicatePercentage: fileMetadata.duplicate_percentage || 0,
                        duplicateHandlingStatus: fileMetadata.duplicate_handling_status || 'unknown'
                    },
                    detailedReport: duplicateDetails?.duplicateReport || null,
                    duplicateIds: duplicateDetails?.duplicateIds || [],
                    userFeedback: this.generateDuplicateSummary(fileMetadata, { duplicateHandling: duplicateDetails })
                },
                timestamp: new Date().toISOString()
            };

            res.status(200).json({
                success: true,
                data: duplicateStatistics
            });

        } catch (error) {
            console.error('Failed to get duplicate statistics:', error);

            // Handle specific error types
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in system',
                    code: 'FILE_NOT_FOUND'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve duplicate statistics',
                code: 'DUPLICATE_STATS_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get column mapping results for Excel files
     */
    async getColumnMapping(req, res) {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    error: 'File ID is required',
                    code: 'MISSING_FILE_ID'
                });
            }

            // Get file metadata from database
            const fileMetadata = await databaseManager.getFileMetadata(fileId);
            if (!fileMetadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                    code: 'FILE_NOT_FOUND'
                });
            }

            // Check if it's an Excel file
            if (fileMetadata.file_type !== 'excel') {
                return res.status(400).json({
                    success: false,
                    error: 'Column mapping information is only available for Excel files',
                    code: 'NOT_EXCEL_FILE'
                });
            }

            // Parse extraction report to get column mapping details
            let columnMapping = null;
            if (fileMetadata.extraction_report) {
                try {
                    const extractionReport = JSON.parse(fileMetadata.extraction_report);
                    columnMapping = extractionReport.columnMapping || {};
                } catch (parseError) {
                    console.warn('Error parsing column mapping information:', parseError.message);
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    fileId: fileId,
                    originalFilename: fileMetadata.original_filename,
                    columnMapping: columnMapping
                }
            });

        } catch (error) {
            console.error('Failed to get column mapping:', error);

            // Handle specific error types
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in system',
                    code: 'FILE_NOT_FOUND'
                });
            }

            if (error.message.includes('parsing') || error.message.includes('JSON')) {
                return res.status(500).json({
                    success: false,
                    error: 'Column mapping information is corrupted. Please reprocess the Excel file.',
                    code: 'COLUMN_MAPPING_CORRUPTED'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve column mapping information',
                code: 'COLUMN_MAPPING_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Archive old files based on retention policy
     */
    async archiveOldFiles(req, res) {
        try {
            const { retentionDays } = req.body;

            if (!retentionDays || isNaN(parseInt(retentionDays))) {
                return res.status(400).json({
                    success: false,
                    error: 'Retention days must be a valid number',
                    code: 'INVALID_RETENTION_DAYS'
                });
            }

            const result = await this.fileManager.archiveOldFiles(parseInt(retentionDays));

            // Update database status for archived files
            const archivedFiles = await databaseManager.archiveFilesOlderThan(parseInt(retentionDays));

            res.status(200).json({
                success: true,
                message: `Archived ${archivedFiles.changedRows} files older than ${retentionDays} days`,
                data: {
                    archivedCount: archivedFiles.changedRows,
                    eligibleForArchival: result.eligibleForArchival,
                    retentionDays: result.retentionDays
                }
            });
        } catch (error) {
            console.error('Failed to archive old files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to archive old files',
                code: 'ARCHIVE_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Clean up files with failed processing status
     */
    async cleanupFailedFiles(req, res) {
        try {
            const failedFiles = await databaseManager.getFilesByStatus('failed');

            if (failedFiles.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No failed files to clean up',
                    data: {
                        removedCount: 0
                    }
                });
            }

            let removedCount = 0;
            const errors = [];

            for (const file of failedFiles) {
                try {
                    await this.fileManager.deleteFile(file.stored_filename);
                    await databaseManager.deleteFileMetadata(file.stored_filename);
                    removedCount++;
                } catch (error) {
                    errors.push(`Failed to remove ${file.original_filename}: ${error.message}`);
                }
            }

            if (errors.length > 0) {
                console.warn('Cleanup failed files encountered errors:', errors);
                return res.status(500).json({
                    success: false,
                    error: 'Some failed files could not be removed',
                    code: 'CLEANUP_PARTIAL_FAILURE',
                    details: {
                        removedCount,
                        errors
                    }
                });
            }

            res.status(200).json({
                success: true,
                message: `Successfully removed ${removedCount} failed files`,
                data: {
                    removedCount
                }
            });
        } catch (error) {
            console.error('Failed to cleanup failed files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cleanup failed files',
                code: 'CLEANUP_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Get backup_table records with pagination
     */
    async getBackupRecords(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            const records = await databaseManager.getBackupRecordsWithPagination(
                parseInt(limit),
                parseInt(offset)
            );

            res.status(200).json({
                success: true,
                data: {
                    records: records,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: records.length === parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Failed to get backup records:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve backup records',
                code: 'BACKUP_RECORDS_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Get specific backup_table record by ID
     */
    async getBackupRecord(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Record ID is required',
                    code: 'MISSING_RECORD_ID'
                });
            }

            const record = await databaseManager.getBackupRecordById(id);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: 'Record not found',
                    code: 'RECORD_NOT_FOUND'
                });
            }

            res.status(200).json({
                success: true,
                data: record
            });

        } catch (error) {
            console.error('Failed to get backup record:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve backup record',
                code: 'BACKUP_RECORD_ERROR',
                details: error.message
            });
        }
    }

    /**
     * Update company information in backup_table (allows editing company fields only)
     */
    async updateBackupRecordCompanyInfo(req, res) {
        try {
            const { id } = req.params;
            const { companyName, physicalAddress, email, website } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Record ID is required',
                    code: 'MISSING_RECORD_ID'
                });
            }

            // Validate that only company fields are being updated
            const allowedFields = ['companyName', 'physicalAddress', 'email', 'website'];
            const providedFields = Object.keys(req.body);
            const invalidFields = providedFields.filter(field => !allowedFields.includes(field));

            if (invalidFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid fields provided: ${invalidFields.join(', ')}. Only company information can be updated.`,
                    code: 'INVALID_FIELDS'
                });
            }

            // Check if record exists
            const existingRecord = await databaseManager.getBackupRecordById(id);
            if (!existingRecord) {
                return res.status(404).json({
                    success: false,
                    error: 'Record not found',
                    code: 'RECORD_NOT_FOUND'
                });
            }

            // Update company information
            const result = await databaseManager.updateBackupRecordCompanyInfo(
                id,
                companyName,
                physicalAddress,
                email,
                website
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Record not found or no changes made',
                    code: 'NO_CHANGES'
                });
            }

            // Get updated record
            const updatedRecord = await databaseManager.getBackupRecordById(id);

            res.status(200).json({
                success: true,
                message: 'Company information updated successfully',
                data: updatedRecord
            });

        } catch (error) {
            console.error('Failed to update backup record company info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update company information',
                code: 'UPDATE_ERROR',
                details: error.message
            });
        }
    }
}

module.exports = UploadController;
