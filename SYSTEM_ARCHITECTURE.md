# System Architecture Documentation

## Overview

The Singapore Phone Detect application is a comprehensive web-based system that processes both PDF and Excel files containing Singapore phone data. The system validates phone numbers, stores data in a dual-table architecture, and provides export capabilities.

## Architecture Components

### Application Layer
- **Framework**: Node.js with Express.js
- **Language**: JavaScript (ES6+)
- **Runtime**: Node.js 16+
- **Process Management**: PM2 (recommended for production)

### Data Processing Layer
- **PDF Processing**: pdf-parse library for text extraction
- **Excel Processing**: xlsx library for spreadsheet parsing
- **Phone Validation**: libphonenumber-js for Singapore phone validation
- **Data Validation**: Custom validation services

### Data Storage Layer
- **Database**: MySQL 5.7+ with InnoDB storage engine
- **File Storage**: Local file system with organized directory structure
- **Caching**: In-memory caching for processing optimization

### Web Interface Layer
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **File Upload**: Drag-and-drop interface with progress tracking
- **Real-time Updates**: Server-sent events for processing status
- **Responsive Design**: Mobile-friendly interface

## System Flow

### File Upload and Processing Flow

```
User Upload → File Validation → Storage → Processing → Database → Validation → Export
     ↓              ↓              ↓           ↓           ↓           ↓         ↓
  Web UI    →  File Type    →  File System → PDF/Excel → Backup   → Phone  → Excel
             →  Size Check   →  Organized  → Processor → Table    → Check  → Export
             →  Security     →  Storage    → Services  → Storage  → Table  → Files
```

### Dual-Table Architecture

```
Raw Data Flow:
PDF/Excel Files → Processing → Backup Table (Immutable)
                                     ↓
                              Phone Validation
                                     ↓
                              Check Table (Validated)
                                     ↓
                              Export Generation
```

## Component Details

### File Processing Components

#### PDF Processor
- **Purpose**: Extract structured data from PDF files
- **Technology**: pdf-parse library
- **Features**: 
  - Two-column data extraction
  - Text pattern recognition
  - Error handling for corrupted files
  - Metadata preservation

#### Excel Processor
- **Purpose**: Extract data from Excel files with intelligent parsing
- **Technology**: xlsx library
- **Features**:
  - Multi-worksheet support
  - Flexible column mapping
  - Header recognition
  - Data validation and cleaning
  - Multiple phone numbers per row handling

#### Worksheet Detector
- **Purpose**: Identify worksheets containing phone data
- **Features**:
  - Pattern-based detection
  - Confidence scoring
  - Priority-based processing
  - Metadata extraction

#### Column Mapper
- **Purpose**: Map Excel columns to database fields
- **Features**:
  - Intelligent header recognition
  - Flexible pattern matching
  - Company information extraction
  - Mapping validation

### Data Validation Components

#### Phone Validator
- **Purpose**: Validate Singapore phone numbers
- **Technology**: libphonenumber-js
- **Features**:
  - Format validation
  - Country-specific validation
  - Number normalization
  - Batch processing

#### Data Validator
- **Purpose**: Validate and clean extracted data
- **Features**:
  - Data integrity checks
  - Duplicate detection
  - Format standardization
  - Error reporting

### Storage Components

#### File Manager
- **Purpose**: Manage uploaded file storage
- **Features**:
  - Unique filename generation
  - Directory organization
  - File integrity verification
  - Cleanup procedures

#### Database Manager
- **Purpose**: Handle database operations
- **Features**:
  - Connection pooling
  - Transaction management
  - Query optimization
  - Error handling

## Database Schema

### Backup Table
```sql
CREATE TABLE backup_table (
    Id VARCHAR(100) NOT NULL PRIMARY KEY,
    Phone VARCHAR(50) NOT NULL,
    source_file VARCHAR(255) NULL,
    extracted_metadata TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_source_file (source_file),
    INDEX idx_created_at (created_at)
);
```

### Check Table
```sql
CREATE TABLE check_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_id VARCHAR(100) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    is_singapore_number BOOLEAN NOT NULL,
    company_name VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    website VARCHAR(255) NULL,
    validation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_file VARCHAR(255) NULL,
    FOREIGN KEY (backup_id) REFERENCES backup_table(Id),
    INDEX idx_phone_number (phone_number),
    INDEX idx_is_singapore_number (is_singapore_number),
    INDEX idx_validation_date (validation_date)
);
```

