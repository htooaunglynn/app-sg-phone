# Design Document

## Overview

The numeric ID extraction feature adds a dedicated `numeric_id` column to the `check_table` to store extracted numeric values from the existing `Id` column. This enhancement improves query performance for range operations, sorting, and numeric-based filtering while maintaining backward compatibility with existing functionality.

## Architecture

### Database Schema Changes

The solution implements a database migration pattern following the existing migration structure:

```sql
ALTER TABLE check_table 
ADD COLUMN numeric_id INT NULL 
COMMENT 'Extracted numeric portion from Id column'
AFTER Id;

ALTER TABLE check_table 
ADD INDEX idx_numeric_id (numeric_id);
```

### Data Flow

1. **Migration Phase**: Extract numeric IDs from all existing records
2. **Runtime Phase**: Automatically extract numeric IDs for new/updated records
3. **Query Phase**: Use numeric_id column for range operations and sorting

## Components and Interfaces

### 1. Database Migration Component

**File**: `src/utils/migrations/002_add_numeric_id_column.js`

**Responsibilities**:
- Add numeric_id column to check_table
- Create database index for performance
- Populate existing records with extracted numeric values
- Provide rollback capability

**Key Methods**:
- `up()`: Apply migration and populate data
- `down()`: Rollback migration
- `isApplied()`: Check migration status
- `extractNumericId(idString)`: Extract numeric portion from ID

### 2. CheckTable Model Enhancement

**File**: `src/models/CheckTable.js`

**Enhancements**:
- Add numeric_id property to constructor
- Update insert/update methods to handle numeric_id
- Enhance findByRange to use numeric_id column
- Add numeric ID extraction utility methods

**New Methods**:
- `static extractNumericId(idString)`: Extract numeric portion from ID string
- `static findByNumericRange(startNum, endNum)`: Query by numeric ID range
- `updateNumericId()`: Update numeric_id for existing record

### 3. Extraction Logic Component

**Implementation**: Static utility methods within CheckTable class

**Algorithm**:
```javascript
static extractNumericId(idString) {
  if (!idString || typeof idString !== 'string') {
    return null;
  }
  
  // Extract trailing numeric sequence
  const match = idString.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
```

**Edge Cases Handled**:
- IDs without numeric portions → return null
- Multiple numeric sequences → extract only trailing sequence
- Non-string inputs → return null
- Leading zeros → preserve as integer (e.g., "0001" → 1)

## Data Models

### Enhanced CheckTable Schema

```sql
CREATE TABLE check_table (
  Id VARCHAR(100) NOT NULL PRIMARY KEY,
  numeric_id INT NULL COMMENT 'Extracted numeric portion from Id',
  Phone VARCHAR(50) NOT NULL,
  Status BOOLEAN NULL,
  CompanyName VARCHAR(255) NULL,
  PhysicalAddress TEXT NULL,
  Email VARCHAR(255) NULL UNIQUE,
  Website VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (Status),
  INDEX idx_email (Email),
  INDEX idx_numeric_id (numeric_id)
);
```

### CheckTable Model Properties

```javascript
class CheckTable {
  constructor(id, phone, status, companyName, physicalAddress, email, website) {
    this.id = id;
    this.numeric_id = CheckTable.extractNumericId(id); // Auto-extract
    this.phone = phone;
    this.status = status;
    // ... other properties
  }
}
```

## Error Handling

### Migration Error Handling

1. **Column Addition Failures**: Log error and halt migration
2. **Data Population Failures**: Log problematic records but continue processing
3. **Index Creation Failures**: Attempt to continue without index, log warning

### Runtime Error Handling

1. **Extraction Failures**: Set numeric_id to null, log warning
2. **Database Constraint Violations**: Propagate existing error handling
3. **Invalid Input Validation**: Return null for invalid inputs

### Error Logging Strategy

```javascript
// Migration logging
console.log(`Processing record ${id}: extracted ${numericId}`);
console.warn(`Failed to extract numeric ID from: ${id}`);

// Runtime logging  
console.warn(`Invalid ID format for numeric extraction: ${id}`);
```

## Testing Strategy

### Unit Tests

**File**: `tests/numeric-id-extraction.test.js`

**Test Categories**:
1. **Extraction Logic Tests**
   - Valid ID formats (SG COM-2001 → 2001)
   - Edge cases (no numbers, multiple numbers)
   - Invalid inputs (null, undefined, non-string)

2. **Model Integration Tests**
   - Constructor auto-extraction
   - Insert/update with numeric_id
   - Query methods using numeric_id

3. **Migration Tests**
   - Migration application and rollback
   - Data population accuracy
   - Error handling during migration

### Integration Tests

**File**: `tests/numeric-id-integration.test.js`

**Test Scenarios**:
1. **End-to-End Migration**: Apply migration to test database with sample data
2. **Performance Comparison**: Compare query performance before/after migration
3. **Data Consistency**: Verify numeric_id values match extracted values from Id column

### Performance Tests

**Metrics to Measure**:
- Query execution time for range operations
- Index utilization in query plans
- Memory usage during migration

**Test Data**:
- Small dataset (100 records)
- Medium dataset (10,000 records)  
- Large dataset (100,000+ records)

## Implementation Considerations

### Backward Compatibility

- Existing code continues to work unchanged
- New numeric_id column is nullable to handle edge cases
- Original Id column remains primary key
- Existing indexes and constraints preserved

### Performance Optimization

- Database index on numeric_id for fast range queries
- Batch processing during migration to handle large datasets
- Lazy loading approach for numeric_id population if needed

### Data Integrity

- Numeric_id values automatically synchronized with Id changes
- Validation ensures numeric_id matches extracted value from Id
- Migration includes verification step to ensure data consistency

### Scalability Considerations

- Migration designed to handle large datasets efficiently
- Batch processing with progress logging
- Memory-efficient extraction algorithm
- Index creation optimized for production environments