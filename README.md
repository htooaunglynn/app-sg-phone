****# Singapore Phone Detect

A comprehensive web application that processes PDF and Excel files containing Singapore phone data, stores the extracted information in a MySQL database, and provides dynamic Excel export functionality with intelligent data processing capabilities.

## 🚀 Features

- **Multi-format File Processing**: Upload PDF and Excel files with flexible data structures
- **Intelligent Data Extraction**: Automatic worksheet detection and column mapping for Excel files
- **Singapore Phone Validation**: Extract and validate Singapore phone numbers using libphonenumber-js
- **Dual Database Tables**: Separate storage for raw phone records and enriched company data
- **Advanced Export System**: Export data to Excel with custom range selection and styling
- **Web Interface**: User-friendly interface for file management and data interaction
- **Docker Support**: Complete containerized deployment with MySQL and optional services
- **Comprehensive Testing**: Full test suite with accessibility and integration tests

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn** package manager
- **Docker** and **Docker Compose** (optional, for containerized deployment)

## 🛠️ Installation

### Option 1: Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd singapore-phone-detect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment configuration**
   ```bash
   cp .env.example .env
   ```

4. **Configure your database settings in `.env`**
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=singapore_phone_db
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

5. **Create required directories**
   ```bash
   npm run setup
   ```

6. **Start the application**
   ```bash
   npm start
   ```

### Option 2: Docker Deployment

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd singapore-phone-detect
   cp .env.example .env
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **For production with Nginx**
   ```bash
   docker-compose --profile production up -d
   ```

## 🗄️ Database Setup

### Automatic Schema Creation
The application automatically creates all required database tables on startup. However, you can also set up the database manually using the provided SQL schema file.

### Manual Database Setup
For manual database setup or fresh installations, use the provided `setup.sql` file:

#### Method 1: Direct MySQL Execution
```bash
# Create database first (if needed)
mysql -u root -p -e "CREATE DATABASE singapore_phone_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run the schema setup
mysql -u root -p singapore_phone_db < setup.sql
```

#### Method 2: From MySQL Command Line
```bash
mysql -u root -p
```
```sql
-- Create database
CREATE DATABASE singapore_phone_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE singapore_phone_db;

-- Run the setup script
source setup.sql;
```

#### Method 3: Using MySQL Workbench or phpMyAdmin
1. Create a new database named `singapore_phone_db`
2. Import the `setup.sql` file through the interface
3. Execute the script to create all tables and structures

### Database Schema Overview
The `setup.sql` file creates the following components:

#### Core Tables
- **`backup_table`** - Immutable storage for raw data from file uploads
- **`check_table`** - Enhanced table with company information and validation status
- **`uploaded_files`** - Tracks file uploads and processing status

#### Additional Components
- **Views** for reporting and statistics
- **Stored procedures** for common database operations
- **Indexes** for optimal query performance
- **Constraints** for data validation and integrity

### Key Tables Structure

