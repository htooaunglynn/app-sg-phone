const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileManager {
    constructor() {
        // Default upload directory
        this.uploadDir = process.env.UPLOAD_DIR || './uploads';
        this.tempDir = path.join(this.uploadDir, 'temp');
        this.originalDir = path.join(this.uploadDir, 'original');
        this.excelDir = path.join(this.uploadDir, 'excel');
        this.pdfDir = path.join(this.uploadDir, 'pdf');
        
        // File size limits (default 10MB)
        this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
        
        // Supported file types
        this.supportedTypes = ['.pdf', '.xlsx', '.xls'];
        
        // File retention settings (default 30 days)
        this.retentionDays = parseInt(process.env.FILE_RETENTION_DAYS) || 30;
        
        // Security settings
        this.securitySettings = {
            enableVirusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true',
            maxFilesPerHour: parseInt(process.env.MAX_FILES_PER_HOUR) || 100,
            enableFileIntegrityCheck: process.env.ENABLE_FILE_INTEGRITY_CHECK !== 'false',
            quarantineDir: path.join(this.uploadDir, 'quarantine'),
            allowedMimeTypes: [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel' // .xls
            ],
            blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'],
            maxPathLength: parseInt(process.env.MAX_PATH_LENGTH) || 255
        };

        // Performance settings
        this.performanceSettings = {
            enableStreaming: process.env.ENABLE_FILE_STREAMING !== 'false',
            streamingThreshold: parseInt(process.env.STREAMING_THRESHOLD) || 5 * 1024 * 1024, // 5MB
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 64 * 1024, // 64KB
            enableCompression: process.env.ENABLE_COMPRESSION === 'true',
            compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
            enableCaching: process.env.ENABLE_FILE_CACHING === 'true',
            cacheSize: parseInt(process.env.CACHE_SIZE) || 100 * 1024 * 1024 // 100MB
        };

        // Rate limiting
        this.rateLimiter = new Map();
        
        this.initializeDirectories();
    }

    /**
     * Initialize upload directories with proper permissions and security
     */
    async initializeDirectories() {
        try {
            const directories = [
                this.uploadDir, 
                this.tempDir, 
                this.originalDir,
                this.excelDir,
                this.pdfDir,
                this.securitySettings.quarantineDir
            ];
            
            for (const dir of directories) {
                await this.ensureDirectoryExists(dir);
                await this.setSecurePermissions(dir);
            }
            
            // Initialize rate limiter cleanup
            this.startRateLimiterCleanup();
            
            console.log('File manager directories initialized successfully with security settings');
        } catch (error) {
            console.error('Failed to initialize file manager directories:', error);
            throw new Error('File system initialization failed');
        }
    }

    /**
     * Ensure directory exists with proper permissions
     * @param {string} dirPath - Directory path to create
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
                console.log(`Created directory: ${dirPath}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Generate unique timestamped filename
     * @param {string} originalName - Original filename
     * @returns {string} Unique filename with timestamp
     */
    generateUniqueFilename(originalName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        
        // Clean the base name to remove invalid characters
        const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
        
        return `${timestamp}_${cleanBaseName}_${randomSuffix}${extension}`;
    }

    /**
     * Get appropriate storage directory based on file type
     * @param {string} fileType - File type ('pdf', 'excel')
     * @returns {string} Storage directory path
     */
    getStorageDirectory(fileType) {
        switch (fileType.toLowerCase()) {
            case 'pdf':
                return this.pdfDir;
            case 'excel':
                return this.excelDir;
            default:
                // Fallback to original directory for backward compatibility
                return this.originalDir;
        }
    }

    /**
     * Validate PDF file integrity and format
     * @param {Buffer} fileBuffer - File buffer to validate
     * @param {string} originalName - Original filename
     * @returns {Object} Validation result
     */
    async validatePDFIntegrity(fileBuffer, originalName) {
        const validation = {
            isValid: false,
            errors: [],
            warnings: [],
            fileInfo: {
                size: fileBuffer.length,
                originalName: originalName,
                extension: path.extname(originalName).toLowerCase()
            }
        };

        try {
            // Check file size
            if (fileBuffer.length === 0) {
                validation.errors.push('File is empty');
                return validation;
            }

            if (fileBuffer.length > this.maxFileSize) {
                validation.errors.push(`File size (${Math.round(fileBuffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.maxFileSize / 1024 / 1024)}MB)`);
                return validation;
            }

            // Check file extension
            if (!this.supportedTypes.includes(validation.fileInfo.extension)) {
                validation.errors.push(`File type ${validation.fileInfo.extension} is not supported. Only PDF files are allowed.`);
                return validation;
            }

            // Check PDF signature
            if (!this.isPDFBuffer(fileBuffer)) {
                validation.errors.push('File does not appear to be a valid PDF');
                return validation;
            }

            // Additional PDF integrity checks
            const pdfValidation = this.validatePDFStructure(fileBuffer);
            if (!pdfValidation.isValid) {
                validation.errors.push(...pdfValidation.errors);
                validation.warnings.push(...pdfValidation.warnings);
            }

            // If no errors, file is valid
            validation.isValid = validation.errors.length === 0;

            return validation;

        } catch (error) {
            validation.errors.push(`File validation failed: ${error.message}`);
            return validation;
        }
    }

    /**
     * Check if buffer contains PDF signature
     * @param {Buffer} buffer - Buffer to check
     * @returns {boolean} True if buffer appears to be a PDF
     */
    isPDFBuffer(buffer) {
        if (!buffer || buffer.length < 4) return false;
        return buffer.slice(0, 4).toString() === '%PDF';
    }

    /**
     * Check if buffer contains Excel signature
     * @param {Buffer} buffer - Buffer to check
     * @returns {boolean} True if buffer appears to be an Excel file
     */
    isExcelBuffer(buffer) {
        if (!buffer || buffer.length < 8) return false;
        
        // Check for XLSX signature (ZIP-based format)
        const xlsxSignature = buffer.slice(0, 4);
        if (xlsxSignature[0] === 0x50 && xlsxSignature[1] === 0x4B && 
            xlsxSignature[2] === 0x03 && xlsxSignature[3] === 0x04) {
            // Additional check for Excel-specific content
            const bufferString = buffer.toString('binary');
            return bufferString.includes('xl/') || bufferString.includes('worksheets/');
        }
        
        // Check for XLS signature (OLE2 format)
        const xlsSignature = buffer.slice(0, 8);
        return xlsSignature[0] === 0xD0 && xlsSignature[1] === 0xCF && 
               xlsSignature[2] === 0x11 && xlsSignature[3] === 0xE0 &&
               xlsSignature[4] === 0xA1 && xlsSignature[5] === 0xB1 &&
               xlsSignature[6] === 0x1A && xlsSignature[7] === 0xE1;
    }

    /**
     * Validate PDF structure for basic integrity
     * @param {Buffer} buffer - PDF buffer
     * @returns {Object} Validation result
     */
    validatePDFStructure(buffer) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        try {
            const pdfString = buffer.toString('binary');
            
            // Check for PDF version
            const versionMatch = pdfString.match(/%PDF-(\d+\.\d+)/);
            if (!versionMatch) {
                result.errors.push('PDF version not found');
                result.isValid = false;
            } else {
                const version = parseFloat(versionMatch[1]);
                if (version < 1.0 || version > 2.0) {
                    result.warnings.push(`Unusual PDF version: ${version}`);
                }
            }

            // Check for EOF marker
            if (!pdfString.includes('%%EOF')) {
                result.warnings.push('PDF EOF marker not found - file may be truncated');
            }

            // Check for xref table
            if (!pdfString.includes('xref')) {
                result.warnings.push('PDF cross-reference table not found');
            }

            // Check for encrypted PDF
            if (pdfString.includes('/Encrypt')) {
                result.errors.push('PDF is encrypted or password protected');
                result.isValid = false;
            }

        } catch (error) {
            result.errors.push(`PDF structure validation failed: ${error.message}`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * Validate Excel file integrity and format
     * @param {Buffer} fileBuffer - File buffer to validate
     * @param {string} originalName - Original filename
     * @returns {Object} Validation result
     */
    async validateExcelIntegrity(fileBuffer, originalName) {
        const validation = {
            isValid: false,
            errors: [],
            warnings: [],
            fileInfo: {
                size: fileBuffer.length,
                originalName: originalName,
                extension: path.extname(originalName).toLowerCase()
            }
        };

        try {
            // Check file size
            if (fileBuffer.length === 0) {
                validation.errors.push('File is empty');
                return validation;
            }

            if (fileBuffer.length > this.maxFileSize) {
                validation.errors.push(`File size (${Math.round(fileBuffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.maxFileSize / 1024 / 1024)}MB)`);
                return validation;
            }

            // Check file extension
            const supportedExcelTypes = ['.xlsx', '.xls'];
            if (!supportedExcelTypes.includes(validation.fileInfo.extension)) {
                validation.errors.push(`File type ${validation.fileInfo.extension} is not supported. Only Excel files (.xlsx, .xls) are allowed.`);
                return validation;
            }

            // Check Excel signature
            if (!this.isExcelBuffer(fileBuffer)) {
                validation.errors.push('File does not appear to be a valid Excel file');
                return validation;
            }

            // Additional Excel integrity checks
            const excelValidation = this.validateExcelStructure(fileBuffer, validation.fileInfo.extension);
            if (!excelValidation.isValid) {
                validation.errors.push(...excelValidation.errors);
                validation.warnings.push(...excelValidation.warnings);
            }

            // If no errors, file is valid
            validation.isValid = validation.errors.length === 0;

            return validation;

        } catch (error) {
            validation.errors.push(`Excel file validation failed: ${error.message}`);
            return validation;
        }
    }

    /**
     * Validate Excel structure for basic integrity
     * @param {Buffer} buffer - Excel buffer
     * @param {string} extension - File extension
     * @returns {Object} Validation result
     */
    validateExcelStructure(buffer, extension) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        try {
            if (extension === '.xlsx') {
                // XLSX is ZIP-based, check for basic ZIP structure
                const bufferString = buffer.toString('binary');
                
                // Check for essential Excel components
                if (!bufferString.includes('xl/')) {
                    result.errors.push('XLSX file missing Excel structure');
                    result.isValid = false;
                }
                
                if (!bufferString.includes('worksheets/')) {
                    result.warnings.push('XLSX file may not contain worksheets');
                }
                
                // Check for workbook.xml
                if (!bufferString.includes('workbook.xml')) {
                    result.errors.push('XLSX file missing workbook definition');
                    result.isValid = false;
                }
                
                // Check for shared strings (common in Excel files with text)
                if (bufferString.includes('sharedStrings.xml')) {
                    result.warnings.push('Excel file contains shared strings (text data detected)');
                }
                
            } else if (extension === '.xls') {
                // XLS is OLE2 format, basic structure validation
                const bufferString = buffer.toString('binary');
                
                // Check for OLE2 structure markers
                if (!bufferString.includes('Microsoft Excel')) {
                    result.warnings.push('XLS file may not be created by Microsoft Excel');
                }
                
                // Check for workbook stream
                if (!bufferString.includes('Workbook')) {
                    result.errors.push('XLS file missing workbook stream');
                    result.isValid = false;
                }
            }

            // Check for password protection (common indicator)
            const bufferString = buffer.toString('binary');
            if (bufferString.includes('EncryptionInfo') || bufferString.includes('EncryptedPackage')) {
                result.errors.push('Excel file is encrypted or password protected');
                result.isValid = false;
            }

        } catch (error) {
            result.errors.push(`Excel structure validation failed: ${error.message}`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * Validate Excel file MIME type
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} originalName - Original filename
     * @returns {Object} MIME validation result
     */
    validateExcelMimeType(fileBuffer, originalName) {
        const result = {
            isValid: false,
            detectedMimeType: null,
            expectedMimeTypes: [],
            errors: [],
            warnings: []
        };

        try {
            const extension = path.extname(originalName).toLowerCase();
            
            // Set expected MIME types based on extension
            if (extension === '.xlsx') {
                result.expectedMimeTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
            } else if (extension === '.xls') {
                result.expectedMimeTypes = ['application/vnd.ms-excel'];
            } else {
                result.errors.push(`Unsupported Excel file extension: ${extension}`);
                return result;
            }

            // Detect MIME type from file signature
            if (extension === '.xlsx') {
                // XLSX files are ZIP-based
                if (this.isExcelBuffer(fileBuffer)) {
                    const bufferString = fileBuffer.toString('binary');
                    if (bufferString.includes('xl/') && bufferString.includes('worksheets/')) {
                        result.detectedMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        result.isValid = true;
                    } else {
                        result.errors.push('File appears to be ZIP but not Excel format');
                    }
                } else {
                    result.errors.push('File does not have valid XLSX signature');
                }
            } else if (extension === '.xls') {
                // XLS files are OLE2-based
                if (this.isExcelBuffer(fileBuffer)) {
                    result.detectedMimeType = 'application/vnd.ms-excel';
                    result.isValid = true;
                } else {
                    result.errors.push('File does not have valid XLS signature');
                }
            }

        } catch (error) {
            result.errors.push(`MIME type validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Perform Excel-specific security validation
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} originalName - Original filename
     * @returns {Object} Security validation result
     */
    performExcelSecurityValidation(fileBuffer, originalName) {
        const result = {
            isSecure: true,
            errors: [],
            warnings: [],
            securityFlags: []
        };

        try {
            const bufferString = fileBuffer.toString('binary');

            // Check for macros (VBA code)
            const macroIndicators = [
                'vbaProject.bin',
                'VBA/',
                'macros/',
                '_VBA_PROJECT',
                'Microsoft Visual Basic'
            ];

            for (const indicator of macroIndicators) {
                if (bufferString.includes(indicator)) {
                    result.warnings.push('Excel file contains macros (VBA code)');
                    result.securityFlags.push('CONTAINS_MACROS');
                    break;
                }
            }

            // Check for external links
            const externalLinkIndicators = [
                'externalLinks/',
                'http://',
                'https://',
                'ftp://',
                '\\\\', // UNC paths
                'HYPERLINK'
            ];

            for (const indicator of externalLinkIndicators) {
                if (bufferString.includes(indicator)) {
                    result.warnings.push('Excel file may contain external links');
                    result.securityFlags.push('EXTERNAL_LINKS');
                    break;
                }
            }

            // Check for embedded objects
            const embeddedObjectIndicators = [
                'embeddings/',
                'oleObject',
                'package',
                'Microsoft_Excel_Worksheet'
            ];

            for (const indicator of embeddedObjectIndicators) {
                if (bufferString.includes(indicator)) {
                    result.warnings.push('Excel file contains embedded objects');
                    result.securityFlags.push('EMBEDDED_OBJECTS');
                    break;
                }
            }

            // Check for suspicious file size patterns
            if (fileBuffer.length > 50 * 1024 * 1024) { // 50MB
                result.warnings.push('Excel file is unusually large');
                result.securityFlags.push('LARGE_FILE');
            }

            // Check for password protection
            const passwordIndicators = [
                'EncryptionInfo',
                'EncryptedPackage',
                'protection',
                'workbookProtection',
                'sheetProtection'
            ];

            for (const indicator of passwordIndicators) {
                if (bufferString.includes(indicator)) {
                    result.errors.push('Excel file is password protected or encrypted');
                    result.securityFlags.push('PASSWORD_PROTECTED');
                    result.isSecure = false;
                    break;
                }
            }

            // Check for potentially malicious content patterns
            const maliciousPatterns = [
                'cmd.exe',
                'powershell',
                'javascript:',
                'vbscript:',
                'data:text/html',
                '<script',
                'eval(',
                'document.write'
            ];

            for (const pattern of maliciousPatterns) {
                if (bufferString.toLowerCase().includes(pattern.toLowerCase())) {
                    result.errors.push(`Excel file contains potentially malicious content: ${pattern}`);
                    result.securityFlags.push('MALICIOUS_CONTENT');
                    result.isSecure = false;
                }
            }

        } catch (error) {
            result.warnings.push(`Security validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Enhanced Excel file validation with comprehensive security checks
     * @param {Buffer} fileBuffer - File buffer to validate
     * @param {string} originalName - Original filename
     * @param {string} clientId - Client identifier for rate limiting
     * @returns {Object} Enhanced validation result
     */
    async validateExcelIntegrityEnhanced(fileBuffer, originalName, clientId = null) {
        const validation = {
            isValid: false,
            errors: [],
            warnings: [],
            securityFlags: [],
            fileInfo: {
                size: fileBuffer.length,
                originalName: originalName,
                extension: path.extname(originalName).toLowerCase(),
                checksum: this.calculateChecksum(fileBuffer)
            },
            performance: {
                validationTime: 0,
                memoryUsage: process.memoryUsage()
            }
        };

        const startTime = Date.now();

        try {
            // Rate limiting check
            if (clientId && !this.checkRateLimit(clientId)) {
                validation.errors.push(`Rate limit exceeded. Maximum ${this.securitySettings.maxFilesPerHour} files per hour allowed.`);
                return validation;
            }

            // Basic Excel validation
            const basicValidation = await this.validateExcelIntegrity(fileBuffer, originalName);
            validation.errors.push(...basicValidation.errors);
            validation.warnings.push(...basicValidation.warnings);

            if (validation.errors.length > 0) {
                return validation;
            }

            // MIME type validation
            const mimeValidation = this.validateExcelMimeType(fileBuffer, originalName);
            if (!mimeValidation.isValid) {
                validation.errors.push(...mimeValidation.errors);
                validation.warnings.push(...mimeValidation.warnings);
            }

            // Security validation
            const securityValidation = this.performExcelSecurityValidation(fileBuffer, originalName);
            if (!securityValidation.isSecure) {
                validation.errors.push(...securityValidation.errors);
            }
            validation.warnings.push(...securityValidation.warnings);
            validation.securityFlags.push(...securityValidation.securityFlags);

            // File size validation (consistent with PDF processing)
            if (fileBuffer.length > this.maxFileSize) {
                validation.errors.push(`File size exceeds maximum allowed (${Math.round(this.maxFileSize / 1024 / 1024)}MB)`);
            }

            // Security filename validation
            if (!this.isSecureFilename(originalName)) {
                validation.errors.push('Filename contains potentially dangerous characters');
                validation.securityFlags.push('UNSAFE_FILENAME');
            }

            // Path length validation
            if (originalName.length > this.securitySettings.maxPathLength) {
                validation.errors.push('Filename is too long');
                validation.securityFlags.push('FILENAME_TOO_LONG');
            }

            // If no errors, file is valid
            validation.isValid = validation.errors.length === 0;

            return validation;

        } catch (error) {
            validation.errors.push(`Enhanced Excel validation failed: ${error.message}`);
            return validation;
        } finally {
            validation.performance.validationTime = Date.now() - startTime;
        }
    }

    /**
     * Save original PDF file to permanent storage
     * @param {Buffer} fileBuffer - PDF file buffer
     * @param {string} originalName - Original filename
     * @returns {Promise<Object>} Save result with file information
     */
    async saveOriginalPDF(fileBuffer, originalName) {
        try {
            // Validate file first
            const validation = await this.validatePDFIntegrity(fileBuffer, originalName);
            if (!validation.isValid) {
                throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
            }

            // Generate unique filename and determine storage directory
            const uniqueFilename = this.generateUniqueFilename(originalName);
            const storageDir = this.getStorageDirectory('pdf');
            const filePath = path.join(storageDir, uniqueFilename);

            // Save file to permanent storage
            await fs.writeFile(filePath, fileBuffer);

            // Verify file was saved correctly
            const savedStats = await fs.stat(filePath);
            if (savedStats.size !== fileBuffer.length) {
                throw new Error('File save verification failed - size mismatch');
            }

            const fileInfo = {
                originalName: originalName,
                storedFilename: uniqueFilename,
                filePath: filePath,
                fileSize: savedStats.size,
                uploadTimestamp: new Date().toISOString(),
                checksum: this.calculateChecksum(fileBuffer)
            };

            console.log(`PDF file saved successfully: ${uniqueFilename}`);

            return {
                success: true,
                fileInfo: fileInfo,
                validation: {
                    warnings: validation.warnings
                }
            };

        } catch (error) {
            console.error('Failed to save original PDF:', error);
            throw new Error(`File save failed: ${error.message}`);
        }
    }

    /**
     * Save original file (PDF or Excel) to permanent storage
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} originalName - Original filename
     * @returns {Promise<Object>} Save result with file information
     */
    async saveOriginalFile(fileBuffer, originalName) {
        try {
            const extension = path.extname(originalName).toLowerCase();
            
            // Route to appropriate validation and save method
            if (extension === '.pdf') {
                return await this.saveOriginalPDF(fileBuffer, originalName);
            } else if (['.xlsx', '.xls'].includes(extension)) {
                return await this.saveOriginalExcel(fileBuffer, originalName);
            } else {
                throw new Error(`Unsupported file type: ${extension}`);
            }
        } catch (error) {
            console.error('Failed to save original file:', error);
            throw new Error(`File save failed: ${error.message}`);
        }
    }

    /**
     * Save original Excel file to permanent storage
     * @param {Buffer} fileBuffer - Excel file buffer
     * @param {string} originalName - Original filename
     * @returns {Promise<Object>} Save result with file information
     */
    async saveOriginalExcel(fileBuffer, originalName) {
        try {
            // Enhanced validation with security checks
            const validation = await this.validateExcelIntegrityEnhanced(fileBuffer, originalName);
            if (!validation.isValid) {
                throw new Error(`Excel file validation failed: ${validation.errors.join(', ')}`);
            }

            // Generate unique filename and determine storage directory
            const uniqueFilename = this.generateUniqueFilename(originalName);
            const storageDir = this.getStorageDirectory('excel');
            const filePath = path.join(storageDir, uniqueFilename);

            // Save file to permanent storage
            await fs.writeFile(filePath, fileBuffer);

            // Verify file was saved correctly
            const savedStats = await fs.stat(filePath);
            if (savedStats.size !== fileBuffer.length) {
                throw new Error('Excel file save verification failed - size mismatch');
            }

            const fileInfo = {
                originalName: originalName,
                storedFilename: uniqueFilename,
                filePath: filePath,
                fileSize: savedStats.size,
                uploadTimestamp: new Date().toISOString(),
                checksum: this.calculateChecksum(fileBuffer),
                fileType: 'excel'
            };

            console.log(`Excel file saved successfully: ${uniqueFilename}`);

            return {
                success: true,
                fileInfo: fileInfo,
                validation: {
                    warnings: validation.warnings
                }
            };

        } catch (error) {
            console.error('Failed to save original Excel:', error);
            throw new Error(`Excel file save failed: ${error.message}`);
        }
    }

    /**
     * Calculate file checksum for integrity verification
     * @param {Buffer} buffer - File buffer
     * @returns {string} SHA-256 checksum
     */
    calculateChecksum(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Get file metadata for a stored file
     * @param {string} filename - Stored filename
     * @returns {Promise<Object>} File metadata
     */
    async getFileMetadata(filename) {
        try {
            const extension = path.extname(filename).toLowerCase();
            const fileType = this.getFileType(extension);
            
            // Try to find file in appropriate directory first, then fallback to original
            let filePath;
            let stats;
            
            try {
                const storageDir = this.getStorageDirectory(fileType);
                filePath = path.join(storageDir, filename);
                stats = await fs.stat(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Fallback to original directory for backward compatibility
                    filePath = path.join(this.originalDir, filename);
                    stats = await fs.stat(filePath);
                } else {
                    throw error;
                }
            }
            
            const metadata = {
                filename: filename,
                filePath: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                fileType: fileType
            };

            // Add type-specific metadata
            if (['.xlsx', '.xls'].includes(extension)) {
                const excelMetadata = await this.getExcelMetadata(filename);
                metadata.excelInfo = excelMetadata;
            }
            
            return metadata;
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filename}`);
            }
            throw new Error(`Failed to get file metadata: ${error.message}`);
        }
    }

    /**
     * Get Excel-specific metadata for a stored Excel file
     * @param {string} filename - Stored filename
     * @returns {Promise<Object>} Excel metadata
     */
    async getExcelMetadata(filename) {
        try {
            // Try Excel directory first, then fallback to original
            let filePath;
            let fileBuffer;
            
            try {
                filePath = path.join(this.excelDir, filename);
                fileBuffer = await fs.readFile(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Fallback to original directory
                    filePath = path.join(this.originalDir, filename);
                    fileBuffer = await fs.readFile(filePath);
                } else {
                    throw error;
                }
            }
            const extension = path.extname(filename).toLowerCase();
            
            const metadata = {
                fileType: 'excel',
                extension: extension,
                size: fileBuffer.length,
                isValid: false,
                worksheetCount: 0,
                hasData: false,
                estimatedRows: 0,
                lastModified: (await fs.stat(filePath)).mtime
            };

            // Basic validation
            const validation = await this.validateExcelIntegrity(fileBuffer, filename);
            metadata.isValid = validation.isValid;
            metadata.validationErrors = validation.errors;
            metadata.validationWarnings = validation.warnings;

            if (metadata.isValid) {
                // Try to get basic Excel structure info without full parsing
                const bufferString = fileBuffer.toString('binary');
                
                if (extension === '.xlsx') {
                    // Count worksheet references in XLSX
                    const worksheetMatches = bufferString.match(/xl\/worksheets\/sheet\d+\.xml/g);
                    metadata.worksheetCount = worksheetMatches ? worksheetMatches.length : 0;
                    
                    // Check for shared strings (indicates text data)
                    metadata.hasData = bufferString.includes('sharedStrings.xml') || 
                                     bufferString.includes('<c r=') || 
                                     bufferString.includes('<v>');
                    
                    // Rough estimation of data rows (very approximate)
                    const rowMatches = bufferString.match(/<row r="/g);
                    metadata.estimatedRows = rowMatches ? rowMatches.length : 0;
                    
                } else if (extension === '.xls') {
                    // Basic XLS structure analysis
                    metadata.hasData = bufferString.includes('Sheet') || bufferString.includes('Worksheet');
                    
                    // XLS worksheet counting is more complex, provide basic estimate
                    const sheetMatches = bufferString.match(/Sheet\d/g);
                    metadata.worksheetCount = sheetMatches ? new Set(sheetMatches).size : 1;
                    
                    // Very rough row estimation for XLS
                    metadata.estimatedRows = Math.floor(fileBuffer.length / 100); // Rough estimate
                }
            }

            return metadata;

        } catch (error) {
            console.error(`Failed to get Excel metadata for ${filename}:`, error);
            return {
                fileType: 'excel',
                isValid: false,
                error: error.message,
                worksheetCount: 0,
                hasData: false,
                estimatedRows: 0
            };
        }
    }

    /**
     * Determine file type from extension
     * @param {string} extension - File extension
     * @returns {string} File type
     */
    getFileType(extension) {
        switch (extension.toLowerCase()) {
            case '.pdf':
                return 'pdf';
            case '.xlsx':
            case '.xls':
                return 'excel';
            default:
                return 'unknown';
        }
    }

    /**
     * List all uploaded files (PDF and Excel)
     * @param {Object} options - Listing options
     * @returns {Promise<Array>} Array of file information
     */
    async listUploadedFiles(options = {}) {
        try {
            const { 
                sortBy = 'created', 
                sortOrder = 'desc', 
                limit = null, 
                fileType = null // 'pdf', 'excel', or null for all
            } = options;
            
            // Scan multiple directories for files
            const allFiles = [];
            
            // Scan type-specific directories
            const directories = [
                { dir: this.pdfDir, type: 'pdf' },
                { dir: this.excelDir, type: 'excel' },
                { dir: this.originalDir, type: 'mixed' } // For backward compatibility
            ];
            
            for (const { dir, type } of directories) {
                try {
                    const dirFiles = await fs.readdir(dir);
                    for (const file of dirFiles) {
                        const extension = path.extname(file).toLowerCase();
                        if (this.supportedTypes.includes(extension)) {
                            // Avoid duplicates if file exists in multiple directories
                            if (!allFiles.some(f => f.filename === file)) {
                                allFiles.push({
                                    filename: file,
                                    directory: dir,
                                    detectedType: this.getFileType(extension)
                                });
                            }
                        }
                    }
                } catch (error) {
                    // Directory might not exist, continue with others
                    console.warn(`Could not read directory ${dir}:`, error.message);
                }
            }

            // Apply file type filter if specified
            let filteredFiles = allFiles;
            if (fileType) {
                filteredFiles = allFiles.filter(file => file.detectedType === fileType);
            }

            // Apply file type filter if specified
            if (fileType) {
                filteredFiles = filteredFiles.filter(file => {
                    const extension = path.extname(file).toLowerCase();
                    const type = this.getFileType(extension);
                    return type === fileType;
                });
            }
            
            const fileInfos = [];
            
            for (const fileInfo of filteredFiles) {
                try {
                    const metadata = await this.getFileMetadata(fileInfo.filename);
                    fileInfos.push(metadata);
                } catch (error) {
                    console.warn(`Failed to get metadata for ${fileInfo.filename}:`, error.message);
                }
            }

            // Sort files
            fileInfos.sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'name':
                        comparison = a.filename.localeCompare(b.filename);
                        break;
                    case 'size':
                        comparison = a.size - b.size;
                        break;
                    case 'type':
                        comparison = a.fileType.localeCompare(b.fileType);
                        break;
                    case 'created':
                    default:
                        comparison = new Date(a.created) - new Date(b.created);
                        break;
                }
                
                return sortOrder === 'desc' ? -comparison : comparison;
            });

            // Apply limit if specified
            return limit ? fileInfos.slice(0, limit) : fileInfos;

        } catch (error) {
            console.error('Failed to list uploaded files:', error);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    /**
     * Get file buffer for a stored file
     * @param {string} filename - Stored filename
     * @returns {Promise<Buffer>} File buffer
     */
    async getFileBuffer(filename) {
        try {
            const extension = path.extname(filename).toLowerCase();
            const fileType = this.getFileType(extension);
            
            // Try appropriate directory first, then fallback to original
            try {
                const storageDir = this.getStorageDirectory(fileType);
                const filePath = path.join(storageDir, filename);
                return await fs.readFile(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Fallback to original directory
                    const filePath = path.join(this.originalDir, filename);
                    return await fs.readFile(filePath);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filename}`);
            }
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Clean up temporary files
     * @param {number} maxAgeMinutes - Maximum age in minutes for temp files
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupTempFiles(maxAgeMinutes = 60) {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            const maxAge = maxAgeMinutes * 60 * 1000;
            
            let deletedCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const file of files) {
                try {
                    const filePath = path.join(this.tempDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`Deleted temp file: ${file}`);
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Failed to delete ${file}: ${error.message}`);
                }
            }

            return {
                success: true,
                deletedCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Temp file cleanup failed:', error);
            throw new Error(`Cleanup failed: ${error.message}`);
        }
    }

    /**
     * Archive old files based on retention policy
     * @param {number} retentionDays - Number of days to retain files
     * @returns {Promise<Object>} Archive result
     */
    async archiveOldFiles(retentionDays = null) {
        try {
            const retention = retentionDays || this.retentionDays;
            const files = await this.listUploadedFiles();
            const now = Date.now();
            const retentionMs = retention * 24 * 60 * 60 * 1000;
            
            let archivedCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const fileInfo of files) {
                try {
                    const fileAge = now - new Date(fileInfo.created).getTime();
                    
                    if (fileAge > retentionMs) {
                        // For now, we'll just log old files
                        // In a production system, you might move them to archive storage
                        console.log(`File ${fileInfo.filename} is ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days old and eligible for archival`);
                        archivedCount++;
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Failed to process ${fileInfo.filename}: ${error.message}`);
                }
            }

            return {
                success: true,
                eligibleForArchival: archivedCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined,
                retentionDays: retention
            };

        } catch (error) {
            console.error('File archival check failed:', error);
            throw new Error(`Archival check failed: ${error.message}`);
        }
    }

    /**
     * Clean up Excel processing temporary files
     * @param {number} maxAgeMinutes - Maximum age in minutes for temp files
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupExcelTempFiles(maxAgeMinutes = 60) {
        try {
            const result = await this.cleanupTempFiles(maxAgeMinutes);
            
            // Additional Excel-specific cleanup if needed
            // This could include cleaning up any Excel-specific temporary processing files
            
            return {
                ...result,
                excelSpecificCleanup: true
            };

        } catch (error) {
            console.error('Excel temp file cleanup failed:', error);
            throw new Error(`Excel cleanup failed: ${error.message}`);
        }
    }

    /**
     * Archive Excel files based on retention policy
     * @param {number} retentionDays - Number of days to retain files
     * @returns {Promise<Object>} Archive result
     */
    async archiveExcelFiles(retentionDays = null) {
        try {
            const retention = retentionDays || this.retentionDays;
            const excelFiles = await this.listUploadedFiles({ fileType: 'excel' });
            const now = Date.now();
            const retentionMs = retention * 24 * 60 * 60 * 1000;
            
            let archivedCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const fileInfo of excelFiles) {
                try {
                    const fileAge = now - new Date(fileInfo.created).getTime();
                    
                    if (fileAge > retentionMs) {
                        // For now, we'll just log old Excel files
                        // In a production system, you might move them to archive storage
                        console.log(`Excel file ${fileInfo.filename} is ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days old and eligible for archival`);
                        archivedCount++;
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Failed to process Excel file ${fileInfo.filename}: ${error.message}`);
                }
            }

            return {
                success: true,
                fileType: 'excel',
                eligibleForArchival: archivedCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined,
                retentionDays: retention
            };

        } catch (error) {
            console.error('Excel file archival check failed:', error);
            throw new Error(`Excel archival check failed: ${error.message}`);
        }
    }

    /**
     * Delete a specific file (admin operation)
     * @param {string} filename - Filename to delete
     * @returns {Promise<Object>} Delete result
     */
    async deleteFile(filename) {
        try {
            const extension = path.extname(filename).toLowerCase();
            const fileType = this.getFileType(extension);
            
            // Try to find and delete file from appropriate directory
            let filePath;
            let metadata;
            
            try {
                const storageDir = this.getStorageDirectory(fileType);
                filePath = path.join(storageDir, filename);
                await fs.access(filePath);
                metadata = await this.getFileMetadata(filename);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Try original directory as fallback
                    filePath = path.join(this.originalDir, filename);
                    await fs.access(filePath);
                    metadata = await this.getFileMetadata(filename);
                } else {
                    throw error;
                }
            }
            
            // Delete the file
            await fs.unlink(filePath);
            
            console.log(`File deleted: ${filename} from ${path.dirname(filePath)}`);
            
            return {
                success: true,
                deletedFile: metadata
            };

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filename}`);
            }
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    /**
     * Set secure permissions on directory
     * @param {string} dirPath - Directory path
     */
    async setSecurePermissions(dirPath) {
        try {
            // Set directory permissions to 755 (owner: rwx, group: rx, others: rx)
            await fs.chmod(dirPath, 0o755);
            
            // On Unix systems, ensure proper ownership
            if (process.platform !== 'win32') {
                const stats = await fs.stat(dirPath);
                if (stats.uid !== process.getuid() || stats.gid !== process.getgid()) {
                    console.warn(`Directory ${dirPath} has different ownership than process`);
                }
            }
        } catch (error) {
            console.warn(`Failed to set secure permissions on ${dirPath}:`, error.message);
        }
    }

    /**
     * Start rate limiter cleanup interval
     */
    startRateLimiterCleanup() {
        setInterval(() => {
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            
            for (const [key, data] of this.rateLimiter.entries()) {
                if (now - data.timestamp > oneHour) {
                    this.rateLimiter.delete(key);
                }
            }
        }, 15 * 60 * 1000); // Clean up every 15 minutes
    }

    /**
     * Check rate limiting for file uploads
     * @param {string} clientId - Client identifier (IP address)
     * @returns {boolean} True if within rate limits
     */
    checkRateLimit(clientId) {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        if (!this.rateLimiter.has(clientId)) {
            this.rateLimiter.set(clientId, { count: 1, timestamp: now });
            return true;
        }
        
        const data = this.rateLimiter.get(clientId);
        
        // Reset counter if more than an hour has passed
        if (now - data.timestamp > oneHour) {
            this.rateLimiter.set(clientId, { count: 1, timestamp: now });
            return true;
        }
        
        // Check if within limits
        if (data.count >= this.securitySettings.maxFilesPerHour) {
            return false;
        }
        
        // Increment counter
        data.count++;
        return true;
    }

    /**
     * Enhanced security validation with comprehensive checks
     * @param {Buffer} fileBuffer - File buffer to validate
     * @param {string} originalName - Original filename
     * @param {string} clientId - Client identifier for rate limiting
     * @returns {Object} Enhanced validation result
     */
    async validatePDFIntegrityEnhanced(fileBuffer, originalName, clientId = null) {
        const validation = {
            isValid: false,
            errors: [],
            warnings: [],
            securityFlags: [],
            fileInfo: {
                size: fileBuffer.length,
                originalName: originalName,
                extension: path.extname(originalName).toLowerCase(),
                checksum: this.calculateChecksum(fileBuffer)
            },
            performance: {
                validationTime: 0,
                memoryUsage: process.memoryUsage()
            }
        };

        const startTime = Date.now();

        try {
            // Rate limiting check
            if (clientId && !this.checkRateLimit(clientId)) {
                validation.errors.push(`Rate limit exceeded. Maximum ${this.securitySettings.maxFilesPerHour} files per hour allowed.`);
                return validation;
            }

            // Basic validation
            const basicValidation = await this.validatePDFIntegrity(fileBuffer, originalName);
            validation.errors.push(...basicValidation.errors);
            validation.warnings.push(...basicValidation.warnings);

            if (validation.errors.length > 0) {
                return validation;
            }

            // Enhanced security checks
            await this.performEnhancedSecurityChecks(fileBuffer, originalName, validation);

            // File integrity verification
            if (this.securitySettings.enableFileIntegrityCheck) {
                await this.verifyFileIntegrity(fileBuffer, validation);
            }

            // Path traversal protection
            if (!this.isSecureFilename(originalName)) {
                validation.errors.push('Filename contains potentially dangerous characters');
                validation.securityFlags.push('UNSAFE_FILENAME');
            }

            // Check for blocked extensions
            const extension = path.extname(originalName).toLowerCase();
            if (this.securitySettings.blockedExtensions.includes(extension)) {
                validation.errors.push(`File extension ${extension} is not allowed`);
                validation.securityFlags.push('BLOCKED_EXTENSION');
            }

            // Path length validation
            if (originalName.length > this.securitySettings.maxPathLength) {
                validation.errors.push('Filename is too long');
                validation.securityFlags.push('FILENAME_TOO_LONG');
            }

            // If no errors, file is valid
            validation.isValid = validation.errors.length === 0;

            return validation;

        } catch (error) {
            validation.errors.push(`Enhanced validation failed: ${error.message}`);
            return validation;
        } finally {
            validation.performance.validationTime = Date.now() - startTime;
        }
    }

    /**
     * Perform enhanced security checks
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} originalName - Original filename
     * @param {Object} validation - Validation object to update
     */
    async performEnhancedSecurityChecks(fileBuffer, originalName, validation) {
        // Check for suspicious file patterns
        const fileHeader = fileBuffer.slice(0, 1024).toString('hex');
        
        // Check for embedded executables
        const executableSignatures = [
            '4d5a', // PE executable
            '7f454c46', // ELF executable
            'cafebabe', // Java class file
            '504b0304' // ZIP file (could contain executables)
        ];

        for (const signature of executableSignatures) {
            if (fileHeader.includes(signature)) {
                validation.warnings.push('File may contain embedded executable content');
                validation.securityFlags.push('EMBEDDED_EXECUTABLE');
                break;
            }
        }

        // Check for suspicious filename patterns
        const suspiciousPatterns = [
            /\.(exe|bat|cmd|scr|pif|com|jar)$/i,
            /\.(php|asp|jsp|js|vbs|ps1)$/i,
            /\.(sh|bash|zsh|fish)$/i,
            /\.(dll|so|dylib)$/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(originalName)) {
                validation.warnings.push('Filename matches suspicious pattern');
                validation.securityFlags.push('SUSPICIOUS_FILENAME');
                break;
            }
        }

        // Check for double extensions
        if ((originalName.match(/\./g) || []).length > 1) {
            validation.warnings.push('File has multiple extensions');
            validation.securityFlags.push('MULTIPLE_EXTENSIONS');
        }
    }

    /**
     * Verify file integrity
     * @param {Buffer} fileBuffer - File buffer
     * @param {Object} validation - Validation object to update
     */
    async verifyFileIntegrity(fileBuffer, validation) {
        try {
            // Verify PDF structure integrity
            const pdfString = fileBuffer.toString('binary');
            
            // Check for proper PDF structure
            if (!pdfString.startsWith('%PDF-')) {
                validation.errors.push('Invalid PDF header');
                validation.securityFlags.push('INVALID_PDF_HEADER');
                return;
            }

            // Check for proper EOF
            if (!pdfString.includes('%%EOF')) {
                validation.warnings.push('PDF may be truncated or corrupted');
                validation.securityFlags.push('MISSING_EOF');
            }

            // Check for excessive object count (potential zip bomb)
            const objectCount = (pdfString.match(/\d+ \d+ obj/g) || []).length;
            if (objectCount > 50000) {
                validation.warnings.push('PDF contains excessive number of objects');
                validation.securityFlags.push('EXCESSIVE_OBJECTS');
            }

            // Check for suspicious content
            const suspiciousContent = [
                '/JavaScript',
                '/JS',
                '/OpenAction',
                '/Launch',
                '/EmbeddedFile',
                '/FileAttachment'
            ];

            for (const content of suspiciousContent) {
                if (pdfString.includes(content)) {
                    validation.warnings.push(`PDF contains potentially dangerous content: ${content}`);
                    validation.securityFlags.push('SUSPICIOUS_CONTENT');
                }
            }

        } catch (error) {
            validation.warnings.push(`File integrity check failed: ${error.message}`);
        }
    }

    /**
     * Check if filename is secure
     * @param {string} filename - Filename to check
     * @returns {boolean} True if secure
     */
    isSecureFilename(filename) {
        if (!filename || typeof filename !== 'string') return false;
        
        // Check for path traversal attempts
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return false;
        }
        
        // Check for null bytes
        if (filename.includes('\0')) {
            return false;
        }
        
        // Check for control characters
        if (/[\x00-\x1f\x7f-\x9f]/.test(filename)) {
            return false;
        }
        
        // Check for reserved names (Windows)
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const baseName = path.basename(filename, path.extname(filename)).toUpperCase();
        if (reservedNames.includes(baseName)) {
            return false;
        }
        
        return true;
    }

    /**
     * Save original PDF file with enhanced security and streaming support
     * @param {Buffer} fileBuffer - PDF file buffer
     * @param {string} originalName - Original filename
     * @param {string} clientId - Client identifier for rate limiting
     * @param {Object} options - Save options
     * @returns {Promise<Object>} Save result with enhanced information
     */
    async saveOriginalPDFEnhanced(fileBuffer, originalName, clientId = null, options = {}) {
        try {
            // Enhanced validation
            const validation = await this.validatePDFIntegrityEnhanced(fileBuffer, originalName, clientId);
            if (!validation.isValid) {
                throw new Error(`Enhanced file validation failed: ${validation.errors.join(', ')}`);
            }

            // Generate unique filename
            const uniqueFilename = this.generateUniqueFilename(originalName);
            const filePath = path.join(this.originalDir, uniqueFilename);

            // Use streaming for large files
            const useStreaming = fileBuffer.length > this.performanceSettings.streamingThreshold;
            
            if (useStreaming && this.performanceSettings.enableStreaming) {
                await this.saveFileWithStreaming(fileBuffer, filePath);
            } else {
                await fs.writeFile(filePath, fileBuffer);
            }

            // Set secure file permissions
            await fs.chmod(filePath, 0o644); // rw-r--r--

            // Verify file was saved correctly
            const savedStats = await fs.stat(filePath);
            if (savedStats.size !== fileBuffer.length) {
                throw new Error('File save verification failed - size mismatch');
            }

            const fileInfo = {
                originalName: originalName,
                storedFilename: uniqueFilename,
                filePath: filePath,
                fileSize: savedStats.size,
                uploadTimestamp: new Date().toISOString(),
                checksum: validation.fileInfo.checksum,
                securityFlags: validation.securityFlags,
                validationTime: validation.performance.validationTime,
                streamingUsed: useStreaming
            };

            console.log(`Enhanced PDF file saved successfully: ${uniqueFilename} (streaming: ${useStreaming})`);

            return {
                success: true,
                fileInfo: fileInfo,
                validation: {
                    warnings: validation.warnings,
                    securityFlags: validation.securityFlags
                }
            };

        } catch (error) {
            console.error('Failed to save original PDF with enhanced security:', error);
            throw new Error(`Enhanced file save failed: ${error.message}`);
        }
    }

    /**
     * Save file using streaming for large files
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} filePath - Destination file path
     */
    async saveFileWithStreaming(fileBuffer, filePath) {
        const writeStream = require('fs').createWriteStream(filePath);
        const chunkSize = this.performanceSettings.chunkSize;
        
        return new Promise((resolve, reject) => {
            let offset = 0;
            
            const writeNextChunk = () => {
                if (offset >= fileBuffer.length) {
                    writeStream.end();
                    return;
                }
                
                const chunk = fileBuffer.slice(offset, Math.min(offset + chunkSize, fileBuffer.length));
                writeStream.write(chunk);
                offset += chunkSize;
                
                // Use setImmediate to prevent blocking
                setImmediate(writeNextChunk);
            };
            
            writeStream.on('error', reject);
            writeStream.on('finish', resolve);
            
            writeNextChunk();
        });
    }

    /**
     * Get storage statistics with enhanced security information
     * @returns {Promise<Object>} Enhanced storage statistics
     */
    async getStorageStats() {
        try {
            const files = await this.listUploadedFiles();
            
            const stats = {
                totalFiles: files.length,
                totalSize: files.reduce((sum, file) => sum + file.size, 0),
                averageSize: 0,
                oldestFile: null,
                newestFile: null,
                sizeByMonth: {},
                security: {
                    quarantinedFiles: 0,
                    flaggedFiles: 0,
                    rateLimitedClients: this.rateLimiter.size
                },
                performance: {
                    streamingThreshold: this.performanceSettings.streamingThreshold,
                    enabledOptimizations: {
                        streaming: this.performanceSettings.enableStreaming,
                        compression: this.performanceSettings.enableCompression,
                        caching: this.performanceSettings.enableCaching
                    }
                }
            };

            if (files.length > 0) {
                stats.averageSize = Math.round(stats.totalSize / files.length);
                stats.oldestFile = files.reduce((oldest, file) => 
                    new Date(file.created) < new Date(oldest.created) ? file : oldest
                );
                stats.newestFile = files.reduce((newest, file) => 
                    new Date(file.created) > new Date(newest.created) ? file : newest
                );

                // Group by month
                files.forEach(file => {
                    const month = new Date(file.created).toISOString().substring(0, 7);
                    if (!stats.sizeByMonth[month]) {
                        stats.sizeByMonth[month] = { count: 0, size: 0 };
                    }
                    stats.sizeByMonth[month].count++;
                    stats.sizeByMonth[month].size += file.size;
                });
            }

            // Check quarantine directory
            try {
                const quarantineFiles = await fs.readdir(this.securitySettings.quarantineDir);
                stats.security.quarantinedFiles = quarantineFiles.length;
            } catch (error) {
                // Quarantine directory might not exist
                stats.security.quarantinedFiles = 0;
            }

            return stats;

        } catch (error) {
            console.error('Failed to get enhanced storage stats:', error);
            throw new Error(`Enhanced storage stats failed: ${error.message}`);
        }
    }
}

module.exports = FileManager;