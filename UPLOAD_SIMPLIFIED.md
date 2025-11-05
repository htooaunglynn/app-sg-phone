# Simplified Upload System

## Changes Made

### ✅ **Removed Column Detection**
- No more automatic column detection
- Excel files must have standard column names (flexible matching)
- Accepts: `Id`, `Phone`, `Company Name`, `Physical Address`, `Email`, `Website`

### ✅ **Store ALL Data**
- No data cancellation or filtering
- All rows with phone numbers are stored
- Invalid phone numbers are kept (marked as invalid)

### ✅ **Smart Duplicate Handling**
Duplicates are detected by **BOTH** ID and Phone:
- If **ID + Phone** match → **UPDATE** other fields (company data)
- If **new combination** → **INSERT** new record

## How It Works

```
Excel Upload
    ↓
Read all worksheets
    ↓
Extract rows (expects standard columns)
    ↓
For each row:
    ├─ Check if ID + Phone exists
    │   ├─ Yes → UPDATE company data
    │   └─ No  → INSERT new record
    ↓
Validate Singapore phone format
    ↓
Store with status (valid=1, invalid=0)
    ↓
Return results
```

## Expected Excel Format

| Id  | Phone    | Company Name | Physical Address | Email      | Website   |
| --- | -------- | ------------ | ---------------- | ---------- | --------- |
| 1   | 91234567 | Company A    | 123 Street       | a@test.com | www.a.com |
| 2   | 81234567 | Company B    | 456 Road         | b@test.com | www.b.com |

**Note:** Column names are flexible. The system will try variations like:
- Id, ID, id, No, Number
- Phone, phone, Mobile, Tel, Contact
- Company Name, CompanyName, Company
- etc.

## Upload Response

```javascript
{
  success: true,
  rows: 100,           // Total rows processed
  stored: 80,          // New records inserted
  updated: 20,         // Existing records updated
  validated: 85,       // Valid Singapore numbers
  insertedDelta: 80,   // Net increase in DB
  checkTableCountAfter: 1580
}
```

## Duplicate Logic

**Example:**
- Excel has: ID=1, Phone=91234567
- Database has: ID=1, Phone=91234567
- **Action:** UPDATE the company data fields only

**Example 2:**
- Excel has: ID=1, Phone=81234567
- Database has: ID=1, Phone=91234567
- **Action:** INSERT as new record (different phone)

## Benefits

✅ **Simpler** - No complex column detection
✅ **Faster** - Direct processing
✅ **Complete** - All data stored, nothing lost
✅ **Smart Updates** - Automatically updates existing records
✅ **Flexible** - Handles various column name formats
