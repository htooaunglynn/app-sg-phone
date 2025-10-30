# Design Document

## Overview

The duplicate entry handling system will enhance the existing file processing workflow to gracefully handle records with IDs that already exist in the backup_table. The design focuses on pre-insertion duplicate detection, comprehensive logging, and maintaining data integrity while providing detailed feedback to users about duplicate handling results.

## Architecture

The duplicate handling system will integrate into the existing file processing pipeline at the database insertion layer. It will implement a check-before-insert pattern that validates each record against existing backup_table entries before attempting insertion.

### Key Components

1. **Duplicate Detection Service**: Pre-insertion validation against backup_table
2. **Batch Processing Manager**: Enhanced batch handling with duplicate awareness
3. **Duplicate Reporting Service**: Comprehensive logging and reporting of duplicate entries
4. **Database Transaction Manager**: Safe handling of mixed success/duplicate scenarios

## Components and Interfaces

### DuplicateDetectionService

```javascript
class DuplicateDetectionService {
  async checkForDuplicates(records)
  async isDuplicateId(id)
  async filterNewRecords(records)
  generateDuplicateReport(duplicates, sourceFile)
}
```

**Responsibilities:**
- Query backup_table to identify existing IDs
- Filter incoming records to separate new records from duplicates
- Generate detailed duplicate reports with metadata
- Maintain duplicate statistics during processing

### EnhancedBatchProcessor

```javascript
class EnhancedBatchProcessor {
  async processBatchWithDuplicateHandling(records, sourceFile)
  async insertNewRecordsOnly(newRecords)
  handleDuplicateEntries(duplicates)
  generateProcessingSummary(results)
}
```

**Responsibilities:**
- Coordinate duplicate detection with batch insertion
- Handle mixed batches containing both new and duplicate records
- Maintain processing statistics and success/failure counts
- Ensure transaction integrity during batch processing

### DuplicateReportingService

```javascript
class DuplicateReportingService {
  logDuplicateEntry(duplicateRecord, sourceFile)
  generateDuplicateSummary(processingResults)
  updateExtractionMetadata(metadata, duplicateInfo)
  createDuplicateReport(duplicates, processingStats)
}
```

**Responsibilities:**
- Log individual duplicate entries with full context
- Generate summary reports for user feedback
- Update extraction metadata with duplicate information
- Provide detailed duplicate analysis for troubleshooting

## Data Models

### ProcessingResult

```javascript
{
  totalRecords: number,
  newRecordsStored: number,
  duplicatesSkipped: number,
  duplicatePercentage: number,
  duplicateEntries: [
    {
      id: string,
      phone: string,
      sourceFile: string,
      existingFile: string,
      timestamp: Date
    }
  ],
  processingTime: number,
  success: boolean
}
```

### DuplicateEntry

```javascript
{
  id: string,
  phone: string,
  sourceFile: string,
  attemptedTimestamp: Date,
  existingRecordMetadata: {
    originalSourceFile: string,
    originalTimestamp: Date
  }
}
```

## Error Handling

### Duplicate Detection Errors

- **Database Query Failures**: Fallback to individual record checking if batch duplicate detection fails
- **Memory Constraints**: Implement streaming duplicate detection for large files
- **Transaction Failures**: Rollback failed batches while preserving successful insertions

### Processing Errors

- **Partial Batch Failures**: Continue processing remaining batches if one batch fails
- **Constraint Violations**: Catch database constraint errors and treat as duplicate entries
- **Metadata Corruption**: Ensure duplicate reporting continues even if metadata updates fail

## Testing Strategy

### Unit Tests

- Test duplicate detection with various ID formats and edge cases
- Verify batch processing handles mixed new/duplicate records correctly
- Test duplicate reporting generates accurate statistics and logs
- Validate transaction handling maintains data integrity

### Integration Tests

- Test complete workflow with files containing known duplicates
- Verify duplicate handling works with existing Excel and PDF processing
- Test performance with large files containing high duplicate percentages
- Validate user interface displays duplicate information correctly

### Performance Tests

- Benchmark duplicate detection performance with large backup_table datasets
- Test memory usage with files containing thousands of duplicate entries
- Validate batch processing performance doesn't degrade with duplicate handling
- Test concurrent file processing with duplicate detection enabled

## Implementation Approach

### Phase 1: Core Duplicate Detection

1. Implement DuplicateDetectionService with basic ID checking
2. Add duplicate filtering to existing batch processing
3. Create basic duplicate logging and reporting
4. Update database insertion logic to handle duplicates gracefully

### Phase 2: Enhanced Reporting

1. Implement comprehensive duplicate reporting with metadata
2. Add duplicate statistics to extraction reports
3. Update user interface to display duplicate information
4. Create detailed duplicate analysis for troubleshooting

### Phase 3: Performance Optimization

1. Optimize duplicate detection queries for large datasets
2. Implement streaming duplicate detection for memory efficiency
3. Add caching for frequently checked IDs
4. Optimize batch processing for high-duplicate scenarios

## Integration Points

### Existing Excel Processor

- Integrate duplicate detection before backup_table insertion
- Update extraction metadata to include duplicate information
- Modify batch processing to handle duplicate filtering
- Enhance error handling to treat duplicates as expected behavior

### Existing Database Layer

- Add duplicate detection queries to database utilities
- Update transaction handling for mixed success/duplicate scenarios
- Modify backup_table insertion to skip duplicates gracefully
- Enhance logging to capture duplicate entry attempts

### User Interface

- Update upload progress to show duplicate handling status
- Display duplicate statistics in processing results
- Add duplicate information to file processing reports
- Show duplicate percentage in upload success messages

## Security Considerations

- Ensure duplicate detection queries don't expose sensitive data
- Validate that duplicate logging doesn't create information leakage
- Maintain audit trail for duplicate handling decisions
- Ensure duplicate detection doesn't bypass existing security validations

## Performance Considerations

- Use efficient database queries for duplicate detection (indexed lookups)
- Implement batch duplicate checking to minimize database round trips
- Consider caching recently checked IDs to improve performance
- Monitor memory usage during duplicate detection for large files

## Monitoring and Observability

- Log duplicate detection performance metrics
- Track duplicate percentages across different file sources
- Monitor database query performance for duplicate detection
- Alert on unusual duplicate patterns that might indicate data issues