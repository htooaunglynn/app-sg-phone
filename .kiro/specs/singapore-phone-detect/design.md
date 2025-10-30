# Design Document

## Overview

The Singapore Phone Detect system is built as a Node.js web application using Express.js framework with MySQL database backend. The system implements a two-table architecture where raw PDF data is stored immutably in a backup table, then processed through Singapore phone validation to populate a check table with validation status and company information. The application features advanced PDF parsing capabilities to handle complex table structures and automatically saves original PDF files for reference. The system uses pure JavaScript for the frontend and follows a modular service-oriented architecture with enhanced file management.

## Architecture

The system follows a layered architecture with dual-table data flow:

```
┌─────────────────────────────────────┐
│           Web Interface             │
│        (HTML + Pure JS)             │
├─────────────────────────────────────┤
│           Express.js API            │
│         (Route Handlers)            │
├─────────────────────────────────────┤
│          Service Layer              │
│  ┌─────────┬─────────┬─────────────┐│
│  │Enhanced │Singapore│   Excel     ││
│  │   PDF   │Phone    │  Exporter   ││
│  │Processor│Validator│             ││
│  └─────────┴─────────┴─────────────┘│
├─────────────────────────────────────┤
│        File Management              │
│  ┌─────────────┬─────────────────┐  │
│  │ Upload      │ Original PDF    │  │
│  │ Directory   │ File Storage    │  │
│  │ Manager     │ (Permanent)     │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│        Database Manager             │
│  ┌─────────────┬─────────────────┐  │
│  │ Backup      │ Check           │  │
│  │ Table       │ Table           │  │
│  │ (Immutable) │ (Editable)      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│           Data Layer                │
│         (MySQL Database)            │
└─────────────────────────────────────┘
```

## Components and Interfaces

### Enhanced PDF Processor Component
- **Purpose**: Extract structured data from complex PDF files with advanced parsing capabilities
- **Dependencies**: pdf-parse library for PDF text extraction, advanced regex patterns for phone detection
- **Key Methods**:
  - `extractData(pdfBuffer)`: Parses complex PDFs with multi-column tables and mixed data types
  - `parseComplexTable(textContent)`: Intelligently identifies table structures regardless of formatting
  - `detectPhoneColumns(textContent)`: Uses pattern matching to find phone numbers in any column position
  - `extractMetadata(textContent, phonePosition)`: Captures company information from adjacent columns
  - `handleMultiPagePDFs(textContent)`: Processes PDFs spanning multiple pages
  - `generateUniqueIds(recordCount)`: Creates sequential IDs when no ID column exists
  - `validatePhoneFormats(phoneNumber)`: Supports both 8-digit and international Singapore phone formats
  - `storeToBackupTable(records)`: Stores extracted data with metadata in immutable backup_table

### File Manager Component
- **Purpose**: Handle original PDF file storage and management
- **Dependencies**: fs (file system), path utilities
- **Key Methods**:
  - `saveOriginalPDF(fileBuffer, originalName)`: Saves PDF with timestamped unique filename
  - `createUploadDirectory()`: Ensures upload directory exists with proper permissions
  - `generateUniqueFilename(originalName)`: Creates timestamp-based unique filenames
  - `validatePDFIntegrity(fileBuffer)`: Verifies PDF file integrity before saving
  - `listUploadedFiles()`: Returns list of all saved PDF files
  - `getFileMetadata(filename)`: Retrieves file information and upload timestamp
  - `cleanupTempFiles()`: Removes temporary files after processing
  - `archiveOldFiles(retentionDays)`: Manages storage space by archiving old files

### Singapore Phone Validator Component
- **Purpose**: Validate phone numbers to determine if they are Singapore numbers using libphonenumber-js
- **Dependencies**: libphonenumber-js package for international phone number validation
- **Key Methods**:
  - `validateSingaporePhone(phoneNumber)`: Returns true/false using libphonenumber-js for Singapore validation
  - `processBackupRecords()`: Processes all backup_table records for validation
  - `parsePhoneNumber(phoneNumber)`: Uses libphonenumber-js to parse and validate phone format
  - `batchValidatePhones(phoneNumbers)`: Validates multiple phone numbers efficiently using libphonenumber-js

### Database Manager Component
- **Purpose**: Handle all MySQL database operations for both tables
- **Dependencies**: mysql2 library for database connectivity
- **Key Methods**:
  - `createConnection()`: Establishes MySQL connection with error handling
  - `createTables()`: Sets up both backup_table and check_table schemas
  - `insertBackupRecord(id, phone)`: Stores records in immutable backup_table
  - `insertCheckRecord(id, phone, status)`: Stores validated records in check_table
  - `updateCheckRecord(id, companyData)`: Updates company information in check_table
  - `getCheckRecordsByRange(start, end)`: Retrieves check_table records for export
  - `getTableStats()`: Returns statistics for both tables

