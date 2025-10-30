# Implementation Plan

- [ ] 1. Fix missing libphonenumber-js dependency and complete basic setup
  - [ ] 1.1 Add libphonenumber-js dependency to package.json
    - Install libphonenumber-js package for Singapore phone validation
    - Update package.json dependencies list
    - _Requirements: 2.1, 2.2_
  - [x] 1.2 Project structure and other dependencies are complete
    - Directory structure for controllers, services, models, and utilities exists
    - Express.js, MySQL2, pdf-parse, xlsx, multer dependencies are installed
    - Environment configuration files are set up
    - _Requirements: 5.1, 6.4_

- [x] 2. Implement dual-table database setup and connection management
  - [x] 2.1 Update database connection utility for dual-table architecture
    - Modify existing MySQL connection manager to support both backup_table and check_table
    - Add environment variables for Singapore phone validation configuration
    - _Requirements: 2.3, 3.3, 6.2_
  
  - [x] 2.2 Create backup_table and check_table schemas
    - Write SQL schema for immutable backup_table (Id, Phone)
    - Write SQL schema for editable check_table (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website)
    - Implement table creation logic with proper constraints and indexes
    - _Requirements: 1.4, 2.5, 3.3_
  
  - [x] 2.3 Write unit tests for dual-table database operations
    - Create tests for both table creation and constraint enforcement
    - Test immutability constraints on backup_table
    - Test email uniqueness constraint on check_table
    - _Requirements: 6.2, 6.5_

- [x] 3. Implement PDF processing service for backup_table storage
  - [x] 3.1 Update PDF parser for headerless two-column Id-Phone extraction
    - Modify existing PDF text extraction to handle headerless PDFs with only data rows
    - Implement column structure detection without relying on header row
    - Remove identifier format validation (accept any Id format)
    - Add validation for two-column PDF structure without headers
    - _Requirements: 1.1, 1.2_
  
  - [x] 3.2 Implement direct storage to backup_table
    - Create service to store extracted PDF data directly to backup_table
    - Implement immutability enforcement (no updates/deletes after insertion)
    - Add comprehensive error handling for backup_table operations
    - _Requirements: 1.3, 1.4, 6.2_
  
  - [x] 3.3 Write unit tests for PDF processing and backup storage
    - Create test cases with sample two-column PDF files
    - Test backup_table storage and immutability constraints
    - Test error handling for various PDF format issues
    - _Requirements: 1.2, 1.4, 6.2_

- [x] 4. Implement Singapore phone validation service using libphonenumber-js
  - [x] 4.1 Install and integrate libphonenumber-js package
    - Add libphonenumber-js dependency to package.json
    - Update Singapore phone validator to use libphonenumber-js instead of regex
    - Implement proper Singapore phone number validation using libphonenumber-js parsePhoneNumber and isValidPhoneNumber functions
    - Add configuration for Singapore country code (SG) validation
    - _Requirements: 2.1, 2.2_
  
  - [x] 4.2 Implement backup_table to check_table processing
    - Create service to read from backup_table and validate phone numbers
    - Implement batch processing to populate check_table with validation results
    - Set Status field based on Singapore phone validation (true/false)
    - Initialize company fields (CompanyName, PhysicalAddress, Email, Website) as null
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  
  - [x] 4.3 Update unit tests for libphonenumber-js phone validation service
    - Update existing tests to use libphonenumber-js validation instead of regex
    - Test Singapore phone validation using libphonenumber-js with various phone number formats
    - Test batch processing from backup_table to check_table with libphonenumber-js validation
    - Test proper status assignment and null field initialization
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 5. Implement check_table management and Excel export service
  - [x] 5.1 Create check_table CRUD operations
    - Write CheckTable model with insert, update, and query methods for check_table
    - Implement company information update functionality (CompanyName, PhysicalAddress, Email, Website)
    - Add email uniqueness constraint enforcement
    - Prevent updates to Id, Phone, and Status fields
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 5.2 Update Excel export to use check_table data
    - Modify existing Excel_Exporter to export from check_table instead of phone_records
    - Include all check_table fields in export (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website)
    - Handle null company fields gracefully in Excel output
    - Implement range validation against check_table records
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 5.3 Write unit tests for check_table operations and Excel export
    - Test CRUD operations on check_table with company information
    - Test email uniqueness constraint and field update restrictions
    - Test Excel generation with check_table data including null fields
    - _Requirements: 3.1, 3.3, 4.3, 4.5_

