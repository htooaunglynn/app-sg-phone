# Design Document

## Overview

This design enhances the existing Excel export functionality in the ExcelExporter service by implementing comprehensive cell styling according to the specified requirements. The solution leverages the XLSX library's styling capabilities to apply consistent formatting, conditional formatting based on status values, and enhanced header styling.

## Architecture

### Current System Integration
The styling enhancements will be integrated into the existing `ExcelExporter` class in `src/services/excelExporter.js`. The current system already has:
- XLSX library (v0.18.5) with cell styling support enabled
- Existing `applyWorksheetFormatting()` method that applies basic formatting
- Status-based conditional formatting (currently using light colors)
- Header formatting with bold text and background colors

### Design Approach
The design follows a non-breaking enhancement approach:
1. **Extend existing formatting method**: Enhance `applyWorksheetFormatting()` to implement the new styling requirements
2. **Maintain backward compatibility**: Preserve existing functionality while adding new styling features
3. **Centralized styling configuration**: Create a styling configuration object for maintainability

## Components and Interfaces

### 1. Enhanced Styling Configuration

```javascript
const EXCEL_STYLING_CONFIG = {
  font: {
    name: 'Aptos Narrow',
    size: 12,
    color: { rgb: '000000' } // Black
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center'
  },
  statusFormatting: {
    false: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0000' } }, // Red
      font: { name: 'Aptos Narrow', size: 12, color: { rgb: '000000' } }
    },
    true: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, // White
      font: { name: 'Aptos Narrow', size: 12, color: { rgb: '000000' } }
    }
  },
  header: {
    font: { name: 'Aptos Narrow', size: 12, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  }
};
```

### 2. Enhanced applyWorksheetFormatting Method

The existing method will be enhanced to:
- Apply base font and alignment to all cells
- Implement status-based conditional formatting with exact color specifications
- Apply enhanced header formatting with bold text
- Maintain existing column width settings

### 3. Status Detection Logic

The system will identify status fields through:
- **Primary method**: Check for boolean `Status` field in record objects
- **Fallback method**: Detect status-like fields (boolean values in data)
- **Column mapping**: Support custom status column identification

## Data Models

### Cell Style Object Structure
```javascript
{
  font: {
    name: string,      // Font family name
    size: number,      // Font size in points
    bold: boolean,     // Bold formatting
    color: { rgb: string } // Font color in RGB hex
  },
  alignment: {
    horizontal: string, // 'center', 'left', 'right'
    vertical: string   // 'center', 'top', 'bottom'
  },
  fill: {
    patternType: string,    // 'solid'
    fgColor: { rgb: string } // Background color in RGB hex
  }
}
```

### Status Field Detection
```javascript
{
  fieldName: string,     // Name of the status field
  fieldIndex: number,    // Column index of status field
  dataType: 'boolean',   // Expected data type
  trueValues: ['true', 1, true],   // Values considered as true
  falseValues: ['false', 0, false] // Values considered as false
}
```

## Error Handling

### Font Availability Fallback
- **Primary**: Aptos Narrow font
- **Fallback 1**: Aptos (if Narrow variant unavailable)
- **Fallback 2**: Calibri (common Excel default)
- **Fallback 3**: Arial (universal fallback)

### Status Field Detection Errors
- Log warnings when status field cannot be identified
- Apply default formatting when status-based formatting fails
- Continue export process without conditional formatting if errors occur

### XLSX Library Compatibility
- Validate styling object structure before application
- Handle XLSX library version differences gracefully
- Provide fallback styling for unsupported features

## Testing Strategy

### Unit Tests
1. **Styling Configuration Tests**
   - Validate styling object structure
   - Test color code format validation
   - Verify font configuration completeness

2. **Status Detection Tests**
   - Test boolean status field identification
   - Validate status value interpretation (true/false)
   - Test fallback behavior for missing status fields

3. **Cell Formatting Tests**
   - Verify font application (family, size, color)
   - Test alignment settings (horizontal and vertical centering)
   - Validate conditional formatting based on status values

### Integration Tests
1. **Excel Generation Tests**
   - Generate Excel files with various status combinations
   - Verify styling persistence in generated files
   - Test with different record structures and status field locations

2. **Backward Compatibility Tests**
   - Ensure existing export functionality remains intact
   - Verify no regression in file generation performance
   - Test with existing test data and expected outputs

### Visual Validation Tests
1. **Manual Verification**
   - Generate sample Excel files for visual inspection
   - Verify font rendering in different Excel versions
   - Confirm color accuracy and alignment precision

2. **Automated Style Verification**
   - Parse generated Excel files to verify applied styles
   - Compare actual vs expected styling properties
   - Validate style consistency across all cells

## Implementation Considerations

### Performance Impact
- Styling operations add minimal overhead to existing export process
- XLSX library handles style optimization internally
- Memory usage increase is negligible for typical export sizes

### Browser and Excel Compatibility
- Aptos Narrow font is available in modern Office versions (2021+)
- Fallback fonts ensure compatibility with older Excel versions
- RGB color codes are universally supported across Excel versions

### Maintenance and Extensibility
- Centralized styling configuration enables easy updates
- Modular design allows for future styling enhancements
- Clear separation between data processing and styling logic

### Configuration Management
- Styling configuration can be externalized to config files if needed
- Environment-specific styling variations can be supported
- Runtime styling customization through options parameter