### Excel Exporter Component
- **Purpose**: Generate Excel files from check_table records
- **Dependencies**: xlsx library for Excel file generation
- **Key Methods**:
  - `generateExcel(checkRecords)`: Creates Excel workbook from check_table data
  - `formatHeaders()`: Sets up headers for all check_table columns
  - `validateRange(start, end, totalRecords)`: Ensures export range is valid
  - `includeAllFields(record)`: Formats record with all check_table fields

### Web Application Component
- **Purpose**: Provide HTTP endpoints and serve web interface including Check Table Records page
- **Dependencies**: Express.js, multer for file uploads, enhanced file management
- **Key Endpoints**:
  - `POST /upload`: Handle complex PDF file uploads, save originals, and trigger validation process
  - `GET /export/:start/:end`: Generate and download Excel files from check_table
  - `PUT /check/:id`: Update company information in check_table
  - `GET /stats`: Return statistics for both backup_table and check_table
  - `GET /check`: List check_table records with pagination and search functionality
  - `GET /check-records`: Serve dedicated Check Table Records interface page
  - `GET /files`: List uploaded PDF files with metadata
  - `GET /files/:filename`: Download original PDF files
  - `DELETE /files/:filename`: Archive or remove old PDF files (admin only)
  - `GET /`: Serve main application interface

### Check Table Records Interface Component
- **Purpose**: Provide dedicated interface for viewing and managing check_table records
- **Dependencies**: Pure JavaScript for client-side functionality
- **Key Features**:
  - `renderCheckTableRecords()`: Display records in table format with proper headers
  - `implementSearch()`: Filter records across all fields using search box
  - `applyStatusStyling()`: Apply red background/font for status false records
  - `enableRecordEditing()`: Allow editing of company fields while protecting Id and Phone
  - `handleEditActions()`: Manage edit button functionality and form submissions

## Data Models

### Backup Table Schema (Immutable)
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
```sql
CREATE TABLE uploaded_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
    records_extracted INT DEFAULT 0,
    INDEX idx_upload_timestamp (upload_timestamp),
    INDEX idx_processing_status (processing_status)
);
```

### Check Table Schema (Editable)
```sql
CREATE TABLE check_table (
    Id VARCHAR(100) NOT NULL PRIMARY KEY,
    Phone VARCHAR(50) NOT NULL,
    Status BOOLEAN NULL,
    CompanyName VARCHAR(255) NULL,
    PhysicalAddress TEXT NULL,
    Email VARCHAR(255) NULL UNIQUE,
    Website VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (Status),
    INDEX idx_email (Email)
);
```

### Data Flow and Validation Rules
- **File Storage**: Original PDFs saved with unique timestamped filenames before processing
- **Backup Table**: Immutable after insertion, stores extracted data with source file reference and metadata
- **Check Table**: Populated from backup_table after phone validation
- **Singapore Phone Validation**: Determines Status field (true for Singapore numbers, false otherwise)
- **Company Fields**: Initially null, populated from extracted metadata or updated through web interface
- **Email Uniqueness**: Email field must be unique across all check_table records
- **Data Integrity**: Id field links backup_table and check_table records, source_file links to uploaded_files
- **File Metadata**: Tracks processing status and extraction results for each uploaded PDF

## Error Handling

### PDF Processing Errors
- Invalid file format: Return HTTP 400 with descriptive message, preserve original file
- Corrupted PDF: Log error details, return user-friendly error, mark file as failed
- Complex table structure: Provide detailed parsing reports and suggestions for improvement
- No phone numbers detected: Offer guidance on expected data formats
- File saving failures: Ensure original PDF is saved before processing begins
- Backup table insertion failures: Log errors but continue processing remaining records
- Multi-page processing errors: Handle page boundary issues gracefully

### Phone Validation Errors
- Invalid phone format: Log validation failures, set status as false
- Validation service failures: Implement fallback validation logic
- Batch processing errors: Handle individual record failures gracefully

### Database Errors
- Connection failures: Implement retry logic with exponential backoff
- Duplicate key violations in backup_table: Handle gracefully, inform user of existing records
- Email uniqueness violations in check_table: Provide clear error messages
- Transaction failures: Ensure data consistency between backup_table and check_table
- Immutability violations: Prevent any updates/deletes to backup_table

