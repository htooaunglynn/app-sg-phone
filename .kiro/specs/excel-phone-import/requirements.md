# Requirements Document

## Introduction

The Excel Phone Import system (Version 2) is a streamlined Singapore Phone Detect application that processes Excel files containing phone data. This version focuses exclusively on Excel file processing, removing PDF support to simplify the system architecture. The system maintains the dual-table architecture, storing raw Excel data in the backup table and processing phone numbers through Singapore validation to populate the check table.

## Glossary

- **Excel_Processor**: The component responsible for extracting data from uploaded Excel files with support for multiple worksheets and flexible column structures
- **File_Manager**: The component that handles saving original Excel files to the uploads directory before processing
- **Database_Manager**: The component that handles MySQL database operations for both backup and check tables
- **Singapore_Phone_Validator**: The component that validates whether a phone number is a Singapore phone number using libphonenumber-js package
- **Excel_Parser**: Advanced parsing engine that handles multiple worksheets, various column layouts, and mixed data types in Excel files
- **Worksheet_Detector**: Component that identifies which worksheet contains phone data when multiple sheets are present
- **Column_Mapper**: Component that intelligently maps Excel columns to expected data fields (Id, Phone, Company information)
- **Data_Validator**: Component that validates Excel data integrity and format before processing
- **Backup_Table**: The immutable table that stores raw Excel upload data (Id, Phone) with metadata
- **Check_Table**: The table that stores processed data with validation status and company information
- **Upload_Directory**: The file system directory where original Excel files are permanently stored

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload Excel files containing phone data in various formats, so that the original file is saved and the raw data is permanently stored in a backup table.

#### Acceptance Criteria

1. WHEN a user uploads an Excel file, THE File_Manager SHALL save the original Excel file to the uploads directory with a unique timestamped filename
2. THE Excel_Processor SHALL support both .xlsx and .xls file formats
3. THE Excel_Processor SHALL automatically detect which worksheet contains phone data when multiple sheets are present
4. THE Excel_Processor SHALL identify phone number columns regardless of column position or header names
5. THE Excel_Processor SHALL handle Excel files with headers, empty rows, and multiple data sections
6. THE Excel_Processor SHALL extract phone numbers from cells containing mixed data types and formatting
7. THE Excel_Processor SHALL generate unique sequential IDs for records when no ID column is present in the Excel file
8. THE Excel_Processor SHALL preserve any company information, names, or additional metadata found in adjacent columns
9. WHEN data extraction is successful, THE Database_Manager SHALL store each record in the Backup_Table with extracted phone numbers and metadata
10. THE File_Manager SHALL maintain the original Excel file in the uploads directory for future reference or reprocessing
11. IF the Excel file contains no recognizable phone numbers, THEN THE Web_Application SHALL display an informative error message to the user

### Requirement 2

**User Story:** As a user, I want the system to handle multiple worksheets in Excel files, so that I can upload complex Excel files with phone data distributed across different sheets.

#### Acceptance Criteria

1. THE Worksheet_Detector SHALL scan all worksheets in an Excel file to identify sheets containing phone data
2. THE Excel_Processor SHALL process phone data from multiple worksheets within a single Excel file
3. WHEN multiple worksheets contain phone data, THE Excel_Processor SHALL combine records from all relevant sheets
4. THE Excel_Processor SHALL preserve worksheet name information as metadata for each extracted record
5. THE Excel_Processor SHALL handle worksheets with different column structures and layouts
6. IF no worksheets contain recognizable phone data, THEN THE Web_Application SHALL provide guidance on expected data formats

### Requirement 3

**User Story:** As a user, I want the system to intelligently map Excel columns to data fields, so that I can upload Excel files with various column arrangements and header names.

#### Acceptance Criteria

