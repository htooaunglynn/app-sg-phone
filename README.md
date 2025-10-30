# Singapore Phone Detect

A web application that processes PDF and Excel files containing Singapore phone data, stores the extracted information in a MySQL database, and provides dynamic Excel export functionality.

## Features

- Upload PDF files with two-column data (identifiers and phone numbers)
- Upload Excel files with flexible column structures and multiple worksheets
- Intelligent worksheet detection and column mapping for Excel files
- Extract and validate Singapore phone data from both PDF and Excel sources
- Store data in MySQL database with duplicate prevention
- Export data to Excel files with custom range selection
- Web interface for easy interaction with both file types

## Prerequisites

- Node.js (v14 or higher)
- MySQL database
- npm or yarn package manager

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` file with your database credentials
5. Start the application:
   ```bash
   npm start
   ```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Project Structure

```
singapore-phone-detect/
├── src/
│   ├── controllers/    # Express.js route handlers
│   ├── services/       # Business logic services
│   ├── models/         # Data models and database schemas
│   └── utils/          # Utility functions
├── public/
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   └── index.html     # Main web interface
├── uploads/           # Temporary PDF file storage
├── exports/           # Generated Excel files
└── config/            # Configuration files
```

## API Endpoints

- `POST /upload` - Upload PDF or Excel file for processing
- `GET /export/:start/:end` - Export Excel file with specified range
- `GET /stats` - Get database statistics
- `GET /files` - List uploaded files (PDF and Excel)
- `GET /processing-status/:fileId` - Get processing status for uploaded files
- `GET /extraction-report/:fileId` - Get detailed extraction report for Excel files

## Excel File Processing

### Supported Excel Formats
- `.xlsx` (Excel 2007 and later)
- `.xls` (Excel 97-2003)

### Excel File Requirements
- Maximum file size: 10MB (configurable)
- Maximum worksheets per file: 10 (configurable)
- Maximum rows per worksheet: 10,000 (configurable)

### Excel Data Structure
The system intelligently detects and processes Excel files with:
- **Flexible column arrangements** - Phone numbers can be in any column
- **Multiple worksheets** - Automatically detects sheets containing phone data
- **Various header formats** - Recognizes common phone number headers (Phone, Mobile, Contact, Number, etc.)
- **Company information** - Extracts adjacent data like company names, emails, addresses
- **Multiple phone numbers per row** - Creates separate records for each phone number found

### Excel Processing Features
- **Automatic worksheet detection** - Identifies sheets with phone data
- **Intelligent column mapping** - Maps Excel columns to database fields
- **Data validation and cleaning** - Handles formatting, merged cells, duplicates
- **Detailed processing reports** - Shows extraction results and column mappings
- **Error handling** - Graceful handling of corrupted or complex Excel files

### Best Practices for Excel Files
1. **Use clear headers** - Include headers like "Phone", "Mobile", "Contact Number"
2. **Consistent data format** - Keep phone numbers in consistent format within columns
3. **Avoid merged cells** - Use separate cells for better data extraction
4. **Single data section** - Keep phone data in one continuous section per worksheet
5. **Include company info** - Add company names, emails in adjacent columns for context

## License

MIT