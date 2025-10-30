# Design Document

## Overview

The Excel Phone Import system (Version 2) is a streamlined Singapore Phone Detect application focused exclusively on processing Excel files containing phone data. This version removes PDF processing capabilities to create a simpler, more focused system. It maintains the dual-table architecture and uses Node.js with the xlsx library for Excel parsing, Express.js API, MySQL database, and Singapore phone validation services. The design emphasizes simplicity, performance, and security for Excel-only processing.

## Architecture

The Excel-only system architecture focuses on streamlined Excel processing:

```
┌─────────────────────────────────────┐
│           Web Interface             │
│      (Excel Upload Interface)       │
├─────────────────────────────────────┤
│           Express.js API            │
│       (Excel Upload Endpoints)      │
├─────────────────────────────────────┤
│          Service Layer              │
│  ┌─────────┬─────────┬─────────────┐│
│  │  Excel  │Singapore│   Excel     ││
│  │Processor│Phone    │  Exporter   ││
│  │         │Validator│             ││
│  │         │         │             ││
│  └─────────┴─────────┴─────────────┘│
├─────────────────────────────────────┤
│        File Management              │
│  ┌─────────────┬─────────────────┐  │
│  │ Upload      │ Original File   │  │
│  │ Directory   │ Storage         │  │
│  │ Manager     │ (Excel Only)    │  │
│  │             │                 │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│        Database Manager             │
│  ┌─────────────┬─────────────────┐  │
│  │ Backup      │ Check           │  │
│  │ Table       │ Table           │  │
│  │             │                 │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│           Data Layer                │
│         (MySQL Database)            │
│                                     │
└─────────────────────────────────────┘
```

## Components and Interfaces

### Excel Processor Component (NEW)
- **Purpose**: Extract structured data from Excel files with support for multiple worksheets and flexible column layouts
- **Dependencies**: xlsx library for Excel parsing, shared database manager, file manager
- **Key Methods**:
  - `extractData(excelBuffer)`: Parses Excel files with multiple worksheets and mixed data types
  - `detectWorksheets(workbook)`: Identifies worksheets containing phone data
  - `parseWorksheet(worksheet)`: Extracts data from individual worksheets
  - `mapColumns(worksheetData)`: Intelligently maps Excel columns to expected data fields
  - `extractPhoneNumbers(cellData)`: Identifies and extracts phone numbers from Excel cells
  - `extractMetadata(rowData, phonePosition)`: Captures company information from adjacent columns
  - `validateExcelData(extractedData)`: Validates data integrity before storage
  - `handleMultiplePhones(rowData)`: Creates separate records for multiple phone numbers in one row
  - `generateExtractionReport(processingResults)`: Creates detailed processing reports
  - `storeToBackupTable(records)`: Stores extracted data with metadata in shared backup_table

### Worksheet Detector Component (NEW)
- **Purpose**: Identify worksheets containing phone data in multi-sheet Excel files
- **Dependencies**: xlsx library, pattern matching utilities
- **Key Methods**:
  - `scanWorksheets(workbook)`: Analyzes all worksheets for phone data patterns
  - `scoreWorksheet(worksheet)`: Assigns confidence scores to worksheets based on phone data likelihood
  - `identifyPhoneColumns(worksheet)`: Locates phone number columns within worksheets
  - `validateWorksheetStructure(worksheet)`: Ensures worksheet has processable data structure
  - `prioritizeWorksheets(worksheetScores)`: Orders worksheets by processing priority

### Column Mapper Component (NEW)
- **Purpose**: Intelligently map Excel columns to expected data fields regardless of header names or positions
- **Dependencies**: Pattern matching utilities, data validation services
- **Key Methods**:
  - `analyzeHeaders(headerRow)`: Identifies column purposes from header names
  - `detectPhoneColumns(worksheetData)`: Uses pattern matching to find phone columns
  - `mapCompanyFields(headerRow)`: Maps company information columns (name, address, email, website)
  - `handleVariableColumns(worksheetData)`: Adapts to different column arrangements
  - `validateColumnMapping(mappingResult)`: Ensures mapping quality and completeness
  - `generateMappingReport(mappingResults)`: Creates detailed column mapping reports

### Data Validator Component (NEW)
- **Purpose**: Validate Excel data integrity and format before processing
- **Dependencies**: Phone validation utilities, data cleaning services
- **Key Methods**:
  - `validateRowData(rowData)`: Checks individual row data quality
  - `cleanPhoneNumbers(phoneData)`: Removes formatting and validates phone number structure
  - `handleMergedCells(cellData)`: Processes merged cell content appropriately
  - `detectDuplicates(extractedData)`: Identifies and handles duplicate phone numbers
  - `validateRequiredFields(rowData)`: Ensures required data exists for backup table storage
  - `generateValidationReport(validationResults)`: Creates data quality reports

