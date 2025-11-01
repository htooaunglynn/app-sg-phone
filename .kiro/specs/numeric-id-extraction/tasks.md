# Implementation Plan

- [x] 1. Create database migration for numeric_id column
  - Create migration file following existing pattern in migrations directory
  - Implement up() method to add numeric_id column with proper data type and indexing
  - Implement down() method for rollback capability
  - Add data population logic to extract numeric IDs from existing records
  - Include comprehensive error handling and logging for migration process
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2_

- [x] 2. Update CheckTable model for numeric_id support
  - [x] 2.1 Add static extractNumericId method to CheckTable class
    - Write extraction logic using regex to find trailing numeric sequence
    - Handle edge cases for IDs without numeric portions
    - Validate input parameters and return null for invalid inputs
    - _Requirements: 2.3, 2.4, 2.5, 4.3, 4.5_

  - [x] 2.2 Enhance constructor to auto-extract numeric_id
    - Modify constructor to automatically populate numeric_id from id parameter
    - Update all existing constructor calls to handle new property
    - _Requirements: 2.1, 4.3_

  - [x] 2.3 Update insert method to include numeric_id
    - Modify insert SQL to include numeric_id column
    - Update parameter binding to include numeric_id value
    - _Requirements: 2.1, 4.3_

  - [x] 2.4 Update updateCompanyInfo method for numeric_id consistency
    - Ensure numeric_id is recalculated if Id is ever updated
    - Add validation to maintain data consistency
    - _Requirements: 2.2, 4.3_

  - [x] 2.5 Add updateNumericId method for data consistency maintenance
    - Create method to recalculate and update numeric_id for existing records
    - Include proper error handling and validation
    - _Requirements: 2.2, 4.3_

  - [x] 2.6 Write unit tests for extraction logic and model enhancements
    - Test valid ID formats (SG COM-2001, SG COM-2002, etc.)
    - Test edge cases (no numbers, multiple numbers, invalid inputs)
    - Test null and undefined input handling
    - Test constructor auto-extraction functionality
    - Test insert method with numeric_id population
    - Test update scenarios maintaining numeric_id consistency
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.3_

- [x] 3. Enhance range query functionality
  - [x] 3.1 Update findByRange method to use numeric_id
    - Modify existing findByRange SQL query to use numeric_id column for sorting
    - Maintain backward compatibility with existing method signature
    - Improve query performance by leveraging numeric_id index
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 3.2 Add findByNumericRange method for direct numeric queries
    - Create new method accepting start and end numeric parameters
    - Implement efficient range queries using numeric_id column
    - Include proper error handling for invalid range parameters
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 3.3 Update getRecordsByRange method to use numeric_id sorting
    - Modify SQL query to use numeric_id column for consistent ordering
    - Ensure Excel export functionality benefits from numeric_id improvements
    - _Requirements: 3.1, 3.4_

  - [ ]* 3.4 Write integration tests for range query improvements
    - Test findByRange performance improvement with numeric_id
    - Test findByNumericRange functionality with various ranges
    - Compare query performance before and after implementation
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Run database migration and validate data integrity
  - [x] 4.1 Execute migration on development database
    - Run migration script to add numeric_id column
    - Verify column creation and index establishment
    - Validate data population for existing records
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1_

  - [x] 4.2 Validate extracted numeric_id values
    - Query sample records to verify numeric_id extraction accuracy
    - Check edge cases and problematic records identified during migration
    - Ensure data consistency between Id and numeric_id columns
    - _Requirements: 1.5, 4.1, 4.2, 4.5_

  - [ ]* 4.3 Create migration validation tests
    - Write tests to verify migration can be applied and rolled back
    - Test data population accuracy during migration
    - Test error handling for problematic records
    - _Requirements: 1.4, 4.1, 4.2_

- [x] 5. Update existing code to leverage numeric_id improvements
  - [x] 5.1 Review and update Excel export functionality
    - Verify getRecordsByRange method uses improved findByRange with numeric_id sorting
    - Ensure export range validation works with numeric_id improvements
    - Confirm export functionality benefits from numeric_id-based sorting
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Update database utility methods
    - Verify database.js query methods use numeric_id for sorting where appropriate
    - Ensure consistent ordering across all range-based operations
    - _Requirements: 3.1, 3.4_

  - [ ]* 5.3 Write end-to-end tests for updated functionality
    - Test complete workflows using numeric_id improvements
    - Verify Excel export functionality with numeric_id-based sorting
    - Test performance improvements in realistic scenarios
    - _Requirements: 3.1, 3.3, 3.4_