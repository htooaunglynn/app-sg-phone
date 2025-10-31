#!/bin/bash

# Duplicate Phone Styling Test Runner
# Runs comprehensive tests for duplicate phone detection and visual styling

set -e

echo "🧪 Running Duplicate Phone Styling Tests..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run from project root."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Create test results directory
mkdir -p test-results

print_status "Running unit tests for duplicate phone detection..."
if npm test -- --testPathPattern=duplicate-phone-detection.test.js --json --outputFile=test-results/unit-tests.json; then
    print_success "Unit tests passed!"
else
    print_error "Unit tests failed!"
    exit 1
fi

print_status "Running integration tests for duplicate styling workflow..."
if npm test -- --testPathPattern=duplicate-styling-integration.test.js --json --outputFile=test-results/integration-tests.json; then
    print_success "Integration tests passed!"
else
    print_error "Integration tests failed!"
    exit 1
fi

print_status "Running all duplicate styling tests with coverage..."
if npm test -- --testPathPattern="duplicate.*test.js" --coverage --coverageDirectory=test-results/coverage; then
    print_success "All tests passed with coverage report generated!"
else
    print_error "Some tests failed!"
    exit 1
fi

# Generate test summary
print_status "Generating test summary..."
cat > test-results/summary.md << EOF
# Duplicate Phone Styling Test Results

## Test Execution Summary

- **Date**: $(date)
- **Environment**: $(node --version)
- **Test Framework**: Jest

## Test Suites

### Unit Tests (duplicate-phone-detection.test.js)
- Phone number normalization accuracy
- Duplicate detection with various formats
- Orange color styling validation
- Error handling and graceful degradation
- System integration compatibility

### Integration Tests (duplicate-styling-integration.test.js)
- End-to-end workflow testing
- Web/Excel styling consistency
- Performance with large datasets
- Accessibility compliance
- Error recovery and resilience
- Cross-platform compatibility

## Coverage Report

Coverage report available in: \`test-results/coverage/\`

## Requirements Validation

✅ Requirement 1.1 - Web table orange highlighting
✅ Requirement 2.1 - Excel export orange highlighting  
✅ Requirement 3.1 - Consistent color usage
✅ Requirement 4.1 - System integration

## Performance Benchmarks

- Small datasets (< 100 records): < 100ms
- Medium datasets (100-1000 records): < 1 second
- Large datasets (1000-5000 records): < 5 seconds

## Next Steps

1. Review coverage report for any gaps
2. Run tests in different environments
3. Validate with real production data
4. Monitor performance in production

EOF

print_success "Test execution completed successfully!"
print_status "Results saved to test-results/ directory"
print_status "Coverage report: test-results/coverage/lcov-report/index.html"

echo ""
echo "📊 Test Summary:"
echo "================"
echo "✅ Unit Tests: PASSED"
echo "✅ Integration Tests: PASSED" 
echo "✅ Coverage Report: GENERATED"
echo "✅ All Requirements: VALIDATED"
echo ""
print_success "Duplicate phone styling tests completed successfully! 🎉"