### Uploaded Files Table
```sql
CREATE TABLE uploaded_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    file_type ENUM('pdf', 'excel') NOT NULL,
    file_size BIGINT NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
    records_extracted INT DEFAULT 0,
    worksheets_processed INT DEFAULT 0,
    extraction_report TEXT NULL,
    INDEX idx_upload_timestamp (upload_timestamp),
    INDEX idx_processing_status (processing_status),
    INDEX idx_file_type (file_type)
);
```

## API Architecture

### RESTful Endpoints

#### File Operations
- `POST /upload` - Upload PDF or Excel files
- `GET /files` - List uploaded files
- `GET /files/:filename` - Download specific file
- `DELETE /files/:filename` - Delete uploaded file

#### Processing Operations
- `GET /processing-status/:fileId` - Get processing status
- `GET /extraction-report/:fileId` - Get detailed extraction report
- `POST /reprocess/:fileId` - Reprocess uploaded file

#### Data Operations
- `GET /stats` - Get system statistics
- `GET /export/:start/:end` - Export data range to Excel
- `GET /records` - Get paginated records
- `PUT /records/:id` - Update record information

#### System Operations
- `GET /health` - System health check
- `GET /ping` - Simple connectivity test

## Security Architecture

### File Upload Security
- **File Type Validation**: MIME type and extension checking
- **File Size Limits**: Configurable maximum file sizes
- **Content Scanning**: Malicious content detection
- **Quarantine System**: Suspicious files isolated

### Data Security
- **Input Sanitization**: All user inputs sanitized
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Output encoding and CSP headers
- **CSRF Protection**: Token-based protection

### Access Control
- **Rate Limiting**: API endpoint rate limiting
- **Session Management**: Secure session handling
- **File Access Control**: Restricted file access
- **Database Security**: Minimal privilege database users

## Performance Architecture

### Processing Optimization
- **Streaming Processing**: Large file streaming
- **Batch Operations**: Database batch processing
- **Connection Pooling**: Database connection optimization
- **Caching**: In-memory result caching

### Scalability Features
- **Horizontal Scaling**: Load balancer support
- **Database Scaling**: Read replica support
- **File Storage Scaling**: Distributed storage ready
- **Process Scaling**: Multi-process support

## Monitoring and Logging

### Application Monitoring
- **Health Checks**: Comprehensive health endpoints
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Detailed error logging
- **Resource Monitoring**: CPU and memory tracking

### Logging Architecture
- **Structured Logging**: JSON-formatted logs
- **Log Levels**: Configurable log levels
- **Log Rotation**: Automatic log file rotation
- **Centralized Logging**: External logging system support

## Deployment Architecture

### Container Support
- **Docker**: Containerized deployment
- **Docker Compose**: Multi-service orchestration
- **Kubernetes**: Container orchestration ready
- **Health Checks**: Container health monitoring

### Environment Management
- **Configuration**: Environment-based configuration
- **Secrets Management**: Secure credential handling
- **Database Migrations**: Automated schema updates
- **Graceful Shutdown**: Clean application shutdown

## Integration Points

### External Services
- **Database**: MySQL integration
- **File Storage**: Local and cloud storage support
- **Monitoring**: External monitoring system integration
- **Backup Services**: Automated backup integration

### API Integration
- **RESTful APIs**: Standard REST interface
- **Webhook Support**: Event-driven integrations
- **Batch Processing**: Bulk operation support
- **Real-time Updates**: WebSocket support ready

## Maintenance and Operations

### Backup Strategy
- **Database Backups**: Automated database backups
- **File Backups**: Uploaded file backups
- **Configuration Backups**: System configuration backups
- **Point-in-time Recovery**: Transaction log backups

### Update Procedures
- **Rolling Updates**: Zero-downtime updates
- **Database Migrations**: Automated schema updates
- **Configuration Updates**: Hot configuration reloading
- **Rollback Procedures**: Quick rollback capabilities

This architecture supports both current requirements and future scalability needs while maintaining security, performance, and reliability standards.