#### backup_table Table
```sql
CREATE TABLE backup_table (
  Id VARCHAR(100) NOT NULL,
  Phone VARCHAR(50) NOT NULL,
  CompanyName VARCHAR(255) NULL,
  PhysicalAddress TEXT NULL,
  Email VARCHAR(255) NULL,
  Website VARCHAR(255) NULL,
  source_file VARCHAR(255) NULL,
  extracted_metadata TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### check_table Table
```sql
CREATE TABLE check_table (
  Id VARCHAR(100) NOT NULL PRIMARY KEY,
  Phone VARCHAR(50) NOT NULL,
  Status BOOLEAN NULL,
  CompanyName VARCHAR(255) NULL,
  PhysicalAddress TEXT NULL,
  Email VARCHAR(255) NULL UNIQUE,
  Website VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (Status),
  INDEX idx_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Database User Setup
Create a dedicated database user for the application:

```sql
-- Create application user
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
CREATE USER 'app_user'@'%' IDENTIFIED BY 'secure_password';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON singapore_phone_db.* TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON singapore_phone_db.* TO 'app_user'@'%';

-- Grant procedure execution permissions
GRANT EXECUTE ON singapore_phone_db.* TO 'app_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;
```

## 🔧 Development

### Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Health Check
```bash
npm run health-check
```

## 📁 Project Structure

```
singapore-phone-detect/
├── src/
│   ├── app.js              # Main application entry point
│   ├── controllers/        # Express.js route handlers
│   ├── services/          # Business logic services
│   ├── models/            # Data models and database schemas
│   │   └── CheckTable.js  # Enhanced records with company data
│   ├── routes/            # API route definitions
│   ├── utils/             # Utility functions and helpers
│   └── monitoring/        # Application monitoring and logging
├── public/
│   ├── css/              # Stylesheets and themes
│   ├── js/               # Client-side JavaScript
│   ├── index.html        # Main web interface
│   ├── file-manager.html # File management interface
│   └── extraction-report.html # Data extraction reports
├── uploads/              # File upload storage
│   ├── temp/            # Temporary processing files
│   ├── pdf/             # PDF file storage
│   └── excel/           # Excel file storage
├── exports/              # Generated Excel export files
├── logs/                 # Application logs
├── tests/                # Comprehensive test suite
├── scripts/              # Deployment and utility scripts
├── config/               # Configuration files
│   ├── mysql.cnf        # MySQL configuration
│   └── nginx.conf       # Nginx configuration
├── docker-compose.yml    # Docker deployment configuration
├── Dockerfile           # Container build instructions
└── .env.example         # Environment variables template
```

## 🔌 API Endpoints

### File Processing
- `POST /upload` - Upload PDF or Excel file for processing
- `GET /files` - List uploaded files with metadata
- `GET /processing-status/:fileId` - Get real-time processing status
- `GET /extraction-report/:fileId` - Detailed extraction report for Excel files

### Data Export
- `GET /export/:start/:end` - Export Excel file with specified record range
- `GET /export/check-table/:start/:end` - Export from check_table with company data

### Statistics & Monitoring
- `GET /stats` - Database statistics and record counts
- `GET /health` - Application health check endpoint
- `GET /api/stats/detailed` - Detailed statistics for both tables

## 📊 Excel File Processing

### Supported Formats
- **`.xlsx`** (Excel 2007 and later)
- **`.xls`** (Excel 97-2003)

### File Requirements
- **Maximum file size**: 10MB (configurable via `MAX_FILE_SIZE`)
- **Maximum worksheets**: 10 per file (configurable via `EXCEL_MAX_WORKSHEETS`)
- **Maximum rows**: 10,000 per worksheet (configurable via `EXCEL_MAX_ROWS_PER_SHEET`)
- **Processing timeout**: 5 minutes (configurable via `EXCEL_PROCESSING_TIMEOUT`)

### Intelligent Processing Features
- **🔍 Automatic worksheet detection** - Identifies sheets containing phone data
- **🗂️ Flexible column mapping** - Phone numbers can be in any column position
- **📋 Header recognition** - Recognizes various phone headers (Phone, Mobile, Contact, Number, etc.)
- **🏢 Company data extraction** - Captures company names, emails, addresses, websites
- **🔄 Duplicate handling** - Prevents duplicate entries with smart merging
- **📈 Real-time progress** - Processing status updates and detailed reports

### Data Validation
- **Singapore phone format**: Validates against pattern `^[689]\d{7}$`
- **Email validation**: RFC-compliant email format checking
- **URL validation**: Website URL format verification
- **Data cleaning**: Handles merged cells, formatting inconsistencies

### Best Practices for Excel Files
1. **📝 Clear headers** - Use recognizable headers like "Phone", "Mobile", "Contact Number"
2. **📐 Consistent formatting** - Maintain uniform phone number formats within columns
3. **🚫 Avoid merged cells** - Use separate cells for optimal data extraction
4. **📍 Organized layout** - Keep related data in continuous sections
5. **🏢 Include context** - Add company information in adjacent columns

## 🌐 Environment Variables

Key configuration options in your `.env` file:

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=singapore_phone_db
DB_USER=app_user
DB_PASSWORD=secure_password
```

### Server Configuration
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

### File Processing
```env
MAX_FILE_SIZE=10485760          # 10MB
EXCEL_MAX_WORKSHEETS=10
EXCEL_MAX_ROWS_PER_SHEET=10000
EXCEL_PROCESSING_TIMEOUT=300000  # 5 minutes
```

### Security
```env
SESSION_SECRET=your-secret-key
CSRF_SECRET=your-csrf-secret
ENABLE_AUTH=true
RATE_LIMIT_MAX=100
```

## 🐳 Docker Deployment

### Basic Deployment
```bash
docker-compose up -d
```

### Production with Nginx
```bash
docker-compose --profile production up -d
```

### Scaling with Redis
```bash
docker-compose --profile scaling up -d
```

## 🧪 Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- --testNamePattern="duplicate"
npm test -- --testNamePattern="accessibility"
npm test -- --testNamePattern="integration"
```

### Test Coverage
- **Unit tests** - Model and service layer testing
- **Integration tests** - API endpoint testing
- **Accessibility tests** - WCAG compliance verification
- **Visual regression** - UI consistency testing
- **Performance tests** - Load and stress testing

## 🚀 Production Deployment

### Prerequisites
1. **Server Requirements**
   - Ubuntu 20.04+ or CentOS 8+
   - 2GB+ RAM
   - 10GB+ storage
   - Node.js 14+, MySQL 8.0+

2. **Security Setup**
   - Configure firewall (ports 80, 443, 3000)
   - Set up SSL certificates
   - Configure secure environment variables

### Deployment Steps
1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd singapore-phone-detect
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Install dependencies**
   ```bash
   npm ci --production
   ```

3. **Database setup**
   ```bash
   # Create database and user
   mysql -u root -p
   CREATE DATABASE singapore_phone_db;
   CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON singapore_phone_db.* TO 'app_user'@'localhost';
   ```

4. **Start application**
   ```bash
   npm run start:prod
   ```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the [documentation files](./EXCEL_PROCESSING_GUIDE.md) for detailed guides
- Review the [system architecture](./SYSTEM_ARCHITECTURE.md) for technical details

## 📚 Additional Documentation

- [Excel Processing Guide](./EXCEL_PROCESSING_GUIDE.md) - Detailed Excel processing documentation
- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Technical architecture overview
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Production Checklist](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
