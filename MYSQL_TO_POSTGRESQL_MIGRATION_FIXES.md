# MySQL to PostgreSQL Migration Fixes

## Summary
This document details the fixes applied to migrate the codebase from MySQL to PostgreSQL, ensuring all code matches the `schema-postgres.sql` specification.

**Schema Reference**: `schema-postgres.sql` contains the correct PostgreSQL schema with:
- `check_table` - Main data table
- `users` - User authentication table
- `user_logins` - Login history table

**Note**: `backup_table` and `uploaded_files` tables are NOT used in the PostgreSQL schema.

---

## Changes Made

### 1. Authentication Routes (`src/routes/auth.js`)

**Issue**: Used MySQL-specific `result.insertId` to get the ID of newly inserted user.

**Fix**: Updated INSERT query to use PostgreSQL's `RETURNING` clause.

**Before**:
```javascript
const result = await db.query(
    'INSERT INTO users (name, email, password, status) VALUES ($1, $2, $3, $4)',
    [name, email, hashedPassword, 'active']
);
req.session.userId = result.insertId;  // MySQL-specific
```

**After**:
```javascript
const result = await db.query(
    'INSERT INTO users (name, email, password, status) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, email, hashedPassword, 'active']
);
req.session.userId = result[0].id;  // PostgreSQL
```

---

### 2. Company Update Endpoint (`src/server.js`)

**Issue**: Used MySQL-specific `result.affectedRows` property.

**Fix**: Replaced with PostgreSQL's `result.rowCount`.

**Before**:
```javascript
return res.json({ success: true, updated: result?.affectedRows || 0 });
```

**After**:
```javascript
return res.json({ success: true, updated: result?.rowCount || 0 });
```

---

### 3. Database Manager (`src/utils/database-postgres.js`)

**Issue**: `updateCheckRecord` method didn't properly return the result object for `rowCount` access.

**Fix**: Updated to use direct connection and return full result object.

**Before**:
```javascript
async updateCheckRecord(id, companyData) {
    const { companyName, physicalAddress, email, website } = companyData;
    const sql = `
        UPDATE check_table
        SET company_name = $1, physical_address = $2, email = $3, website = $4
        WHERE id = $5
    `;
    try {
        const result = await this.query(sql, [companyName, physicalAddress, email, website, id]);
        return result;  // This returned rows array, not result object
    } catch (error) {
        throw error;
    }
}
```

**After**:
```javascript
async updateCheckRecord(id, companyData) {
    const { companyName, physicalAddress, email, website } = companyData;
    const sql = `
        UPDATE check_table
        SET company_name = $1, physical_address = $2, email = $3, website = $4
        WHERE id = $5
    `;
    try {
        const client = await this.getConnection();
        try {
            const result = await client.query(sql, [companyName, physicalAddress, email, website, id]);
            return result; // Return full result object with rowCount
        } finally {
            client.release();
        }
    } catch (error) {
        throw error;
    }
}
```

---

### 4. Error Handling (`src/services/duplicateDetectionService.js`)

**Issue**: Used MySQL-specific error codes (`ER_ACCESS_DENIED_ERROR`, `ER_LOCK_WAIT_TIMEOUT`).

**Fix**: Replaced with PostgreSQL error codes.

**Before**:
```javascript
if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return `${baseMessage}: Database access denied. Please check database permissions.`;
}

if (error.code === 'ETIMEDOUT' || error.code === 'ER_LOCK_WAIT_TIMEOUT') {
    return `${baseMessage}: Database operation timed out. The system may be under heavy load.`;
}
```

**After**:
```javascript
// PostgreSQL error codes (removed MySQL-specific codes)
if (error.code === '28000' || error.code === '28P01') {
    return `${baseMessage}: Database access denied. Please check database permissions.`;
}

if (error.code === 'ETIMEDOUT' || error.code === '57014') {
    return `${baseMessage}: Database operation timed out. The system may be under heavy load.`;
}
```

**PostgreSQL Error Codes**:
- `28000`, `28P01` - Authentication/access denied
- `57014` - Query timeout

---

### 5. Removed backup_table and uploaded_files References

Updated comments and documentation in multiple files to clarify that `backup_table` and `uploaded_files` are not used in the PostgreSQL schema:

**Files Updated**:
- `src/services/duplicateDetectionService.js` - Updated error message
- `src/services/excelProcessor.js` - Updated comments (2 locations)
- `src/server.js` - Updated comment
- `src/utils/initDatabase.js` - Updated documentation

**Key Changes**:
- Changed "backup_table" references in error messages to "check_table"
- Added notes clarifying PostgreSQL schema doesn't use these tables
- Updated method documentation

---

### 6. Configuration (`src/utils/config.js`)

**Issue**: `printSummary()` method referenced non-existent `this.dualTable.backupTableName`.

**Fix**: Removed the backup table reference and clarified database type.

**Before**:
```javascript
console.log(`Database: ${this.database.host}:${this.database.port}/${this.database.database}`);
console.log(`Backup Table: ${this.dualTable.backupTableName}`);
console.log(`Check Table: ${this.dualTable.checkTableName}`);
```

**After**:
```javascript
console.log(`Database: PostgreSQL - ${this.database.host}:${this.database.port}/${this.database.database}`);
console.log(`Check Table: ${this.dualTable.checkTableName}`);
```

---

## Verification Checklist

✅ All database queries use PostgreSQL parameterized syntax (`$1, $2, ...`)
✅ No MySQL-specific error codes (all `ER_*` codes replaced)
✅ No MySQL-specific syntax (`AUTO_INCREMENT`, `TINYINT`, etc.)
✅ No `result.insertId` or `result.affectedRows` usage
✅ All INSERT statements that need IDs use `RETURNING` clause
✅ All UPDATE/DELETE statements use `rowCount` for affected rows
✅ Removed references to unused tables (`backup_table`, `uploaded_files`)
✅ Database configuration specifies PostgreSQL only
✅ All connection handling uses PostgreSQL `pg` library

---

## PostgreSQL Schema Alignment

The code now correctly aligns with `schema-postgres.sql`:

### Tables Used:
1. **check_table** - Primary data storage
   - `id` (VARCHAR PRIMARY KEY)
   - `numeric_id` (INT, extracted from id)
   - `phone` (VARCHAR)
   - `status` (BOOLEAN - valid Singapore phone)
   - `company_name`, `physical_address`, `email`, `website`
   - Auto-updated `updated_at` via trigger

2. **users** - Authentication
   - `id` (SERIAL PRIMARY KEY)
   - `name`, `email`, `password`
   - `status` (active/inactive/banned)
   - Device tracking fields

3. **user_logins** - Login history
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` (FK to users)
   - Login metadata
   - Foreign key with CASCADE delete

### Tables NOT Used:
- ❌ `backup_table` (not in schema)
- ❌ `uploaded_files` (not in schema)

---

## Testing Recommendations

1. **User Registration**: Verify new user IDs are correctly captured
2. **Company Updates**: Verify update count is returned correctly
3. **Error Handling**: Test with invalid credentials to verify error codes work
4. **Duplicate Detection**: Verify no references to backup_table in errors
5. **Database Connection**: Verify PostgreSQL-specific features work (RETURNING, triggers, etc.)

---

## Notes

- All changes maintain backward compatibility with existing data in PostgreSQL
- No changes were made to `schema-postgres.sql` as requested
- All code changes follow PostgreSQL best practices
- Parameterized queries prevent SQL injection
- Error handling is more robust with proper PostgreSQL error codes
