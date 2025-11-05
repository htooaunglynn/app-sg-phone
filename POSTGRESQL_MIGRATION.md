# PostgreSQL Migration Complete

This project has been successfully migrated from MySQL to PostgreSQL.

## What Changed

### 1. **Database System**
- **Before**: Dual database support (MySQL for development, PostgreSQL for production)
- **After**: PostgreSQL only (for both development and production)

### 2. **Dependencies Removed**
- `mysql2` package has been uninstalled
- All MySQL-specific code has been removed

### 3. **Database Adapter**
- `src/utils/database.js` now directly exports the PostgreSQL database manager
- `src/utils/database-mysql-backup.js` contains the old MySQL implementation (for reference only)

### 4. **Configuration Updates**
- `.env` file updated to use PostgreSQL exclusively
- `src/utils/config.js` simplified to remove MySQL configuration
- `package.json` scripts updated:
  - `npm run dev` - Start development server with PostgreSQL
  - `npm run init:db` - Initialize PostgreSQL database
  - Removed: `dev:mysql`, `dev:postgres`, `init:postgres`

### 5. **Database Schema**
- `schema-postgres.sql` now includes all tables:
  - `backup_table` - Immutable storage for raw data
  - `check_table` - Editable table for validated phone data
  - `uploaded_files` - File metadata tracking
  - `users` - User authentication
  - `user_logins` - Login tracking
- `schema.sql` - Old MySQL schema (kept for reference)

## Database Setup

### Prerequisites
1. PostgreSQL 14+ installed and running
2. Environment variables configured in `.env`:
   ```env
   DB_TYPE=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=singapore_phone_db
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

### Initialize Database

```bash
# Initialize the PostgreSQL database
npm run init:db
```

This will:
1. Create the database if it doesn't exist
2. Create all tables with proper indexes
3. Set up triggers for auto-updating timestamps

### Verify Setup

```bash
# Connect to PostgreSQL
psql -U your_username -d singapore_phone_db

# List all tables
\dt

# Check table structure
\d backup_table
\d check_table
\d uploaded_files

# Exit
\q
```

## Key Differences from MySQL

### 1. **SQL Syntax**
- Parameter placeholders: `$1, $2, $3` instead of `?`
- Boolean type: `BOOLEAN` instead of `TINYINT(1)`
- Auto-increment: `SERIAL` instead of `AUTO_INCREMENT`
- Enums: Check constraints instead of `ENUM` type
- String concatenation: `||` instead of `CONCAT()`

### 2. **Triggers**
PostgreSQL requires explicit trigger functions:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_backup_update_timestamp
BEFORE UPDATE ON backup_table
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### 3. **Case Sensitivity**
- PostgreSQL is case-sensitive for column names
- We use quoted identifiers for mixed-case columns: `"Id"`, `"Phone"`, etc.

### 4. **Upsert (ON CONFLICT)**
PostgreSQL uses `ON CONFLICT` for duplicate handling:
```sql
INSERT INTO backup_table (...)
VALUES (...)
ON CONFLICT ("Id") DO UPDATE SET ...
```

## Database Manager Features

The PostgreSQL database manager (`src/utils/database-postgres.js`) includes:

### Connection Management
- Connection pooling with retry logic
- Automatic reconnection on failure
- Configurable timeouts and limits

### Core Operations
- `query()` - Execute queries with parameter binding
- `transaction()` - Execute multiple queries in a transaction
- `connect()` / `close()` - Connection lifecycle management

### Backup Table Operations
- `insertBackupRecord()` - Insert raw data
- `insertBackupRecordWithMetadata()` - Insert with metadata
- `insertBackupRecordWithCompany()` - Insert with company info
- `insertBatchWithDuplicateHandling()` - Batch insert with conflict resolution
- `getBackupRecords()` - Retrieve records with pagination

### Check Table Operations
- `insertCheckRecord()` - Insert validated data
- `updateCheckRecord()` - Update company information
- `getCheckRecords()` - Retrieve with pagination
- `getCheckRecordsCount()` - Get total count
- `getCheckRecordsByRange()` - Export range queries

### File Tracking
- `insertFileMetadata()` - Track uploaded files
- `updateFileProcessingStatus()` - Update processing status
- `getUploadedFiles()` - List files with filtering
- `getFileStats()` - Get processing statistics

### Duplicate Detection
- `isDuplicateId()` - Check single ID
- `batchCheckDuplicateIds()` - Batch duplicate checking
- `optimizedDuplicateDetection()` - Optimized detection with metrics

## Performance Optimizations

### 1. **Indexes**
All tables have appropriate indexes for:
- Primary keys
- Foreign keys
- Frequently queried columns
- Sort and filter columns

### 2. **Connection Pooling**
```javascript
{
  max: 20,                          // Maximum connections
  idleTimeoutMillis: 300000,        // 5 minutes
  connectionTimeoutMillis: 60000    // 1 minute
}
```

### 3. **Batch Operations**
- Batch inserts use transactions
- Chunk-based processing for large datasets
- Duplicate detection in batches of 1000

### 4. **Query Optimization**
- Prepared statements for repeated queries
- Index-based lookups
- Efficient JOIN operations

## Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will:
1. Connect to PostgreSQL on startup
2. Verify database connectivity
3. Initialize tables if needed (in development)
4. Start the Express server

## Production Deployment

### Environment Variables
For production (e.g., Render, Heroku):
```env
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
DB_SSL=true
```

The database manager automatically handles:
- SSL connections
- Connection string parsing
- Environment-specific configuration

### Database Initialization
On first deployment, run:
```bash
npm run init:db
```

## Troubleshooting

### Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -U your_username -d singapore_phone_db -c "SELECT version();"
```

### Permission Issues
```bash
# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE singapore_phone_db TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

### Schema Issues
If tables are missing or outdated:
```bash
# Recreate database
psql -U your_username -d postgres -c "DROP DATABASE IF EXISTS singapore_phone_db;"
npm run init:db
```

## Migration Notes

### Data Migration (if needed)
If you have existing MySQL data to migrate:

1. **Export from MySQL**:
   ```bash
   mysqldump -u root -p singapore_phone_db > mysql_dump.sql
   ```

2. **Convert to PostgreSQL** (manual adjustments needed):
   - Replace `AUTO_INCREMENT` with `SERIAL`
   - Replace `TINYINT(1)` with `BOOLEAN`
   - Replace backticks with double quotes
   - Adjust date/time functions

3. **Import to PostgreSQL**:
   ```bash
   psql -U your_username -d singapore_phone_db < converted_dump.sql
   ```

### Backup Files
The following files are kept for reference:
- `src/utils/database-mysql-backup.js` - Original MySQL implementation
- `schema.sql` - Original MySQL schema

These can be removed once migration is confirmed successful.

## Next Steps

1. ✅ Test all application features
2. ✅ Verify data operations (insert, update, query)
3. ✅ Test file uploads and processing
4. ✅ Verify authentication system
5. ⬜ Remove backup files (after confirmation)
6. ⬜ Update deployment documentation
7. ⬜ Deploy to production

## Support

For PostgreSQL-specific issues:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)

For application issues:
- Check logs for connection errors
- Verify environment variables
- Ensure PostgreSQL is running and accessible
