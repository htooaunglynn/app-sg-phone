# Excel Processing Guide

This guide provides comprehensive information about uploading and processing Excel files containing Singapore phone data.

## Overview

The Singapore Phone Detect application supports processing Excel files alongside PDF files. The system intelligently detects phone data in Excel files, handles multiple worksheets, and maps columns automatically to extract phone numbers and associated company information.

## Supported Excel Formats

- **Excel 2007 and later**: `.xlsx` files
- **Excel 97-2003**: `.xls` files

## File Requirements and Limits

### File Size and Structure Limits
- **Maximum file size**: 10MB (configurable by administrator)
- **Maximum worksheets per file**: 10 worksheets
- **Maximum rows per worksheet**: 10,000 rows
- **Processing timeout**: 5 minutes per file

### Recommended File Structure
- Use clear, descriptive column headers
- Keep phone data in continuous sections (avoid scattered data)
- Include company information in adjacent columns
- Avoid excessive use of merged cells

## Excel Data Structure

### Phone Number Columns
The system automatically detects phone number columns using flexible pattern matching. It recognizes various header names including:
- Phone, Mobile, Contact, Number
- Phone Number, Mobile Number, Contact Number
- Tel, Telephone, Cell, Cellular
- Primary Phone, Secondary Phone
- And many other variations

### Company Information Columns
The system extracts additional information from adjacent columns:
- **Company Name**: Company, Business, Organization, Name
- **Email**: Email, Email Address, Contact Email
- **Address**: Address, Location, Office Address
- **Website**: Website, URL, Web Address

### ID Columns
The system identifies ID columns for record tracking:
- ID, Identifier, Record ID, Customer ID
- Number, Ref, Reference, Code
- If no ID column is found, sequential IDs are generated automatically

## Excel Processing Features

### Automatic Worksheet Detection
- **Multi-sheet support**: Processes all worksheets in a single Excel file
- **Smart detection**: Identifies worksheets containing phone data
- **Priority processing**: Processes worksheets with highest phone data confidence first
- **Worksheet metadata**: Preserves worksheet names in processing reports

### Intelligent Column Mapping
- **Flexible positioning**: Phone numbers can be in any column position
- **Header recognition**: Recognizes various header naming conventions
- **Pattern matching**: Uses advanced patterns to identify data types
- **Multiple phone columns**: Handles files with multiple phone number columns

### Data Validation and Cleaning
- **Format cleaning**: Removes formatting characters (spaces, dashes, parentheses)
- **Duplicate detection**: Identifies and handles duplicate phone numbers
- **Data validation**: Validates phone number formats before processing
- **Error handling**: Continues processing valid data when errors occur

### Multiple Phone Numbers per Row
- **Multi-phone support**: Creates separate records for each phone number in a row
- **Context preservation**: Maintains company information for each phone record
- **Relationship tracking**: Links multiple phone numbers to the same company

## Best Practices for Excel Files

### File Organization
1. **Use descriptive headers**: Include clear column headers like "Phone Number", "Company Name"
2. **Consistent formatting**: Keep phone numbers in consistent format within columns
3. **Single data section**: Keep all phone data in one continuous section per worksheet
4. **Avoid empty rows**: Minimize empty rows within data sections

### Data Quality
1. **Clean phone numbers**: Remove unnecessary formatting before upload
2. **Complete records**: Include company information where available
3. **Avoid merged cells**: Use separate cells for better data extraction
4. **Consistent data types**: Keep similar data in the same column

### File Structure
1. **Logical worksheet names**: Use descriptive names for worksheets containing data
2. **Primary data first**: Place main phone data in the first relevant worksheet
3. **Backup data**: Keep original files as backup before processing
4. **Test with small files**: Test processing with smaller files first

## Upload Process

### Step 1: File Selection
1. Navigate to the upload interface
2. Click "Choose File" or drag and drop your Excel file
3. Verify file type is .xlsx or .xls
4. Check file size is under the limit

