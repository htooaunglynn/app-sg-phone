# Requirements Document

## Introduction

The Singapore Phone Detect system is a web application that processes PDF files containing phone data, validates Singapore phone numbers, and manages data through a two-table database structure. The system stores raw PDF data in an immutable backup table, then processes and validates phone numbers to determine if they are Singapore numbers, storing the results with additional company information in a separate check table.

## Glossary

- **PDF_Processor**: The component responsible for extracting data from uploaded PDF files with advanced parsing capabilities for complex table structures
- **File_Manager**: The component that handles saving original PDF files to the uploads directory before processing
- **Database_Manager**: The component that handles MySQL database operations for both backup and check tables
- **Singapore_Phone_Validator**: The component that validates whether a phone number is a Singapore phone number using libphonenumber-js package
- **Excel_Exporter**: The component that generates Excel files with user-specified data ranges from the check table
- **Web_Application**: The Express.js-based web server that provides the user interface and API endpoints
- **Backup_Table**: The immutable table that stores raw PDF upload data (Id, Phone) with metadata
- **Check_Table**: The table that stores processed data with validation status and company information
- **Upload_Directory**: The file system directory where original PDF files are permanently stored
- **Complex_PDF_Parser**: Advanced parsing engine that handles multi-column tables, irregular formatting, and mixed data types
- **Phone_Validation**: The process of determining if a phone number is a Singapore phone number (status: true/false) using libphonenumber-js
- **Check_Table_Interface**: The web interface for viewing and managing Check Table records with search, edit, and visual status indicators

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload PDF files containing phone data in various formats, so that the original file is saved and the raw data is permanently stored in a backup table.

#### Acceptance Criteria

1. WHEN a user uploads a PDF file, THE File_Manager SHALL save the original PDF file to the uploads directory with a unique timestamped filename
2. THE PDF_Processor SHALL automatically detect complex table structures and identify phone number columns regardless of position
3. THE PDF_Processor SHALL handle PDFs with headers, footers, and multiple data sections by intelligently parsing table content
4. THE PDF_Processor SHALL extract phone numbers from multi-column PDFs containing mixed data types (text, numbers, dates)
5. THE PDF_Processor SHALL support various table formats including bordered tables, space-separated columns, and tab-delimited data
6. THE PDF_Processor SHALL generate unique sequential IDs for records when no ID column is present in the PDF
7. THE PDF_Processor SHALL preserve any company information, names, or additional metadata found in adjacent columns
8. WHEN data extraction is successful, THE Database_Manager SHALL store each record in the Backup_Table with extracted phone numbers and metadata
9. THE Backup_Table SHALL be immutable after data insertion (no edits or deletes allowed)
10. THE File_Manager SHALL maintain the original PDF file in the uploads directory for future reference or reprocessing
11. IF the PDF file contains no recognizable phone numbers, THEN THE Web_Application SHALL display an informative error message to the user

### Requirement 2

**User Story:** As a user, I want the system to automatically validate Singapore phone numbers from the backup data, so that I can identify which phones are Singapore numbers.

#### Acceptance Criteria

1. WHEN data exists in the Backup_Table, THE Singapore_Phone_Validator SHALL check each phone number using libphonenumber-js package
2. THE Singapore_Phone_Validator SHALL determine if each phone number is a Singapore phone number using libphonenumber-js validation
3. WHEN a phone number is validated as Singapore, THE Database_Manager SHALL store the record in Check_Table with status true
4. WHEN a phone number is not a Singapore number, THE Database_Manager SHALL store the record in Check_Table with status false
5. THE Check_Table SHALL initialize CompanyName, PhysicalAddress, Email, and Website fields as null for all records

### Requirement 3

**User Story:** As a user, I want to manage and update company information in the check table, so that I can maintain complete records for validated phone numbers.

#### Acceptance Criteria

1. THE Database_Manager SHALL allow updates to CompanyName, PhysicalAddress, Email, and Website fields in Check_Table
2. THE Database_Manager SHALL prevent updates to Id, Phone, and Status fields in Check_Table
3. THE Database_Manager SHALL enforce unique constraint on Email field in Check_Table
4. THE Web_Application SHALL provide interface for editing company information
5. THE Database_Manager SHALL maintain referential integrity between Backup_Table and Check_Table

### Requirement 4

**User Story:** As a user, I want to export validated phone data to Excel files with custom range selection, so that I can work with specific subsets of the processed data.

#### Acceptance Criteria