- [x] 6. Update Express.js API endpoints for dual-table architecture
  - [x] 6.1 Update file upload endpoint for backup_table workflow
    - Modify existing POST /upload endpoint to store data in backup_table
    - Trigger Singapore phone validation process after backup_table insertion
    - Provide upload progress and validation status feedback
    - Add file type validation to accept only PDF files
    - _Requirements: 1.1, 1.3, 2.1, 5.1, 6.4_
  
  - [x] 6.2 Update Excel export endpoint to use check_table
    - Modify existing GET /export/:start/:end endpoint to export from check_table
    - Include all check_table fields in the export response
    - Add proper validation for start and end parameters against check_table
    - Implement file download response with appropriate headers
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  
  - [x] 6.3 Create check_table management endpoints
    - Implement PUT /check/:id endpoint for updating company information
    - Create GET /check endpoint for listing check_table records with pagination
    - Add validation to prevent updates to Id, Phone, and Status fields
    - Enforce email uniqueness constraint in update operations
    - _Requirements: 3.1, 3.2, 3.4, 5.3_
  
  - [x] 6.4 Update statistics endpoint for dual-table reporting
    - Modify existing GET /stats endpoint to return statistics for both tables
    - Include backup_table record count, check_table record count, and validation status breakdown
    - Add error handling middleware for all endpoints
    - Create proper HTTP status codes and response formats
    - _Requirements: 5.5, 6.1_
  
  - [x] 6.5 Write integration tests for updated API endpoints
    - Test complete workflow: PDF upload → backup_table → validation → check_table
    - Test check_table company information update workflow
    - Test Excel export from check_table with various range scenarios
    - Test dual-table statistics reporting
    - _Requirements: 1.1, 2.2, 3.1, 4.1, 5.5_

- [x] 7. Update web interface for dual-table management
  - [x] 7.1 Update HTML structure for dual-table workflow
    - Modify existing HTML page to show backup_table and check_table statistics
    - Add sections for viewing and editing check_table records
    - Update export interface to work with check_table data
    - Add company information management forms
    - _Requirements: 5.1, 5.3, 5.4_
  
  - [x] 7.2 Update client-side JavaScript for new workflow
    - Modify file upload handling to show validation progress after backup_table insertion
    - Implement check_table record viewing and editing functionality
    - Update export form to work with check_table range validation
    - Add company information update forms with field validation
    - Display statistics for both backup_table and check_table
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  
  - [x] 7.3 Add client-side validation for dual-table operations
    - Implement validation for company information updates (email format, required fields)
    - Add range validation for check_table export requests
    - Create user-friendly error message display for both table operations
    - Add confirmation dialogs for company information updates
    - _Requirements: 3.2, 4.5, 7.5_

- [x] 8. Integrate all components for dual-table architecture
  - [x] 8.1 Wire up all services for dual-table workflow
    - Connect PDF processor, Singapore phone validator, and dual-table database manager
    - Integrate backup_table storage with automatic check_table validation processing
    - Set up Express.js server with updated routes and middleware for both tables
    - Configure static file serving for updated web interface
    - _Requirements: 1.3, 2.4, 3.5, 5.1_
  
  - [x] 8.2 Update environment configuration for dual-table deployment
    - Add environment variables for Singapore phone validation patterns
    - Update application startup logic with dual-table database initialization
    - Implement graceful shutdown handling for both table operations
    - Add configuration for batch validation processing
    - _Requirements: 2.5, 6.2, 6.5_
  
  - [x] 8.3 Create end-to-end integration tests for dual-table workflow
    - Test complete workflow: PDF upload → backup_table → validation → check_table → Excel export
    - Test company information management and email uniqueness constraints
    - Test concurrent user operations and error scenarios across both tables
    - Verify data integrity and immutability constraints throughout the entire process
    - _Requirements: 1.1, 1.4, 2.2, 3.1, 4.1, 7.5_

