const PhoneRecord = require('../models/PhoneRecord');
const CheckTable = require('../models/CheckTable');
const databaseManager = require('../utils/database');

class StatsController {
  constructor() {
    // Initialize any required services
  }

  /**
   * Get database statistics for dual-table architecture
   */
  async getStats(req, res) {
    try {
      console.log('Dual-table stats request received');

      // Get statistics from both tables
      const tableStats = await databaseManager.getTableStats();
      const fileStats = await databaseManager.getFileStats();
      
      // Simplified checkTableStats for now
      const checkTableStats = {
        records_with_company: 0,
        records_with_email: 0,
        first_record: null,
        last_record: null
      };

      // Calculate additional statistics
      const stats = {
        backupTable: {
          totalRecords: tableStats.backupTable,
          status: 'immutable',
          description: 'Raw PDF upload data storage'
        },
        checkTable: {
          totalRecords: tableStats.checkTable,
          singaporePhones: tableStats.validatedPhones,
          nonSingaporePhones: tableStats.invalidPhones,
          recordsWithCompany: checkTableStats.records_with_company,
          recordsWithEmail: checkTableStats.records_with_email,
          firstRecord: checkTableStats.first_record,
          lastRecord: checkTableStats.last_record,
          status: 'editable',
          description: 'Validated phone data with company information'
        },
        processing: {
          pendingValidation: Math.max(0, tableStats.backupTable - tableStats.checkTable),
          validationComplete: tableStats.backupTable === tableStats.checkTable,
          validationRate: tableStats.backupTable > 0 ? 
            Math.round((tableStats.checkTable / tableStats.backupTable) * 100) : 0
        },
        validation: {
          totalValidated: tableStats.checkTable,
          singaporePhones: tableStats.validatedPhones,
          nonSingaporePhones: tableStats.invalidPhones,
          singaporePercentage: tableStats.checkTable > 0 ? 
            Math.round((tableStats.validatedPhones / tableStats.checkTable) * 100) : 0
        },
        fileManagement: {
          totalFiles: fileStats.totalFiles,
          processedFiles: fileStats.processedFiles,
          pendingFiles: fileStats.pendingFiles,
          failedFiles: fileStats.failedFiles,
          totalStorageSize: fileStats.totalSize,
          totalRecordsExtracted: fileStats.totalRecordsExtracted,
          averageRecordsPerFile: fileStats.processedFiles > 0 ? 
            Math.round(fileStats.totalRecordsExtracted / fileStats.processedFiles) : 0,
          processingSuccessRate: fileStats.totalFiles > 0 ? 
            Math.round((fileStats.processedFiles / fileStats.totalFiles) * 100) : 0,
          fileTypeBreakdown: {
            pdfFiles: fileStats.pdfFiles || 0,
            excelFiles: fileStats.excelFiles || 0
          }
        },
        databaseStatus: 'healthy',
        lastUpdated: new Date().toISOString()
      };

      // Add time-based statistics if we have check table records
      if (tableStats.checkTable > 0 && checkTableStats.first_record && checkTableStats.last_record) {
        const firstDate = new Date(checkTableStats.first_record);
        const lastDate = new Date(checkTableStats.last_record);
        const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        
        stats.checkTable.dataSpan = {
          days: daysDiff,
          firstRecordDate: firstDate.toISOString(),
          lastRecordDate: lastDate.toISOString()
        };

        // Calculate average records per day (if span > 0)
        if (daysDiff > 0) {
          stats.checkTable.averageRecordsPerDay = Math.round(tableStats.checkTable / daysDiff);
        }
      }

      res.status(200).json({
        success: true,
        data: stats
      });

      console.log(`Dual-table stats response: backup=${tableStats.backupTable}, check=${tableStats.checkTable}, validated=${tableStats.validatedPhones}`);

    } catch (error) {
      console.error('Failed to get dual-table statistics:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve database statistics',
        code: 'STATS_ERROR'
      });
    }
  }

  /**
   * Get detailed database health information for dual-table architecture
   */
  async getHealthCheck(req, res) {
    try {
      console.log('Dual-table health check request received');

      const healthData = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
      };

      // Check database connection and both tables
      try {
        const tableStats = await databaseManager.getTableStats();
        healthData.checks.database = {
          status: 'healthy',
          backupTableRecords: tableStats.backupTable,
          checkTableRecords: tableStats.checkTable,
          message: 'Database connection successful'
        };
      } catch (dbError) {
        healthData.status = 'unhealthy';
        healthData.checks.database = {
          status: 'unhealthy',
          error: dbError.message,
          message: 'Database connection failed'
        };
      }

      // Check backup table schema
      try {
        // Check if backup_table exists and is accessible
        const backupRecords = await databaseManager.getBackupRecords(1, 0);
        healthData.checks.backupTable = {
          status: 'healthy',
          accessible: true,
          message: 'Backup table is accessible and functional'
        };
      } catch (backupError) {
        healthData.status = 'degraded';
        healthData.checks.backupTable = {
          status: 'warning',
          error: backupError.message,
          message: 'Backup table access issues detected'
        };
      }

      // Check check table schema
      try {
        const checkStats = await CheckTable.getTableStats();
        healthData.checks.checkTable = {
          status: 'healthy',
          accessible: true,
          validatedRecords: checkStats.total_records,
          message: 'Check table is accessible and functional'
        };
      } catch (checkError) {
        healthData.status = 'degraded';
        healthData.checks.checkTable = {
          status: 'warning',
          error: checkError.message,
          message: 'Check table access issues detected'
        };
      }

      // Check file system (uploads directory)
      try {
        const fs = require('fs').promises;
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        await fs.access(uploadDir);
        healthData.checks.filesystem = {
          status: 'healthy',
          uploadDir: uploadDir,
          message: 'Upload directory accessible'
        };
      } catch (fsError) {
        healthData.status = 'degraded';
        healthData.checks.filesystem = {
          status: 'warning',
          error: fsError.message,
          message: 'Upload directory not accessible'
        };
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      };

      healthData.checks.memory = {
        status: memoryUsageMB.heapUsed < 500 ? 'healthy' : 'warning',
        usage: memoryUsageMB,
        message: `Memory usage: ${memoryUsageMB.heapUsed}MB heap used`
      };

      // Set appropriate HTTP status based on overall health
      let httpStatus = 200;
      if (healthData.status === 'degraded') {
        httpStatus = 200; // Still operational but with warnings
      } else if (healthData.status === 'unhealthy') {
        httpStatus = 503; // Service unavailable
      }

      res.status(httpStatus).json({
        success: healthData.status !== 'unhealthy',
        data: healthData
      });

      console.log(`Dual-table health check completed: ${healthData.status}`);

    } catch (error) {
      console.error('Health check failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        code: 'HEALTH_CHECK_ERROR',
        data: {
          timestamp: new Date().toISOString(),
          status: 'unhealthy',
          error: error.message
        }
      });
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(req, res) {
    try {
      const systemInfo = {
        application: {
          name: 'Singapore Phone Detect',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: Math.floor(process.uptime()),
          startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
        },
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          pid: process.pid
        },
        memory: {
          usage: process.memoryUsage(),
          usageMB: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
          }
        },
        configuration: {
          maxFileSize: process.env.MAX_FILE_SIZE || '10485760',
          uploadDir: process.env.UPLOAD_DIR || './uploads',
          dbHost: process.env.DB_HOST || 'localhost',
          dbName: process.env.DB_NAME || 'singapore_phone_db'
        }
      };

      res.status(200).json({
        success: true,
        data: systemInfo
      });

    } catch (error) {
      console.error('Failed to get system info:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system information',
        code: 'SYSTEM_INFO_ERROR'
      });
    }
  }

  /**
   * Get API endpoints information for dual-table architecture
   */
  getApiInfo(req, res) {
    try {
      const apiInfo = {
        version: '2.0.0',
        architecture: 'dual-table',
        description: 'Singapore Phone Detection API with backup and check table architecture',
        endpoints: {
          upload: {
            method: 'POST',
            path: '/upload',
            description: 'Upload PDF or Excel file for processing and storage in backup table',
            contentType: 'multipart/form-data',
            parameters: {
              file: 'PDF or Excel file (required, max 10MB, .pdf/.xlsx/.xls)'
            },
            workflow: 'PDF/Excel → backup_table → validation → check_table'
          },
          export: {
            method: 'GET',
            path: '/export/:start/:end',
            description: 'Export records by range from check table to Excel',
            parameters: {
              start: 'Start record number (integer, >= 1)',
              end: 'End record number (integer, >= start)'
            },
            source: 'check_table'
          },
          exportAll: {
            method: 'GET',
            path: '/export/all',
            description: 'Export all records from check table to Excel (max 50,000 records)',
            source: 'check_table'
          },
          checkRecords: {
            method: 'GET',
            path: '/check',
            description: 'Get check table records with pagination',
            parameters: {
              page: 'Page number (optional, default: 1)',
              limit: 'Records per page (optional, default: 50, max: 1000)'
            }
          },
          updateCheckRecord: {
            method: 'PUT',
            path: '/check/:id',
            description: 'Update company information in check table record',
            parameters: {
              id: 'Record ID (required)',
              companyName: 'Company name (optional)',
              physicalAddress: 'Physical address (optional)',
              email: 'Email address (optional, must be unique)',
              website: 'Website URL (optional)'
            },
            restrictions: 'Cannot update Id, Phone, or Status fields'
          },
          stats: {
            method: 'GET',
            path: '/stats',
            description: 'Get dual-table database statistics'
          },
          health: {
            method: 'GET',
            path: '/health',
            description: 'Get system health status for dual-table architecture'
          },
          systemInfo: {
            method: 'GET',
            path: '/system',
            description: 'Get system information'
          },
          apiInfo: {
            method: 'GET',
            path: '/api',
            description: 'Get API documentation'
          },
          listFiles: {
            method: 'GET',
            path: '/files',
            description: 'List uploaded PDF files with metadata and processing status',
            parameters: {
              limit: 'Number of files per page (optional, default: 50)',
              offset: 'Number of files to skip (optional, default: 0)',
              status: 'Filter by processing status (optional: pending, processed, failed, archived)',
              sortBy: 'Sort field (optional: upload_timestamp, file_size, original_filename)',
              sortOrder: 'Sort order (optional: asc, desc, default: desc)'
            }
          },
          downloadFile: {
            method: 'GET',
            path: '/files/:filename',
            description: 'Download original PDF file',
            parameters: {
              filename: 'Stored filename (required)'
            },
            response: 'PDF file download'
          },
          deleteFile: {
            method: 'DELETE',
            path: '/files/:filename',
            description: 'Archive or permanently delete uploaded PDF or Excel file (admin only)',
            parameters: {
              filename: 'Stored filename (required)',
              permanent: 'Permanent deletion flag (optional: true/false, default: false)'
            },
            note: 'Default behavior is archiving. Use permanent=true for permanent deletion.'
          },
          processingStatus: {
            method: 'GET',
            path: '/processing-status/:fileId',
            description: 'Get processing status for a specific file (PDF or Excel)',
            parameters: {
              fileId: 'File ID/filename (required)'
            }
          },
          extractionReport: {
            method: 'GET',
            path: '/extraction-report/:fileId',
            description: 'Get detailed extraction report for a specific file',
            parameters: {
              fileId: 'File ID/filename (required)'
            }
          },
          worksheetInfo: {
            method: 'GET',
            path: '/worksheet-info/:fileId',
            description: 'Get worksheet information for Excel files',
            parameters: {
              fileId: 'Excel file ID/filename (required)'
            }
          },
          columnMapping: {
            method: 'GET',
            path: '/column-mapping/:fileId',
            description: 'Get column mapping results for Excel files',
            parameters: {
              fileId: 'Excel file ID/filename (required)'
            }
          }
        },
        tables: {
          backup_table: {
            description: 'Immutable storage for raw PDF upload data',
            fields: ['Id', 'Phone', 'created_at'],
            constraints: 'No updates or deletes allowed after insertion'
          },
          check_table: {
            description: 'Validated phone data with company information',
            fields: ['Id', 'Phone', 'Status', 'CompanyName', 'PhysicalAddress', 'Email', 'Website', 'created_at', 'updated_at'],
            constraints: 'Email must be unique, Id/Phone/Status are read-only after creation'
          }
        },
        limits: {
          maxFileSize: '10MB',
          maxExportRecords: 50000,
          supportedFileTypes: ['PDF', 'Excel (.xlsx, .xls)'],
          exportFormats: ['XLSX'],
          maxRecordsPerPage: 1000
        },
        errorCodes: {
          'NO_FILE': 'No file uploaded',
          'INVALID_FILE_TYPE': 'Invalid file type (only PDF and Excel allowed)',
          'FILE_TOO_LARGE': 'File exceeds size limit',
          'PDF_PROCESSING_ERROR': 'Error processing PDF content',
          'EXCEL_PROCESSING_ERROR': 'Error processing Excel content',
          'BACKUP_STORAGE_ERROR': 'Failed to store in backup table',
          'DATABASE_ERROR': 'Database operation failed',
          'VALIDATION_FAILED': 'Data validation failed',
          'EXPORT_FAILED': 'Excel export failed',
          'NO_DATA': 'No data available',
          'INVALID_RANGE': 'Invalid export range',
          'RECORD_NOT_FOUND': 'Record not found in check table',
          'EMAIL_ALREADY_EXISTS': 'Email address already exists',
          'UPDATE_FAILED': 'Failed to update check table record',
          'SERVER_ERROR': 'Internal server error'
        }
      };

      res.status(200).json({
        success: true,
        data: apiInfo
      });

    } catch (error) {
      console.error('Failed to get API info:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve API information',
        code: 'API_INFO_ERROR'
      });
    }
  }

  /**
   * Reset database (development/testing only)
   */
  async resetDatabase(req, res) {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Database reset not allowed in production',
          code: 'FORBIDDEN'
        });
      }

      console.log('Database reset requested');

      // This would require implementing a reset method in PhoneRecord
      // For now, we'll return a not implemented response
      res.status(501).json({
        success: false,
        error: 'Database reset functionality not implemented',
        code: 'NOT_IMPLEMENTED'
      });

    } catch (error) {
      console.error('Database reset failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Database reset failed',
        code: 'RESET_ERROR'
      });
    }
  }
}

module.exports = StatsController;