1. THE Column_Mapper SHALL identify phone number columns using flexible pattern matching regardless of header names
2. THE Column_Mapper SHALL recognize common header variations for phone numbers (Phone, Mobile, Contact, Number, etc.)
3. THE Column_Mapper SHALL identify ID columns using pattern matching for various identifier formats
4. THE Column_Mapper SHALL map company information from adjacent columns (Name, Company, Address, Email, Website)
5. THE Column_Mapper SHALL handle Excel files where phone numbers appear in multiple columns
6. WHEN multiple phone columns are detected, THE Excel_Processor SHALL create separate records for each phone number per row
7. THE Column_Mapper SHALL provide detailed mapping reports showing which columns were identified and processed

### Requirement 4

**User Story:** As a user, I want the system to validate and clean Excel data before processing, so that I can ensure data quality and handle formatting issues.

#### Acceptance Criteria

1. THE Data_Validator SHALL check for empty rows and skip them during processing
2. THE Data_Validator SHALL validate phone number formats and flag invalid entries
3. THE Data_Validator SHALL handle merged cells and extract data appropriately
4. THE Data_Validator SHALL process phone numbers with various formatting (spaces, dashes, parentheses)
5. THE Data_Validator SHALL detect and handle duplicate phone numbers within the same Excel file
6. THE Data_Validator SHALL validate that required data exists before creating backup table records
7. IF data validation fails for specific rows, THE Excel_Processor SHALL log errors but continue processing valid rows

### Requirement 5

**User Story:** As a user, I want the Excel processing to integrate with the Singapore phone validation system, so that Excel data is properly validated and stored.

#### Acceptance Criteria

1. WHEN Excel data is stored in Backup_Table, THE Singapore_Phone_Validator SHALL process records using standard validation logic
2. THE Excel_Processor SHALL use the dual-table architecture (Backup_Table → Check_Table)
3. THE Excel_Processor SHALL store source file information and extraction metadata
4. THE Web_Application SHALL display Excel processing statistics
5. THE Excel_Processor SHALL trigger the Singapore phone validation workflow after backup table insertion

### Requirement 6

**User Story:** As a user, I want enhanced error handling and user feedback for Excel processing, so that I can understand and resolve issues with uploaded Excel files.

#### Acceptance Criteria

1. WHEN an Excel processing error occurs, THE Web_Application SHALL log the error and display a user-friendly message
2. THE Excel_Processor SHALL provide detailed extraction reports showing processed worksheets and columns
3. THE Web_Application SHALL validate Excel file integrity before processing begins
4. THE Excel_Processor SHALL handle corrupted Excel files gracefully and provide recovery suggestions
5. THE Web_Application SHALL display progress feedback during Excel file processing
6. IF Excel structure is too complex to parse automatically, THE Web_Application SHALL provide suggestions for data format improvements
7. THE Excel_Processor SHALL retain the original Excel file for manual review when processing fails

### Requirement 7

**User Story:** As a user, I want the web interface to support Excel file uploads exclusively, so that I can upload phone data in Excel format.

#### Acceptance Criteria

1. THE Web_Application SHALL provide a file upload interface that accepts only Excel files
2. THE Web_Application SHALL validate file types to ensure only Excel files (.xlsx, .xls) are accepted
3. THE Web_Application SHALL display appropriate processing status for Excel files
4. THE Web_Application SHALL provide clear guidance on Excel file format requirements
5. THE Web_Application SHALL reject non-Excel file uploads with informative error messages

### Requirement 8

**User Story:** As a system administrator, I want the Excel processing system to maintain high security and performance standards, so that the application remains reliable and secure.

#### Acceptance Criteria

1. THE Excel_Processor SHALL implement appropriate file size limits and security validation
2. THE File_Manager SHALL apply secure file storage and naming conventions for Excel files
3. THE Excel_Processor SHALL use proper database transaction integrity
4. THE Web_Application SHALL apply appropriate access controls and validation for Excel uploads
5. THE Excel_Processor SHALL implement streaming for large Excel files to maintain performance
6. THE Excel_Processor SHALL clean up temporary files after successful processing
7. THE Excel_Processor SHALL maintain audit logs for Excel file processing activities