1. THE Excel_Exporter SHALL export data from Check_Table only (not Backup_Table)
2. THE Excel_Exporter SHALL allow users to specify start and end range for data export
3. THE Excel_Exporter SHALL include all fields from Check_Table in the export (Id, Phone, Status, CompanyName, PhysicalAddress, Email, Website)
4. THE Web_Application SHALL validate that the requested range exists in Check_Table before export
5. IF the requested range is invalid, THEN THE Web_Application SHALL display an appropriate error message

### Requirement 5

**User Story:** As a user, I want a web interface to manage PDF uploads, phone validation, and Excel exports, so that I can easily interact with the system.

#### Acceptance Criteria

1. THE Web_Application SHALL provide a file upload interface for PDF files
2. THE Web_Application SHALL display upload progress and validation status to the user
3. THE Web_Application SHALL provide interface for viewing and editing Check_Table records
4. THE Web_Application SHALL provide input fields for specifying export ranges from Check_Table
5. THE Web_Application SHALL display statistics for both Backup_Table and Check_Table record counts

### Requirement 6

**User Story:** As a user, I want a dedicated Check Table Records interface, so that I can view, search, and manage all validated phone records with visual status indicators.

#### Acceptance Criteria

1. WHEN a user clicks "View Check Table Records" button, THE Web_Application SHALL navigate to a new page displaying Check_Table records
2. THE Check_Table_Interface SHALL display records in a table with headers: Id, Phone, Company Name, Physical Address, Email, Website, Action
3. THE Check_Table_Interface SHALL provide a search box for filtering records across all displayed fields
4. WHEN a record has status false, THE Check_Table_Interface SHALL display the row with red background or red font color
5. WHEN a record has status true, THE Check_Table_Interface SHALL display the row with normal styling
6. THE Check_Table_Interface SHALL provide an edit button in the Action column for each record
7. WHEN editing a record, THE Check_Table_Interface SHALL allow updates to Company Name, Physical Address, Email, and Website fields only
8. THE Check_Table_Interface SHALL prevent editing of Id and Phone fields during record updates

### Requirement 6.1

**User Story:** As a user, I want to manage uploaded PDF files, so that I can access original files for reference or reprocessing.

#### Acceptance Criteria

1. THE File_Manager SHALL create an uploads directory if it does not exist
2. WHEN a PDF file is uploaded, THE File_Manager SHALL save it with a unique filename format: timestamp_originalname.pdf
3. THE File_Manager SHALL preserve the original filename in the database for reference
4. THE Web_Application SHALL provide an interface to view the list of uploaded PDF files
5. THE Web_Application SHALL allow users to download previously uploaded PDF files
6. THE File_Manager SHALL implement file size limits and validate PDF file integrity before saving
7. THE File_Manager SHALL clean up temporary files after successful processing
8. WHEN storage space is limited, THE File_Manager SHALL provide options for archiving or removing old PDF files

### Requirement 7

**User Story:** As a user, I want the system to intelligently parse complex PDF structures, so that I can upload PDFs with various table formats and data layouts.

#### Acceptance Criteria

1. THE PDF_Processor SHALL detect and parse tables with multiple columns containing mixed data types
2. THE PDF_Processor SHALL identify phone number patterns using flexible regex matching for Singapore phone formats
3. THE PDF_Processor SHALL handle PDFs with irregular spacing, merged cells, and varying column widths
4. THE PDF_Processor SHALL extract phone numbers from cells that may contain additional formatting or text
5. THE PDF_Processor SHALL support both 8-digit Singapore phone numbers and international formats with country codes
6. THE PDF_Processor SHALL intelligently map data from adjacent columns as potential company information
7. WHEN multiple phone numbers are found in a single row, THE PDF_Processor SHALL create separate records for each phone number
8. THE PDF_Processor SHALL handle PDFs with multiple pages and continue extraction across page boundaries
9. THE PDF_Processor SHALL provide detailed extraction reports showing which columns were identified and processed
10. IF the PDF structure is too complex to parse automatically, THE Web_Application SHALL provide suggestions for data format improvements

### Requirement 8

**User Story:** As a system administrator, I want the application to handle errors gracefully and maintain data integrity, so that the two-table system operates reliably.

#### Acceptance Criteria

1. WHEN a PDF processing error occurs, THE Web_Application SHALL log the error and display a user-friendly message
2. THE Database_Manager SHALL ensure Backup_Table remains immutable after initial data insertion
3. THE Database_Manager SHALL handle validation errors gracefully when processing phone numbers
4. THE Web_Application SHALL validate file types before processing to ensure only PDF files are accepted
5. THE Database_Manager SHALL maintain transaction integrity when moving data from Backup_Table to Check_Table
6. THE File_Manager SHALL ensure uploaded PDF files are properly saved before processing begins
7. WHEN PDF processing fails, THE File_Manager SHALL retain the original PDF file for manual review or reprocessing