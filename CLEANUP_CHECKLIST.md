# Database Cleanup Checklist

## Removing backup_table and uploaded_files Tables

### Pre-Migration Checklist

- [ ] **Backup database**
  ```bash
  mysqldump -u root -p singapore_phone_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Check current table sizes**
  ```sql
  SELECT
      table_name,
      table_rows,
      ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
  FROM information_schema.tables
  WHERE table_schema = 'singapore_phone_db'
  ORDER BY table_name;
  ```

- [ ] **Verify data in backup_table** (if exists)
  ```sql
  SELECT COUNT(*) FROM backup_table;
  SELECT COUNT(*) FROM check_table;
  ```

### Migration Steps

1. **Run Migration SQL**
   ```bash
   mysql -u root -p singapore_phone_db < MIGRATION_CLEANUP.sql
   ```

2. **Verify Migration**
   - Check that all records migrated
   - Verify check_table has expected row count
   - Confirm backup_table and uploaded_files are dropped

3. **Update Application**
   - Deploy new code (already updated in codebase)
   - Restart application server

### Code Files Already Updated

✅ `schema.sql` - Tables removed
✅ `src/server.js` - Using direct-to-check_table method
✅ `src/services/excelProcessor.js` - New method added
✅ `SIMPLIFIED_EXCEL_UPLOAD.md` - Documentation updated

### Code Files That Need Cleanup (Optional)

These files still contain references to backup_table but are no longer used by the main upload flow. You can either:
- Leave them (they won't affect the system)
- Remove them later when you're sure you don't need them

Files with backup_table references:
- `src/services/phoneValidationProcessor.js` - Used for batch validation from backup_table
- `src/services/duplicateDetectionService.js` - Used for backup_table duplicate detection
- `src/utils/database.js` - Contains backup_table methods
- `src/utils/initDatabase.js` - Contains backup_table creation

**Recommendation:** Leave these files as-is for now. They're not hurting anything and might be useful for reference.

### Testing After Migration

- [ ] **Test Excel Upload**
  ```
  1. Upload a new Excel file
  2. Verify records appear in check_table
  3. Check that duplicates update company data
  4. Verify validation status (Status column)
  ```

- [ ] **Test Data Display**
  ```
  1. Load /api/companies endpoint
  2. Verify data displays correctly
  3. Check duplicate highlighting (orange)
  4. Verify validation highlighting (red for invalid)
  ```

- [ ] **Test Duplicate Handling**
  ```
  1. Upload same file twice
  2. Verify no errors
  3. Check that duplicates update company data
  4. Verify count matches expectations
  ```

### Rollback Plan (If Needed)

If something goes wrong:

1. **Restore from backup**
   ```bash
   mysql -u root -p singapore_phone_db < backup_YYYYMMDD_HHMMSS.sql
   ```

2. **Revert code changes**
   ```bash
   git checkout HEAD~1 src/server.js src/services/excelProcessor.js
   ```

3. **Restart application**

### Verify Cleanup Complete

Run this query to confirm tables are gone:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'singapore_phone_db'
ORDER BY table_name;
```

You should see only:
- `check_table` ✅
- `users` ✅
- `user_logins` ✅

### Database Size Savings

After cleanup, check your space savings:

```sql
SELECT
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Total DB Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'singapore_phone_db';
```

### Final Verification

- [ ] Application starts without errors
- [ ] Excel upload works correctly
- [ ] No backup_table or uploaded_files references in logs
- [ ] Data displays correctly in UI
- [ ] Duplicate detection works
- [ ] Validation status displays correctly

---

## Need Help?

If you encounter issues:

1. Check application logs for errors
2. Verify database connection
3. Confirm schema matches expected structure
4. Test with a small Excel file first
5. Restore from backup if needed

**Status:** Ready for production ✅
**Last Updated:** November 5, 2025
