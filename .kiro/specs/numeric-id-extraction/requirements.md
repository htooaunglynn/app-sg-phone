# Requirements Document

## Introduction

This feature adds a numeric ID extraction capability to the check_table database schema. The system currently stores IDs in formats like "SG COM-2001", "SG COM-2002", "SG COM-2003" but lacks a dedicated column to store only the numeric portion (2001, 2002, 2003) for efficient sorting, searching, and range operations.

## Glossary

- **Check_Table**: The main database table storing phone record information with ID, phone numbers, and company details
- **Numeric_ID**: The extracted numeric portion from the full ID string (e.g., 2001 from "SG COM-2001")
- **ID_Pattern**: The current ID format containing prefix, separator, and numeric suffix (e.g., "SG COM-2001")
- **Database_Migration**: A versioned database schema change that can be applied and rolled back
- **Extraction_Logic**: The algorithm to parse and extract numeric digits from the ID string

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to add a numeric ID column to the check_table, so that I can perform efficient numeric operations on ID values.

#### Acceptance Criteria

1. THE Database_Migration SHALL add a new column named "numeric_id" to the check_table
2. THE numeric_id column SHALL store INTEGER values extracted from the Id column
3. THE Database_Migration SHALL include proper indexing for the numeric_id column for query performance
4. THE Database_Migration SHALL be reversible through a rollback mechanism
5. THE Database_Migration SHALL handle existing data by populating numeric_id values from current Id records

### Requirement 2

**User Story:** As a developer, I want automatic extraction of numeric IDs from existing and new records, so that the numeric_id column stays synchronized with the Id column.

#### Acceptance Criteria

1. WHEN a new record is inserted into check_table, THE CheckTable_Model SHALL automatically extract and populate the numeric_id value
2. WHEN an existing record's Id is updated, THE CheckTable_Model SHALL automatically update the corresponding numeric_id value
3. THE Extraction_Logic SHALL handle various ID formats with different prefixes and separators
4. IF the Id contains no numeric portion, THEN THE CheckTable_Model SHALL set numeric_id to NULL
5. THE Extraction_Logic SHALL extract only the trailing numeric sequence from the Id string

### Requirement 3

**User Story:** As a system user, I want improved query performance for range-based operations, so that I can efficiently filter and sort records by numeric ID values.

#### Acceptance Criteria

1. THE CheckTable_Model SHALL provide methods to query records by numeric ID ranges
2. THE numeric_id column SHALL have a database index for optimized query performance
3. WHEN performing range queries, THE CheckTable_Model SHALL use the numeric_id column instead of string parsing
4. THE existing findByRange method SHALL be updated to leverage the numeric_id column
5. THE query performance SHALL be measurably improved for large datasets compared to string-based sorting

### Requirement 4

**User Story:** As a data analyst, I want validation and error handling for numeric ID extraction, so that data integrity is maintained during the migration and ongoing operations.

#### Acceptance Criteria

1. THE Database_Migration SHALL validate that all existing records can have numeric IDs extracted successfully
2. IF extraction fails for any record during migration, THEN THE Database_Migration SHALL log the problematic record and continue processing
3. THE CheckTable_Model SHALL validate extracted numeric_id values before database insertion
4. THE Extraction_Logic SHALL handle edge cases such as multiple numeric sequences in the Id
5. THE Database_Migration SHALL provide detailed logging of extraction results and any failures