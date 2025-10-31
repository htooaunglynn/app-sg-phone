# Duplicate Phone Styling Tests

This directory contains comprehensive tests for the duplicate phone number detection and visual styling functionality.

## Test Structure

### Unit Tests (`duplicate-phone-detection.test.js`)
- **Phone Number Normalization**: Tests various Singapore phone formats and normalization accuracy
- **Duplicate Detection Accuracy**: Tests identification of duplicate phone numbers with different formats
- **Orange Color Styling**: Tests consistent orange color application in both web and Excel interfaces
- **Error Handling**: Tests graceful degradation when processing fails
- **Integration Compatibility**: Tests that duplicate styling doesn't conflict with existing systems

### Integration Tests (`duplicate-styling-integration.test.js`)
- **End-to-End Workflow**: Tests complete workflow from detection to visual styling
- **Web/Excel Consistency**: Verifies identical styling between web table and Excel export
- **Performance Testing**: Tests with large datasets containing many duplicates
- **Accessibility Compliance**: Validates color contrast and screen reader compatibility
- **Error Recovery**: Tests resilience when partial processing failures occur
- **Cross-Platform Compatibility**: Ensures styling works across different browsers and Excel versions

## Running Tests

### Run All Duplicate Styling Tests
```bash
npm test -- --testPathPattern="duplicate.*test.js"
```

### Run Unit Tests Only
```bash
npm test -- --testPathPattern=duplicate-phone-detection.test.js
```

### Run Integration Tests Only
```bash
npm test -- --testPathPattern=duplicate-styling-integration.test.js
```

### Run with Coverage
```bash
npm test -- --testPathPattern="duplicate.*test.js" --coverage
```

### Run in Watch Mode
```bash
npm test -- --testPathPattern="duplicate.*test.js" --watch
```

## Test Coverage

The tests cover the following requirements from the specification:

### Requirement 1.1 - Web Table Orange Highlighting
- ✅ Tests orange background color application to duplicate phone records
- ✅ Tests consistent styling across all duplicate entries
- ✅ Tests normal styling for non-duplicate records

### Requirement 2.1 - Excel Export Orange Highlighting
- ✅ Tests orange cell background in Excel exports
- ✅ Tests entire row highlighting for duplicate records
- ✅ Tests mixed duplicate/unique record handling

### Requirement 3.1 - Consistent Color Usage
- ✅ Tests identical orange color (#FFA500) in web and Excel
- ✅ Tests text readability with appropriate contrast
- ✅ Tests color validation and consistency checks

### Requirement 4.1 - System Integration
- ✅ Tests compatibility with existing Excel styling
- ✅ Tests integration with current table functionality
- ✅ Tests graceful error handling and fallbacks

## Test Data

Tests use realistic phone number formats including:
- International format: `+65 9123 4567`
- Local format: `91234567`
- Hyphenated format: `9123-4567`
- Bracketed format: `(65) 9123 4567`
- Various spacing and formatting variations

## Performance Benchmarks

- Small datasets (< 100 records): < 100ms
- Medium datasets (100-1000 records): < 1 second
- Large datasets (1000-5000 records): < 5 seconds
- Very large datasets (5000+ records): < 10 seconds

## Accessibility Testing

Tests validate:
- Color contrast ratio compliance (4.5:1 minimum)
- Alternative indicators beyond color
- Screen reader compatibility
- High contrast mode support

## Error Scenarios Tested

- Invalid phone number formats
- Missing record IDs
- Null/undefined records
- Processing timeouts
- Memory constraints
- Database connection failures
- Styling application errors

## Continuous Integration

These tests are designed to run in CI/CD pipelines and will:
- Fail if duplicate detection accuracy drops below 95%
- Fail if performance degrades beyond acceptable thresholds
- Fail if color consistency is broken
- Fail if accessibility standards are not met
- Provide detailed error reporting for debugging

## Troubleshooting

### Common Issues

1. **Tests failing due to phone normalization**: Check that the normalization configuration matches expectations
2. **Performance tests timing out**: Increase timeout values or reduce dataset sizes
3. **Color validation failures**: Ensure color constants are properly imported
4. **Mock database errors**: Verify database mocks are properly configured

### Debug Mode

Run tests with additional logging:
```bash
DEBUG=true npm test -- --testPathPattern="duplicate.*test.js"
```

### Test Environment

Tests run in Node.js environment with:
- Jest test framework
- Mocked browser APIs
- Mocked database connections
- Fake timers for performance testing