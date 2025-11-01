const ExcelExporter = require('../services/excelExporter');
const CheckTable = require('../models/CheckTable');
const databaseManager = require('../utils/database');

class ExportController {
    constructor() {
        this.excelExporter = new ExcelExporter();
    }

    /**
     * Handle Excel export by range from check_table
     */
    async exportByRange(req, res) {
        const startTime = Date.now();

        try {
            // Extract and validate parameters
            const { start, end } = req.params;

            console.log(`Export request from check_table: records ${start}-${end}`);

            // Basic parameter validation
            if (!start || !end) {
                return res.status(400).json({
                    success: false,
                    error: 'Both start and end parameters are required',
                    code: 'MISSING_PARAMETERS'
                });
            }

            // Convert to numbers
            const startRecord = parseInt(start);
            const endRecord = parseInt(end);

            // Validate number conversion
            if (isNaN(startRecord) || isNaN(endRecord)) {
                return res.status(400).json({
                    success: false,
                    error: 'Start and end parameters must be valid numbers',
                    code: 'INVALID_PARAMETERS'
                });
            }

            // Validate range
            if (startRecord < 1 || endRecord < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Record numbers must be greater than 0',
                    code: 'INVALID_RANGE'
                });
            }

            if (startRecord > endRecord) {
                return res.status(400).json({
                    success: false,
                    error: 'Start record must be less than or equal to end record',
                    code: 'INVALID_RANGE'
                });
            }

            // Check if check_table has any records
            const totalRecords = await CheckTable.getTotalRecordCount();