### File Manager Component
- **Purpose**: Handle original Excel file storage exclusively
- **Dependencies**: fs (file system), path utilities
- **Key Methods**:
  - `saveOriginalExcel(fileBuffer, originalName)`: Saves Excel files with timestamped unique filenames
  - `validateExcelIntegrity(fileBuffer)`: Verifies Excel file integrity before processing
  - `getExcelMetadata(filename)`: Retrieves Excel file information and processing status
  - `listExcelFiles()`: Returns list of all saved Excel files
  - `archiveExcelFiles(retentionDays)`: Manages Excel file storage and archival

### Web Application Component
- **Purpose**: Provide HTTP endpoints for Excel file uploads exclusively
- **Dependencies**: Express.js, multer for file uploads
- **Key Endpoints**:
  - `POST /upload`: Handle Excel file uploads with validation and processing
  - `GET /files`: List Excel files with processing status
  - `GET /files/:filename`: Download Excel files
  - `GET /processing-status/:fileId`: Track Excel processing progress
  - `GET /extraction-report/:fileId`: Retrieve detailed Excel extraction reports

## Data Models

### Extended Backup Table Schema (SHARED)
The existing backup_table schema supports Excel data without modifications:
```sql
CREATE TABLE backup_table (
    Id VARCHAR(100) NOT NULL PRIMARY KEY,
    Phone VARCHAR(50) NOT NULL,
    source_file VARCHAR(255) NULL,
    extracted_metadata TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### File Metadata Schema
The uploaded_files table supports Excel files exclusively:
```sql
CREATE TABLE uploaded_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    file_type ENUM('excel') NOT NULL DEFAULT 'excel',
    file_size BIGINT NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
    records_extracted INT DEFAULT 0,
    worksheets_processed INT DEFAULT 0,
    extraction_report TEXT NULL,
    INDEX idx_upload_timestamp (upload_timestamp),
    INDEX idx_processing_status (processing_status)
);
```

### Excel Processing Metadata
Excel-specific metadata stored in the extracted_metadata field:
```json
{
  "file_type": "excel",
  "worksheets_processed": ["Sheet1", "Data", "Contacts"],
  "column_mapping": {
    "phone_columns": ["B", "D"],
    "id_column": "A",
    "company_columns": {"name": "C", "email": "E"}
  },
  "processing_stats": {
    "total_rows": 150,
    "valid_rows": 145,
    "phone_numbers_found": 148,
    "duplicates_removed": 3
  }
}
```

## Data Flow and Integration

### Excel Processing Workflow
1. **File Upload**: User uploads Excel file through extended web interface
2. **File Storage**: Original Excel file saved with unique filename in uploads directory
3. **Excel Parsing**: xlsx library extracts workbook data and identifies worksheets
4. **Worksheet Detection**: System identifies worksheets containing phone data
5. **Column Mapping**: Intelligent mapping of Excel columns to data fields
6. **Data Validation**: Validation and cleaning of extracted data
7. **Backup Storage**: Processed data stored in shared backup_table with Excel metadata
8. **Phone Validation**: Shared Singapore phone validator processes backup_table records
9. **Check Table Population**: Validated data stored in shared check_table
10. **User Feedback**: Processing results and extraction reports displayed to user

### System Integration Points
- **Database Tables**: Uses backup_table and check_table for data storage
- **Phone Validation**: Uses Singapore phone validator service
- **File Management**: Dedicated Excel file storage and management
- **Web Interface**: Excel-focused upload and management interfaces
- **Export Functionality**: Excel data export capabilities

## Error Handling

### Excel Processing Errors
- **Invalid file format**: Validate Excel file integrity and provide format guidance
- **Corrupted Excel files**: Graceful handling with recovery suggestions and file preservation
- **Unsupported Excel features**: Handle complex formatting, formulas, and macros appropriately
- **Multiple worksheet conflicts**: Provide clear feedback when worksheet detection is ambiguous
- **Column mapping failures**: Offer manual column mapping options when automatic detection fails
- **Large file processing**: Implement streaming and progress feedback for large Excel files

### Data Validation Errors
- **Invalid phone formats**: Log validation failures and continue processing valid data
- **Missing required data**: Skip incomplete rows with detailed error reporting
- **Duplicate detection**: Handle duplicates according to user preferences
- **Merged cell issues**: Extract data appropriately or flag for manual review

### System Errors
- **Database consistency**: Ensure Excel data maintains proper integrity
- **File storage management**: Handle filename collisions and storage limits
- **Processing queue management**: Manage Excel processing loads efficiently

## Testing Strategy

### Unit Testing
- **Excel parsing logic**: Test with various Excel file formats and structures
- **Worksheet detection**: Validate detection accuracy with multi-sheet files
- **Column mapping**: Test mapping flexibility with different header variations
- **Data validation**: Test cleaning and validation with various data quality issues
- **Integration points**: Test shared component interactions

### Integration Testing
- **End-to-end workflow**: Excel upload → backup_table → validation → check_table
- **Excel-only processing**: Test system with various Excel file formats
- **Database consistency**: Verify data integrity across tables
- **User interface**: Test Excel-focused user experience

### Performance Testing
- **Large Excel files**: Test processing performance with files containing thousands of rows
- **Multiple worksheets**: Validate performance with complex multi-sheet files
- **Concurrent processing**: Test system behavior with simultaneous Excel uploads
- **Memory usage**: Monitor memory consumption during Excel processing

## Security Considerations

### File Upload Security
- **File type validation**: Strict validation to accept only legitimate Excel files
- **File size limits**: Same limits as PDF files to prevent resource exhaustion
- **Content scanning**: Validate Excel file structure and detect malicious content
- **Macro handling**: Disable macro execution and warn users about macro-enabled files

### Data Security
- **Same security standards**: Apply identical security measures as PDF processing
- **Data sanitization**: Clean and validate all extracted data before storage
- **Access controls**: Same user permissions and access controls as existing system

## Performance Optimization

### Excel Processing Optimization
- **Streaming processing**: Handle large Excel files without loading entire file into memory
- **Worksheet prioritization**: Process most likely worksheets first for faster feedback
- **Batch processing**: Group database operations for better performance
- **Caching**: Cache column mapping results for similar file structures

### Resource Management
- **Memory management**: Efficient handling of Excel file parsing and data extraction
- **Processing queues**: Dedicated queues for Excel processing
- **Cleanup procedures**: Automatic cleanup of temporary files and processing artifacts

## Deployment Configuration

### Environment Variables (EXTENDED)
```
# Existing variables remain the same
DB_HOST=localhost
DB_PORT=3306
DB_NAME=singapore_phone_db
DB_USER=app_user
DB_PASSWORD=secure_password
PORT=3000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
SINGAPORE_COUNTRY_CODE=SG
BATCH_VALIDATION_SIZE=1000