### Step 2: Upload and Processing
1. Click "Upload" to start processing
2. Monitor processing status in real-time
3. Wait for processing completion (may take several minutes for large files)
4. Review processing results and extraction report

### Step 3: Review Results
1. Check extraction report for processing details
2. Review column mapping results
3. Verify phone numbers were extracted correctly
4. Check for any processing warnings or errors

## Processing Reports

### Extraction Report
The system provides detailed extraction reports including:
- **Worksheets processed**: List of worksheets containing phone data
- **Column mapping**: How Excel columns were mapped to database fields
- **Processing statistics**: Total rows, valid records, phone numbers found
- **Data quality metrics**: Duplicates removed, validation results

### Processing Status
Real-time processing status includes:
- **Upload progress**: File upload completion
- **Processing stage**: Current processing step
- **Completion percentage**: Overall progress indicator
- **Estimated time**: Remaining processing time

## Error Handling and Troubleshooting

### Common Issues and Solutions

#### File Upload Errors
- **File too large**: Reduce file size or split into multiple files
- **Invalid format**: Ensure file is .xlsx or .xls format
- **Corrupted file**: Try opening file in Excel and re-saving

#### Processing Errors
- **No phone data found**: Check column headers and data format
- **Processing timeout**: Reduce file size or worksheet count
- **Memory issues**: Split large files into smaller chunks

#### Data Quality Issues
- **Missing phone numbers**: Verify phone data is in recognizable format
- **Incorrect column mapping**: Use clearer column headers
- **Duplicate records**: Review duplicate handling in processing report

### Getting Help
1. **Check processing report**: Review detailed extraction report for issues
2. **Verify file format**: Ensure Excel file meets requirements
3. **Test with sample data**: Try processing with a smaller sample file
4. **Contact support**: Provide processing report and file details

## Integration with Singapore Phone Validation

### Validation Process
After Excel processing, phone numbers go through the same validation as PDF data:
1. **Format validation**: Checks Singapore phone number format
2. **Number validation**: Validates using libphonenumber-js library
3. **Database storage**: Stores validated data in check_table
4. **Status tracking**: Tracks validation status for each number

### Dual-Table Architecture
Excel data follows the same workflow as PDF data:
- **Backup table**: Raw extracted data stored permanently
- **Check table**: Validated data with Singapore phone status
- **Data integrity**: Maintains consistency across all data sources

## Performance Considerations

### File Size Optimization
- **Split large files**: Break files with >5,000 rows into smaller files
- **Remove unnecessary data**: Delete unused columns and worksheets
- **Optimize formatting**: Remove complex formatting and merged cells

### Processing Efficiency
- **Sequential processing**: Process one file at a time for best performance
- **Monitor resources**: Check system resources during processing
- **Batch processing**: Consider processing multiple small files vs. one large file

## Security and Privacy

### File Security
- **Secure upload**: Files uploaded over secure connections
- **Temporary storage**: Processing files stored temporarily and cleaned up
- **Access control**: Only authorized users can upload and process files

### Data Privacy
- **Data retention**: Original files stored securely for reference
- **Processing logs**: Detailed logs for audit and troubleshooting
- **Data cleanup**: Temporary processing files automatically removed

## Advanced Features

### Custom Column Mapping
For complex Excel files, the system provides:
- **Flexible mapping**: Adapts to various column arrangements
- **Pattern recognition**: Uses advanced patterns for data detection
- **Manual override**: Option to specify column mappings if needed

### Batch Processing
- **Multiple files**: Process multiple Excel files in sequence
- **Progress tracking**: Monitor progress across multiple files
- **Consolidated reporting**: Combined reports for batch processing

### Export Integration
Processed Excel data integrates with existing export features:
- **Excel export**: Export processed data to new Excel files
- **Range selection**: Export specific ranges of processed data
- **Format preservation**: Maintain data formatting in exports

## Conclusion

The Excel processing feature provides powerful capabilities for extracting Singapore phone data from Excel files. By following the best practices and guidelines in this document, you can ensure efficient and accurate processing of your Excel data.

For additional support or questions about Excel processing, refer to the processing reports and system documentation.