### Excel Export Errors
- Invalid range requests: Validate against check_table before query
- Large dataset handling: Implement streaming for large exports from check_table
- Missing company data: Handle null values gracefully in Excel output
- File generation failures: Provide fallback error response

## Testing Strategy

### Unit Testing
- PDF parsing logic with sample two-column PDF files
- Singapore phone validation with various phone number formats
- Database operations for both backup_table and check_table
- Excel generation with check_table data including null company fields
- Input validation functions for both tables

### Integration Testing
- End-to-end workflow: PDF upload → backup_table → validation → check_table
- Database connectivity and dual-table data persistence
- Excel export from check_table with different range scenarios
- Company information update workflow in check_table

### Error Scenario Testing
- Invalid PDF file handling and backup_table protection
- Singapore phone validation edge cases
- Database connection failures affecting both tables
- Immutability enforcement for backup_table
- Email uniqueness constraint violations in check_table
- Large file processing limits and batch validation

## Enhanced PDF Parsing Algorithms

### Complex Table Detection
The enhanced PDF processor uses multiple strategies to identify and parse complex table structures:

1. **Pattern Recognition**: Identifies common table patterns including:
   - Bordered tables with consistent spacing
   - Tab-delimited columns
   - Space-separated data with irregular spacing
   - Mixed content tables with headers and data sections

2. **Phone Number Detection**: Uses flexible regex patterns to identify Singapore phone numbers:
   - 8-digit format: `[689]\d{7}`
   - International format: `+65[689]\d{7}` or `65[689]\d{7}`
   - Formatted numbers: `6xxx-xxxx`, `8xxx xxxx`, etc.

3. **Metadata Extraction**: Intelligently maps adjacent column data:
   - Company names from preceding or following columns
   - Address information from multi-column spans
   - Contact details (email, website) from related fields

4. **Multi-Page Processing**: Handles PDFs spanning multiple pages:
   - Maintains context across page boundaries
   - Detects continued tables on subsequent pages
   - Preserves data relationships across page breaks

### Parsing Strategy Flow
```
PDF Input → Text Extraction → Table Structure Detection → 
Phone Pattern Matching → Metadata Association → 
Record Generation → Validation → Storage
```

## Security Considerations

### File Upload Security
- Restrict file types to PDF only with MIME type validation
- Implement file size limits (e.g., 10MB maximum)
- Scan uploaded files for malicious content before saving
- Store uploaded files in secure permanent location with proper permissions
- Generate unique filenames to prevent conflicts and directory traversal attacks
- Validate PDF integrity and structure before processing
- Implement file retention policies and secure deletion procedures

### Database Security
- Use parameterized queries to prevent SQL injection for both tables
- Implement connection pooling for better resource management
- Store database credentials in environment variables
- Enforce immutability constraints on backup_table at application level
- Validate email format and uniqueness in check_table
- Regular backup procedures for both backup_table and check_table data protection
- Implement proper access controls for company information updates

## Performance Optimization

### PDF Processing and Validation
- Stream processing for large PDF files
- Implement progress tracking for user feedback during upload and validation
- Batch process phone validation to reduce database round trips
- Cache Singapore phone validation patterns

### Database Operations
- Use batch inserts for backup_table records
- Implement efficient batch validation processing from backup_table to check_table
- Add appropriate indexes on both tables for query optimization
- Use database connection pooling for concurrent operations
- Optimize range queries on check_table for Excel exports

### Excel Export
- Stream large datasets from check_table to avoid memory issues
- Implement pagination for very large exports
- Handle null company fields efficiently in Excel generation
- Cache frequently requested ranges from check_table

## Deployment Configuration

### Environment Variables
```
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
```

### Directory Structure
```
singapore-phone-detect/
├── src/
│   ├── controllers/
│   │   ├── uploadController.js
│   │   ├── fileController.js
│   │   └── exportController.js
│   ├── services/
│   │   ├── enhancedPdfProcessor.js
│   │   ├── fileManager.js
│   │   ├── singaporePhoneValidator.js
│   │   └── excelExporter.js
│   ├── models/
│   │   ├── BackupTable.js
│   │   ├── CheckTable.js
│   │   └── UploadedFile.js
│   └── utils/
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── check-records.html
│   └── file-manager.html
├── uploads/
│   ├── original/
│   └── temp/
├── exports/
└── config/
```

### Database Schema Migration
The system requires both tables to be created with proper constraints:
- backup_table: Immutable storage for raw PDF data
- check_table: Editable storage for validated data with company information
- Proper indexes for performance optimization
- Foreign key relationships and constraints enforcement