- [x] 9. Implement dedicated Check Table Records interface
  - [x] 9.1 Create Check Table Records HTML page
    - Create check-records.html with table structure for displaying Check_Table records
    - Add table headers: Id, Phone, Company Name, Physical Address, Email, Website, Action
    - Implement search box for filtering records across all fields
    - Add navigation from main page via "View Check Table Records" button
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 9.2 Implement visual status indicators and record styling
    - Apply red background or red font color for records with status false
    - Apply normal styling for records with status true
    - Ensure proper contrast and accessibility for status indicators
    - _Requirements: 6.4, 6.5_
  
  - [x] 9.3 Create record editing functionality
    - Add edit button in Action column for each record
    - Implement inline editing or modal forms for company information
    - Allow editing of Company Name, Physical Address, Email, and Website fields only
    - Prevent editing of Id and Phone fields during record updates
    - Add save and cancel functionality for record edits
    - _Requirements: 6.6, 6.7, 6.8_
  
  - [x] 9.4 Implement search and filtering functionality
    - Create client-side search functionality across all displayed fields
    - Add real-time filtering as user types in search box
    - Highlight search matches in table results
    - Handle empty search results gracefully
    - _Requirements: 6.3_
  
  - [x] 9.5 Add API endpoint for Check Table Records page
    - Create GET /check-records endpoint to serve the dedicated page
    - Update existing GET /check endpoint to support search parameters
    - Add proper error handling for Check Table Records operations
    - Implement pagination for large record sets
    - _Requirements: 6.1, 6.3_

- [x] 10. Final integration and testing for Check Table Records interface
  - [x] 10.1 Integrate Check Table Records interface with existing system
    - Wire up Check Table Records page with existing API endpoints
    - Ensure proper navigation between main page and Check Table Records page
    - Test integration with libphonenumber-js validation results display
    - Verify headerless PDF processing results appear correctly in interface
    - _Requirements: 6.1, 6.4, 6.5_
  
  - [x] 10.2 Create comprehensive tests for Check Table Records functionality
    - Test search functionality across all record fields
    - Test edit functionality with field restrictions (Id, Phone non-editable)
    - Test visual status indicators for true/false validation results
    - Test navigation and user experience flows
    - _Requirements: 6.3, 6.6, 6.7, 6.8_

- [x] 11. Implement enhanced PDF processing for complex table structures
  - [x] 11.1 Create enhanced PDF processor with advanced parsing capabilities
    - Implement complex table structure detection algorithms
    - Add flexible phone number pattern matching for various formats (8-digit, international, formatted)
    - Create intelligent column detection that works regardless of phone number position
    - Add metadata extraction from adjacent columns (company names, addresses, etc.)
    - Implement multi-page PDF processing with context preservation
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3_
  
  - [x] 11.2 Implement file management system for original PDF storage
    - Create FileManager service to handle original PDF file storage
    - Implement unique timestamped filename generation
    - Add upload directory management with proper permissions
    - Create file metadata tracking system
    - Implement file integrity validation before processing
    - _Requirements: 1.1, 1.10, 6.1.1, 6.1.2, 6.1.3_
  
  - [x] 11.3 Update database schema for enhanced metadata storage
    - Add source_file and extracted_metadata columns to backup_table
    - Create uploaded_files table for file metadata tracking
    - Update database initialization scripts
    - Add proper indexes for file-related queries
    - _Requirements: 1.5, 1.8, 6.1.3_

- [x] 12. Enhance PDF parsing algorithms and validation
  - [x] 12.1 Implement advanced table structure detection
    - Create pattern recognition for bordered tables, space-separated columns, and tab-delimited data
    - Add intelligent header detection and skipping
    - Implement handling of merged cells and irregular spacing
    - Add support for tables with mixed data types
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 12.2 Enhance phone number detection and validation
    - Implement flexible regex patterns for Singapore phone formats
    - Add support for international formats with country codes (+65, 65)
    - Handle formatted numbers (6xxx-xxxx, 8xxx xxxx, etc.)
    - Extract phone numbers from cells with additional text or formatting
    - _Requirements: 7.5, 7.6_
  
  - [x] 12.3 Implement metadata extraction and mapping
    - Create intelligent mapping of adjacent column data as company information
    - Handle multiple phone numbers in single rows by creating separate records
    - Preserve data relationships across columns
    - Add extraction reporting for debugging and validation
    - _Requirements: 1.7, 7.6, 7.7, 7.9_