            if (totalRecords === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No records available for export from check table. Please upload and process some data first.',
                    code: 'NO_DATA'
                });
            }

            // Validate range against available data in check_table
            const validation = await CheckTable.validateExportRange(startRecord, endRecord);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: validation.error,
                    code: 'RANGE_VALIDATION_FAILED'
                });
            }

            // Get records from check_table
            const recordsResult = await CheckTable.getRecordsByRange(startRecord, endRecord);

            if (!recordsResult.success) {
                return res.status(500).json({
                    success: false,
                    error: recordsResult.error,
                    code: 'DATA_RETRIEVAL_FAILED'
                });
            }

            if (recordsResult.records.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No records found in specified range',
                    code: 'NO_RECORDS_IN_RANGE',
                    metadata: {
                        startRecord: startRecord,
                        endRecord: endRecord,
                        totalAvailable: totalRecords
                    }
                });
            }

            // Export records using ExcelExporter with check_table data
            const exportResult = await this.excelExporter.exportCheckTableRecords(
                recordsResult.records,
                {
                    sheetName: `Check_Table_${startRecord}-${recordsResult.endRecord}`,
                    startRecord: startRecord,
                    endRecord: recordsResult.endRecord,
                    totalAvailable: totalRecords,
                    enableStyling: true, // Enable styling for Excel export
                    stylingOptions: {
                        fontName: 'Aptos Narrow',
                        fontSize: 12,
                        horizontalAlign: 'center',
                        verticalAlign: 'center'
                    }
                }
            );

            if (!exportResult.success) {
                console.error('Export failed:', exportResult.error);
                return res.status(500).json({
                    success: false,
                    error: exportResult.error,
                    code: 'EXPORT_FAILED'
                });
            }

            // Generate filename for check_table export
            const filename = `check_table_export_${startRecord}-${recordsResult.endRecord}_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Set response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', exportResult.buffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            // Add custom headers with export metadata
            res.setHeader('X-Export-Records', recordsResult.records.length);
            res.setHeader('X-Export-Range', `${startRecord}-${recordsResult.endRecord}`);
            res.setHeader('X-Total-Available', totalRecords);
            res.setHeader('X-Processing-Time', Date.now() - startTime);
            res.setHeader('X-Export-Source', 'check_table');

            // Log successful export
            const processingTime = Date.now() - startTime;
            console.log(`Check table export completed: ${recordsResult.records.length} records, ${exportResult.buffer.length} bytes, ${processingTime}ms`);

            // Send the Excel file
            res.status(200).send(exportResult.buffer);

        } catch (error) {
            console.error('Export endpoint error:', error);

            // Handle specific error types
            if (error.message.includes('timeout')) {
                return res.status(408).json({
                    success: false,
                    error: 'Export request timed out. Please try a smaller range.',
                    code: 'TIMEOUT'
                });
            }

            if (error.message.includes('memory') || error.message.includes('heap')) {
                return res.status(507).json({
                    success: false,
                    error: 'Export request too large. Please try a smaller range.',
                    code: 'INSUFFICIENT_STORAGE'
                });
            }

            if (error.message.includes('database') || error.message.includes('connection')) {
                return res.status(503).json({
                    success: false,
                    error: 'Database connection error. Please try again later.',
                    code: 'DATABASE_ERROR'
                });
            }

            // Generic server error
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred during export. Please try again.',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Handle full export (all records) from check_table
     */
    async exportAll(req, res) {
        try {
            console.log('Full export request received for check_table');

            // Check if check_table has any records
            const totalRecords = await CheckTable.getTotalRecordCount();

            if (totalRecords === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No records available for export from check table. Please upload and process some data first.',
                    code: 'NO_DATA'
                });
            }

            // Check if export is too large
            if (totalRecords > 50000) {
                return res.status(400).json({
                    success: false,
                    error: `Full export too large (${totalRecords} records). Please use range export instead.`,
                    code: 'EXPORT_TOO_LARGE',
                    suggestion: 'Use /export/:start/:end endpoint for large datasets'
                });
            }

            // Export all records (1 to totalRecords)
            return await this.exportByRangeInternal(req, res, 1, totalRecords);

        } catch (error) {
            console.error('Full export error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to export all records from check table',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Internal method for range export (used by both range and full export)
     */
    async exportByRangeInternal(req, res, startRecord, endRecord) {
        // This method can be used to avoid code duplication
        // For now, we'll redirect to the main exportByRange logic
        req.params = { start: startRecord.toString(), end: endRecord.toString() };
        return await this.exportByRange(req, res);
    }

    /**
     * Get export recommendations for a given range from check_table
     */
    async getExportRecommendations(req, res) {
        try {
            const { start, end } = req.params;

            const startRecord = parseInt(start);
            const endRecord = parseInt(end);

            if (isNaN(startRecord) || isNaN(endRecord)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid parameters',
                    code: 'INVALID_PARAMETERS'
                });
            }

            const totalRecords = await CheckTable.getTotalRecordCount();
            const tableStats = await CheckTable.getTableStats();

            // Generate recommendations based on check_table data
            const recommendations = {
                rangeValid: startRecord <= totalRecords && endRecord <= totalRecords,
                suggestedRange: {
                    start: Math.max(1, startRecord),
                    end: Math.min(endRecord, totalRecords)
                },
                dataQuality: {
                    totalRecords: totalRecords,
                    singaporePhones: tableStats.singapore_phones,
                    nonSingaporePhones: tableStats.non_singapore_phones,
                    recordsWithCompany: tableStats.records_with_company,
                    recordsWithEmail: tableStats.records_with_email
                },
                performance: {
                    estimatedSize: Math.ceil((endRecord - startRecord + 1) * 0.5), // KB estimate
                    recommendedBatchSize: totalRecords > 10000 ? 5000 : totalRecords
                }
            };

            res.status(200).json({
                success: true,
                data: {
                    startRecord,
                    endRecord,
                    totalRecords,
                    requestedCount: endRecord - startRecord + 1,
                    source: 'check_table',
                    recommendations
                }
            });

        } catch (error) {
            console.error('Failed to get export recommendations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get export recommendations',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Validate export parameters without performing export from check_table
     */
    async validateExportRange(req, res) {
        try {
            const { start, end } = req.params;

            const startRecord = parseInt(start);
            const endRecord = parseInt(end);

            // Use CheckTable validation
            const validation = await CheckTable.validateExportRange(startRecord, endRecord);

            if (validation.valid) {
                res.status(200).json({
                    success: true,
                    valid: true,
                    data: {
                        startRecord: validation.startRecord,
                        endRecord: validation.endRecord,
                        recordCount: validation.recordCount,
                        totalAvailable: validation.totalAvailable,
                        warning: validation.warning,
                        source: 'check_table'
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    valid: false,
                    error: validation.error,
                    code: 'VALIDATION_FAILED',
                    source: 'check_table'
                });
            }

        } catch (error) {
            console.error('Export validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to validate export range',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Get check_table records with pagination
     */
    async getCheckRecords(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            console.log(`Get check records request: page ${page}, limit ${limit}`);

            // Validate pagination parameters
            if (page < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Page number must be greater than 0',
                    code: 'INVALID_PAGE'
                });
            }

            if (limit < 1 || limit > 1000) {
                return res.status(400).json({
                    success: false,
                    error: 'Limit must be between 1 and 1000',
                    code: 'INVALID_LIMIT'
                });
            }

            // Get records from check_table
            const records = await CheckTable.findAll(limit, offset);
            const totalRecords = await CheckTable.getTotalRecordCount();
            const totalPages = Math.ceil(totalRecords / limit);

            res.status(200).json({
                success: true,
                data: {
                    records: records,
                    pagination: {
                        currentPage: page,
                        totalPages: totalPages,
                        totalRecords: totalRecords,
                        recordsPerPage: limit,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                }
            });

            console.log(`Returned ${records.length} check table records (page ${page}/${totalPages})`);

        } catch (error) {
            console.error('Failed to get check records:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve check table records',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Update company information in check_table record
     */
    async updateCheckRecord(req, res) {
        try {
            const { id } = req.params;
            const { companyName, physicalAddress, email, website } = req.body;

            console.log(`Update check record request for ID: ${id}`);

            // Validate ID parameter
            if (!id || id.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Record ID is required',
                    code: 'MISSING_ID'
                });
            }

            // Check if record exists
            const existingRecord = await CheckTable.findById(id);
            if (!existingRecord) {
                return res.status(404).json({
                    success: false,
                    error: `Record with ID ${id} not found`,
                    code: 'RECORD_NOT_FOUND'
                });
            }

            // Validate company information
            const companyData = {
                companyName: companyName ? companyName.trim() : null,
                physicalAddress: physicalAddress ? physicalAddress.trim() : null,
                email: email ? email.trim() : null,
                website: website ? website.trim() : null
            };

            const validation = CheckTable.validateCompanyInfo(companyData);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Company information validation failed',
                    code: 'VALIDATION_FAILED',
                    details: validation.errors
                });
            }

            // Check email uniqueness if email is provided
            if (companyData.email) {
                const emailExists = await CheckTable.emailExists(companyData.email, id);
                if (emailExists) {
                    return res.status(409).json({
                        success: false,
                        error: `Email address already exists: ${companyData.email}`,
                        code: 'EMAIL_ALREADY_EXISTS'
                    });
                }
            }

            // Update the record
            const checkRecord = new CheckTable(
                id,
                existingRecord.Phone,
                existingRecord.Status,
                companyData.companyName,
                companyData.physicalAddress,
                companyData.email,
                companyData.website
            );

            const updateResult = await checkRecord.updateCompanyInfo();

            if (!updateResult.success) {
                return res.status(500).json({
                    success: false,
                    error: updateResult.message || 'Failed to update record',
                    code: 'UPDATE_FAILED'
                });
            }

            // Get updated record to return
            const updatedRecord = await CheckTable.findById(id);

            res.status(200).json({
                success: true,
                message: 'Company information updated successfully',
                data: {
                    record: updatedRecord,
                    fieldsUpdated: {
                        companyName: companyData.companyName !== existingRecord.CompanyName,
                        physicalAddress: companyData.physicalAddress !== existingRecord.PhysicalAddress,
                        email: companyData.email !== existingRecord.Email,
                        website: companyData.website !== existingRecord.Website
                    }
                }
            });

            console.log(`Successfully updated company info for record ${id}`);

        } catch (error) {
            console.error('Failed to update check record:', error);

            // Handle specific error types
            if (error.message.includes('Email address already exists')) {
                return res.status(409).json({
                    success: false,
                    error: error.message,
                    code: 'EMAIL_ALREADY_EXISTS'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to update check table record',
                code: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Get export format information for check_table
     */
    getExportInfo(req, res) {
        try {
            res.status(200).json({
                success: true,
                data: {
                    supportedFormats: ['xlsx'],
                    maxRecordsPerExport: 50000,
                    maxFileSizeMB: 50,
                    source: 'check_table',
                    columns: [
                        { name: 'Id', description: 'Record identifier from backup table' },
                        { name: 'Phone', description: 'Phone number' },
                        { name: 'Status', description: 'Singapore phone validation status (true/false)' },
                        { name: 'CompanyName', description: 'Company name (editable)' },
                        { name: 'PhysicalAddress', description: 'Physical address (editable)' },
                        { name: 'Email', description: 'Email address (editable, unique)' },
                        { name: 'Website', description: 'Website URL (editable)' },
                        { name: 'created_at', description: 'Record creation timestamp' },
                        { name: 'updated_at', description: 'Record last update timestamp' }
                    ],
                    endpoints: {
                        exportByRange: '/export/:start/:end',
                        exportAll: '/export/all',
                        validateRange: '/export/validate/:start/:end',
                        recommendations: '/export/recommendations/:start/:end',
                        getCheckRecords: '/check',
                        updateCheckRecord: '/check/:id'
                    },
                    notes: [
                        'Exports are now sourced from check_table which contains validated phone data',
                        'Status field indicates if phone number is a valid Singapore number',
                        'Company information fields may be null if not yet populated',
                        'Email field has unique constraint across all records',
                        'Only company information fields can be updated (CompanyName, PhysicalAddress, Email, Website)',
                        'Id, Phone, and Status fields are read-only'
                    ]
                }
            });
        } catch (error) {
            console.error('Failed to get export info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get export information',
                code: 'SERVER_ERROR'
            });
        }
    }
}

module.exports = ExportController;
