# Column Name Standardization - Update Summary

## Date: November 5, 2025

## Overview
Updated all application files to correctly handle database column name case sensitivity across both `backup_table` and `check_table`.

## Database Schema Reference

### `backup_table` (Uses UPPERCASE column names)
- `Id` - Record identifier
- `Phone` - Phone number
- `CompanyName` - Company name
- `PhysicalAddress` - Physical address
- `Email` - Email address
- `Website` - Website URL

### `check_table` (Uses lowercase column names)
- `id` - Record identifier
- `phone` - Phone number
- `status` - Validation status (0 = invalid, 1 = valid Singapore phone)
- `company_name` - Company name
- `physical_address` - Physical address
- `email` - Email address
- `website` - Website URL

## Files Updated

### 1. `/src/services/excelProcessor.js`
- ✅ Fixed `updateCompanyDataInCheckTable()` to use lowercase column names
- ✅ Uses `company_name`, `physical_address`, `email`, `website` for check_table updates
- ✅ Maintains uppercase column names for backup_table operations

### 2. `/public/js/app.js`
- ✅ Updated `renderTable()` to handle both uppercase and lowercase column names
- ✅ Updated status detection to check both `Status` and `status` fields
- ✅ Updated `filterTable()` to support both column name variations
- ✅ Updated `exportToExcel()` to handle both column name variations
- ✅ Updated `openEditModal()` to handle both column name variations
- ✅ Updated `saveEdit()` to update all column name variations

### 3. `/src/services/excelExporter.js`
- ✅ Updated `prepareWorksheetData()` to support both uppercase and lowercase field names
- ✅ Updated `detectStatusValue()` to check both `Status` and `status` fields
- ✅ Added support for `company_name`, `physical_address` in addition to camelCase

### 4. `/src/utils/database.js`
- ✅ Already correctly using lowercase column names with aliases in `getCheckRecords()`
- ✅ SQL: `SELECT id as Id, phone as Phone, status as Status, company_name as CompanyName, ...`
- ✅ Maintains uppercase column names for backup_table operations
- ✅ Uses lowercase column names for check_table operations

## Testing Checklist

- [x] Verify check_table queries use lowercase column names
- [x] Verify backup_table queries use uppercase column names
- [x] Verify frontend can handle both column name formats
- [x] Verify status field reads correctly (check_table.status)
- [x] Verify row coloring works (red for invalid, white for valid, orange for duplicates)
- [x] Verify search/filter works with all column variations
- [x] Verify export works with all column variations
- [x] Verify edit modal populates and saves correctly

## Key Points

1. **Backend Database Queries:**
   - `check_table` uses lowercase column names in WHERE/UPDATE clauses
   - `backup_table` uses uppercase column names in WHERE/UPDATE clauses
   - `getCheckRecords()` returns data with uppercase aliases for frontend compatibility

2. **Frontend JavaScript:**
   - Supports BOTH uppercase and lowercase column names
   - Gracefully handles data from API regardless of column name case
   - Uses fallback pattern: `company.Status || company.status`

3. **Status Field Validation:**
   - Database stores as `status` (lowercase) in check_table
   - Frontend checks both `Status` and `status` fields
   - Values: `1` or `true` = valid, `0` or `false` = invalid

## Color Coding Logic (Priority Order)

1. **Orange** - Duplicate phone numbers (highest priority)
2. **Red** - Invalid Singapore phone (status = 0 or false)
3. **White** - Valid Singapore phone (status = 1 or true)

## Conclusion

All files now consistently handle column name case sensitivity. The application supports both uppercase and lowercase column names throughout the stack, ensuring compatibility regardless of how the data is returned from the database.

The fix ensures that:
- Status validation works correctly
- Row colors display properly
- Search and filter functions work
- Export functionality works
- Edit operations work
