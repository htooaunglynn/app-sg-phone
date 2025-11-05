# Column Name Case Sensitivity Fix

## Problem

The database schema uses **lowercase** column names:
- `id`, `phone`, `status`, `company_name`, `physical_address`, `email`, `website`

But the application code was using **mixed case** column names:
- `Id`, `Phone`, `Status`, `CompanyName`, `PhysicalAddress`, `Email`, `Website`

This caused issues where:
- `Status` field was not being read correctly from the database
- Phone validation (`isValidSingaporePhone`) was not matching the actual `status` value
- All rows appeared red because validation status wasn't being retrieved

## Solution

Fixed all SQL queries to use **lowercase column names** with **aliases** for compatibility:

### Files Modified:

1. **`src/utils/database.js`**
   - `insertCheckRecord()` - Changed INSERT to use lowercase column names
   - `getCheckRecords()` - Added aliases: `id as Id`, `phone as Phone`, `status as Status`, etc.
   - `updateCheckRecord()` - Changed UPDATE to use lowercase column names

2. **`src/services/excelProcessor.js`**
   - `checkExistingPhonesInCheckTable()` - Fixed SELECT with alias: `phone as Phone`
   - `updateCompanyDataInCheckTable()` - Changed UPDATE to use lowercase column names

## Result

Now the validation works correctly:
- ✅ **Status = 1** → White background (valid Singapore phone)
- ✅ **Status = 0** → Red background (invalid Singapore phone)
- ✅ **Duplicates** → Orange background

## Database Schema Reference

```sql
CREATE TABLE `check_table` (
  `id` varchar(100) NOT NULL,
  `numeric_id` int DEFAULT NULL,
  `phone` varchar(50) NOT NULL,
  `status` tinyint(1) DEFAULT NULL COMMENT 'true for Singapore phone, false for non-Singapore',
  `company_name` varchar(255) DEFAULT NULL,
  `physical_address` text,
  `email` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  ...
)
```

## Testing

1. Restart server: `npm start`
2. Open browser: `http://localhost:3200`
3. Login and view data
4. Check console for debug output:
   ```javascript
   Sample company data: {
     isDuplicate: false,
     isValidSingaporePhone: true,  // Should match Status value
     Status: 1,                     // 1 = valid, 0 = invalid
     Phone: "+6512345678"
   }
   ```
5. Verify row colors match Status field

## Date Fixed
November 5, 2025