# New Excel-specific variables
EXCEL_MAX_WORKSHEETS=10
EXCEL_MAX_ROWS_PER_SHEET=10000
EXCEL_PROCESSING_TIMEOUT=300000
ENABLE_EXCEL_MACROS=false
```

### Directory Structure (EXTENDED)
```
singapore-phone-detect/
├── src/
│   ├── controllers/
│   │   ├── uploadController.js (EXTENDED)
│   │   ├── fileController.js (EXTENDED)
│   │   └── exportController.js (EXISTING)
│   ├── services/
│   │   ├── excelProcessor.js (NEW)
│   │   ├── worksheetDetector.js (NEW)
│   │   ├── columnMapper.js (NEW)
│   │   ├── dataValidator.js (NEW)
│   │   ├── enhancedPdfProcessor.js (EXISTING)
│   │   ├── fileManager.js (EXTENDED)
│   │   ├── singaporePhoneValidator.js (SHARED)
│   │   └── excelExporter.js (EXISTING)
│   ├── models/
│   │   ├── BackupTable.js (SHARED)
│   │   ├── CheckTable.js (SHARED)
│   │   └── UploadedFile.js (EXTENDED)
│   └── utils/
├── public/
│   ├── css/
│   ├── js/ (EXTENDED for Excel support)
│   ├── index.html (EXTENDED)
│   ├── check-records.html (EXISTING)
│   └── file-manager.html (EXTENDED)
├── uploads/
│   ├── excel/
│   └── temp/
├── exports/ (EXISTING)
└── config/
```

## Migration and Compatibility

### Database Migration
- **Schema updates**: Add file_type and Excel-specific columns to uploaded_files table
- **Data migration**: No migration needed for existing backup_table and check_table data
- **Index optimization**: Add indexes for new file_type column

### Version 2 Changes
- **PDF functionality removed**: System now focuses exclusively on Excel processing
- **Simplified API**: Streamlined endpoints for Excel-only operations
- **Focused user interface**: Excel-specific upload and processing workflows
- **Clean architecture**: Simplified system without PDF processing complexity