- [x] 13. Update upload workflow for enhanced file management
  - [x] 13.1 Modify upload controller for file-first approach
    - Update upload flow to save original PDF before processing
    - Implement file metadata recording in uploaded_files table
    - Add processing status tracking (pending, processed, failed)
    - Create cleanup procedures for temporary files
    - _Requirements: 1.1, 1.10, 6.1.2, 6.1.6_
  
  - [x] 13.2 Enhance error handling and user feedback
    - Provide detailed extraction reports showing identified columns
    - Add suggestions for data format improvements when parsing fails
    - Implement graceful handling of complex PDF structures
    - Create user-friendly error messages for various PDF issues
    - _Requirements: 1.11, 7.10, 8.1, 8.7_
  
  - [x] 13.3 Add file management API endpoints
    - Create GET /files endpoint to list uploaded PDF files
    - Implement GET /files/:filename endpoint for downloading original PDFs
    - Add DELETE /files/:filename endpoint for file archival (admin only)
    - Update statistics endpoint to include file processing metrics
    - _Requirements: 6.1.4, 6.1.5, 6.1.8_

- [x] 14. Create comprehensive testing for enhanced features
  - [x] 14.1 Test complex PDF parsing with various formats
    - Create test cases with multi-column PDFs containing mixed data types
    - Test phone number detection in different column positions
    - Validate metadata extraction from adjacent columns
    - Test multi-page PDF processing
    - _Requirements: 7.1, 7.2, 7.3, 7.8_
  
  - [x] 14.2 Test file management functionality
    - Validate original PDF file saving with unique filenames
    - Test file metadata tracking and status updates
    - Verify file integrity validation
    - Test file cleanup and archival procedures
    - _Requirements: 6.1.2, 6.1.3, 6.1.6, 6.1.7_
  
  - [x] 14.3 Integration testing for enhanced workflow
    - Test complete workflow: File save → Complex PDF parsing → Backup storage → Validation → Check table
    - Validate enhanced error handling and user feedback
    - Test file management API endpoints
    - Verify backward compatibility with existing simple PDF formats
    - _Requirements: 1.1, 1.8, 1.11, 7.9, 8.6_

- [x] 15. Final integration and deployment preparation
  - [x] 15.1 Update web interface for enhanced features
    - Add file management interface for viewing uploaded PDFs
    - Enhance upload progress display with detailed parsing feedback
    - Update error messages to show parsing suggestions
    - Add download links for original PDF files
    - _Requirements: 6.1.4, 6.1.5, 7.10_
  
  - [x] 15.2 Performance optimization and security enhancements
    - Implement streaming for large PDF file processing
    - Add file size validation and security scanning
    - Optimize database queries for file metadata
    - Implement proper file permissions and access controls
    - _Requirements: 6.1.6, 8.6, 8.7_
  
  - [x] 15.3 Final validation and documentation
    - Test system with user's actual "Sg Com.pdf" file
    - Validate all enhanced features work correctly
    - Update deployment configuration for file storage
    - Create user documentation for complex PDF upload requirements
    - _Requirements: 1.1, 1.11, 8.6, 8.7_

- [ ] 16. Complete remaining implementation gaps
  - [x] 16.1 Fix libphonenumber-js integration
    - Install missing libphonenumber-js dependency in package.json
    - Verify Singapore phone validator service works correctly with libphonenumber-js
    - Test phone validation with various Singapore phone number formats
    - _Requirements: 2.1, 2.2_
  
  - [x] 16.2 Complete enhanced PDF processor implementation
    - Finish implementation of complex metadata extraction methods
    - Complete phone number pattern matching and validation methods
    - Implement missing utility methods for table structure detection
    - Add comprehensive error handling for complex PDF parsing
    - _Requirements: 1.1, 1.2, 7.1, 7.2, 7.3_
  
  - [x] 16.3 Verify all test implementations
    - Run all existing tests to ensure they pass
    - Fix any failing tests related to libphonenumber-js integration
    - Verify complex PDF parsing tests work correctly
    - Test file management functionality end-to-end
    - _Requirements: 6.2, 6.5, 7.8, 8.6_