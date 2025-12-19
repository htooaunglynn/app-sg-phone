const express = require('express')
const multer = require('multer')
const ExcelJS = require('exceljs')
const session = require('express-session')
const pgSession = require('connect-pg-simple')(session)
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')
const { Pool } = require('pg')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const { requireAuth } = require('./middleware/auth')
const db = require('./utils/database')
const ExcelProcessor = require('./services/excelProcessor')
const ExcelExporter = require('./services/excelExporter')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })
const excelProcessor = new ExcelProcessor()
const excelExporter = new ExcelExporter()

// Trust proxy for production (required for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
}

// Middleware
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}))

// Create PostgreSQL pool for session store
const sessionPool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'true' ? {
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
            } : false
        }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true' ? {
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
            } : false
        }
)

// Session configuration with PostgreSQL store
app.use(session({
    store: new pgSession({
        pool: sessionPool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'singapore-phone-detect-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_TIMEOUT) || 86400000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
    },
    proxy: process.env.NODE_ENV === 'production' // Trust proxy in production
}))

// Debug session middleware (only in production for troubleshooting)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        next();
    });
}

// View engine: EJS (.ejs templates) under /public
app.set('views', path.join(__dirname, '../public'))
app.set('view engine', 'ejs')

// Expose user to all templates
app.use((req, res, next) => {
    res.locals.user = req.session && req.session.userId ? {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName,
    } : null
    res.locals.error = null
    res.locals.success = null
    next()
})

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')))

// Authentication routes (server-rendered)
app.use('/auth', authRoutes)

// --- Utility Functions ---
function buildPhoneMap(records, idKey = 'id', phoneKey = 'phone') {
    const phoneMap = new Map();
    records.forEach(record => {
        const phone = record[phoneKey] || record[phoneKey.charAt(0).toUpperCase() + phoneKey.slice(1)];
        if (phone) {
            if (!phoneMap.has(phone)) phoneMap.set(phone, []);
            phoneMap.get(phone).push(record[idKey] || record[idKey.charAt(0).toUpperCase() + idKey.slice(1)]);
        }
    });
    return phoneMap;
}

function getDuplicatePhones(phoneMap) {
    const duplicates = new Set();
    phoneMap.forEach(ids => { if (ids.length > 1) duplicates.add(ids[0]); });
    return duplicates;
}

function isFinishData(record) {
    return (
        (record.company_name && record.company_name.trim() !== '') ||
        (record.physical_address && record.physical_address.trim() !== '') ||
        (record.email && record.email.trim() !== '') ||
        (record.website && record.website.trim() !== '')
    );
}

function getDuplicatePhoneSet(phoneMap) {
    const duplicatePhones = new Set();
    phoneMap.forEach((ids, phone) => {
        if (ids.length > 1) duplicatePhones.add(phone);
    });
    return duplicatePhones;
}

// --- Route Handlers ---
// GET /api/validation-stats - get total validation counts across all records
app.get('/api/validation-stats', requireAuth, async (req, res) => {
    try {
        const total = await db.getCheckRecordsCount();
        const allCompanies = await db.getCheckRecords(total, 0);
        const phoneMap = buildPhoneMap(allCompanies);
        const duplicatePhones = getDuplicatePhoneSet(phoneMap);

        let duplicateCount = 0, invalidCount = 0, validCount = 0, finishCount = 0, notFinishCount = 0, realExistenceCount = 0;

        allCompanies.forEach(company => {
            const phone = company.phone || company.Phone;
            const status = company.status !== undefined ? company.status : company.Status;
            const isDuplicate = phone && duplicatePhones.has(phone);
            if (company.real_existence === true) realExistenceCount++;
            if (isFinishData(company)) finishCount++; else notFinishCount++;
            if (isDuplicate) duplicateCount++;
            else if (status === 0 || status === false) invalidCount++;
            else if (status === 1 || status === true) validCount++;
            else invalidCount++;
        });

        return res.json({
            success: true,
            totalRecords: total,
            duplicateCount,
            invalidCount,
            validCount,
            finishCount,
            notFinishCount,
            realExistenceCount
        });
    } catch (error) {
        console.error('Error fetching validation stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch validation stats'
        });
    }
});

// GET /api/companies - fetch all companies from check_table with validation info (protected route)
app.get('/api/companies', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100
        const offset = parseInt(req.query.offset) || 0

        const companies = await db.getCheckRecords(limit, offset)
        const total = await db.getCheckRecordsCount()

        // Get all phone numbers to detect duplicates
        const allCompanies = await db.getCheckRecords(total, 0)
        const phoneMap = new Map()

        // Build phone frequency map
        allCompanies.forEach(company => {
            const phone = company.Phone || company.phone
            if (phone) {
                if (!phoneMap.has(phone)) {
                    phoneMap.set(phone, [])
                }
                phoneMap.get(phone).push(company.Id || company.id)
            }
        })

        // Identify duplicate phone numbers
        const duplicatePhones = new Set()
        phoneMap.forEach((ids, phone) => {
            if (ids.length > 1) {
                duplicatePhones.add(phone)
            }
        })

        // Mark duplicates for current page (Status already indicates if valid Singapore phone)
        const enrichedCompanies = companies.map(company => {
            const phone = company.Phone || company.phone
            const isDuplicate = phone && duplicatePhones.has(phone)
            // Status: 1/true = valid Singapore phone, 0/false = invalid
            // Handle both boolean and number types
            const status = company.Status !== undefined ? company.Status : company.status
            const isValidSingaporePhone = status === 1 || status === true

            return {
                ...company,
                // keep existing flags
                isDuplicate,
                isValidSingaporePhone,
                // ensure both snake_case and camelCase are present for the frontend
                real_existence: company.real_existence,
                realExistence: company.real_existence !== undefined ? company.real_existence : company.realExistence
            }
        })

        return res.json({
            success: true,
            data: enrichedCompanies,
            count: enrichedCompanies.length,
            total: total,
            limit: limit,
            offset: offset,
            hasMore: (offset + companies.length) < total,
            validationStats: {
                totalDuplicatePhones: duplicatePhones.size,
                duplicateRecordsInPage: enrichedCompanies.filter(c => c.isDuplicate).length
            }
        })
    } catch (error) {
        console.error('Error fetching companies:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch companies'
        })
    }
})

// POST /api/upload - accepts multipart/form-data with field 'file' (protected route)
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

        const filename = req.file.originalname

        // Capture count before insert for accurate delta
        const countBefore = await db.getCheckRecordsCount()

        // Process Excel file - direct to check_table only
        // Note: backup_table and uploaded_files tables are not used in PostgreSQL schema
        const result = await excelProcessor.processExcelDirectToCheckTable(
            req.file.buffer,
            filename
        )

        // Capture count after processing
        const countAfter = await db.getCheckRecordsCount()
        const insertedDelta = Math.max(0, countAfter - countBefore)



        if (!result.success) {
            console.error('Processing failed:', result.error)
            return res.status(400).json({
                error: result.error || 'Failed to process Excel file'
            })
        }

        // Return success with summary, including DB snapshot counts for debugging
        return res.json({
            success: true,
            message: 'Excel file processed successfully',
            rows: result.totalRecords,
            stored: result.storedRecords,
            updated: result.updatedRecords,
            insertedDelta,
            duplicates: 0,
            validated: result.validRecords,
            checkTableCountBefore: countBefore,
            checkTableCountAfter: countAfter,
            errors: (result.errors || []).slice(0, 5) // surface a few errors if any
        })
    } catch (err) {
        console.error('Upload error:', err)
        console.error('Error stack:', err.stack)
        return res.status(500).json({
            error: err.message || 'Upload processing failed',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
    }
})

// POST /api/export - accepts JSON array in body and returns styled xlsx (protected route)
app.post('/api/export', requireAuth, async (req, res) => {
    try {
        const rows = req.body
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Expecting non-empty array in body' })
        }



        // Use ExcelExporter service with full styling support
        const exportResult = await excelExporter.exportCheckTableRecords(rows, {
            sheetName: 'Companies Export',
            enableStyling: true,
            stylingOptions: {}
        })

        if (!exportResult.success || !exportResult.buffer) {
            console.error('Excel export failed:', exportResult.error)
            return res.status(500).json({
                error: exportResult.error || 'Failed to generate Excel file'
            })
        }

        // Send Excel file as attachment with proper headers
        const filename = `companies_export_${new Date().toISOString().split('T')[0]}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', exportResult.buffer.length)



        res.send(exportResult.buffer)
    } catch (err) {
        console.error('Export error:', err)
        console.error('Error stack:', err.stack)
        res.status(500).json({
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
    }
})

// GET /api/export/finish-data - export records where at least one field is filled (protected route)
app.get('/api/export/finish-data', requireAuth, async (req, res) => {
    try {


        // Get all records from database
        const total = await db.getCheckRecordsCount()
        const allRecords = await db.getCheckRecords(total, 0)

        // Filter records where AT LEAST ONE field (company_name, physical_address, email, website) is NOT null
        const finishRecords = allRecords.filter(record => {
            const companyName = record.company_name
            const physicalAddress = record.physical_address
            const email = record.email
            const website = record.website

            // Check if at least one field is present and not empty
            return (companyName && companyName.trim() !== '') ||
                (physicalAddress && physicalAddress.trim() !== '') ||
                (email && email.trim() !== '') ||
                (website && website.trim() !== '')
        })



        if (finishRecords.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No records found with at least one field filled'
            })
        }

        // Format records for export
        const exportData = finishRecords.map(record => ({
            Id: record.id || '',
            Phone: record.phone || '',
            'Company Name': record.company_name || '',
            'Physical Address': record.physical_address || '',
            Email: record.email || '',
            Website: record.website || '',
            Carrier: record.carrier || '',
            LineType: record.line_type || ''
        }))

        // Use ExcelExporter service
        const exportResult = await excelExporter.exportCheckTableRecords(exportData, {
            sheetName: 'Finish Data',
            enableStyling: true,
            stylingOptions: {}
        })

        if (!exportResult.success || !exportResult.buffer) {
            console.error('Excel export failed:', exportResult.error)
            return res.status(500).json({
                error: exportResult.error || 'Failed to generate Excel file'
            })
        }

        // Send Excel file
        const filename = `finish_data_export_${new Date().toISOString().split('T')[0]}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', exportResult.buffer.length)


        res.send(exportResult.buffer)

    } catch (err) {
        console.error('Finish data export error:', err)
        res.status(500).json({
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
    }
})

// GET /api/export/no-data - export records where all fields are null (protected route)
app.get('/api/export/no-data', requireAuth, async (req, res) => {
    try {


        // Get all records from database
        const total = await db.getCheckRecordsCount()
        const allRecords = await db.getCheckRecords(total, 0)

        // Filter records where ALL fields (company_name, physical_address, email, website) are null or empty
        const noDataRecords = allRecords.filter(record => {
            const companyName = record.company_name
            const physicalAddress = record.physical_address
            const email = record.email
            const website = record.website

            // Check if all fields are null or empty
            return (!companyName || companyName.trim() === '') &&
                (!physicalAddress || physicalAddress.trim() === '') &&
                (!email || email.trim() === '') &&
                (!website || website.trim() === '')
        })



        if (noDataRecords.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No records found with all fields empty'
            })
        }

        // Format records for export
        const exportData = noDataRecords.map(record => ({
            Id: record.id || '',
            Phone: record.phone || '',
            'Company Name': record.company_name || '',
            'Physical Address': record.physical_address || '',
            Email: record.email || '',
            Website: record.website || '',
            Carrier: record.carrier || '',
            LineType: record.line_type || ''
        }))

        // Use ExcelExporter service
        const exportResult = await excelExporter.exportCheckTableRecords(exportData, {
            sheetName: 'No Data',
            enableStyling: true,
            stylingOptions: {}
        })

        if (!exportResult.success || !exportResult.buffer) {
            console.error('Excel export failed:', exportResult.error)
            return res.status(500).json({
                error: exportResult.error || 'Failed to generate Excel file'
            })
        }

        // Send Excel file
        const filename = `no_data_export_${new Date().toISOString().split('T')[0]}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', exportResult.buffer.length)


        res.send(exportResult.buffer)

    } catch (err) {
        console.error('No data export error:', err)
        res.status(500).json({
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
    }
})

// GET /api/export/wrong-number - export records with invalid Singapore phone numbers (protected route)
app.get('/api/export/wrong-number', requireAuth, async (req, res) => {
    try {


        // Get all records from database
        const total = await db.getCheckRecordsCount()
        const allRecords = await db.getCheckRecords(total, 0)

        // Build phone frequency map to identify duplicates (to exclude them)
        const phoneMap = new Map()
        allRecords.forEach(record => {
            const phone = record.phone
            if (phone) {
                if (!phoneMap.has(phone)) {
                    phoneMap.set(phone, [])
                }
                phoneMap.get(phone).push(record.id)
            }
        })

        // Identify duplicate phone numbers
        const duplicatePhones = new Set()
        phoneMap.forEach((ids, phone) => {
            if (ids.length > 1) {
                duplicatePhones.add(phone)
            }
        })

        // Filter records where NOT duplicate AND status is false (invalid Singapore phone number)
        // This matches the logic in /api/validation-stats for invalidCount
        const wrongNumberRecords = allRecords.filter(record => {
            const phone = record.phone
            const status = record.status
            const isDuplicate = phone && duplicatePhones.has(phone)

            // Include only if NOT duplicate AND invalid status
            if (isDuplicate) {
                return false
            } else if (status === false || status === 0) {
                return true
            } else {
                // Treat unclear status as invalid (matching validation-stats logic)
                return status !== true && status !== 1
            }
        })



        if (wrongNumberRecords.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No records found with invalid Singapore phone numbers'
            })
        }

        // Format records for export
        const exportData = wrongNumberRecords.map(record => ({
            Id: record.id || '',
            Phone: record.phone || '',
            'Company Name': record.company_name || '',
            'Physical Address': record.physical_address || '',
            Email: record.email || '',
            Website: record.website || '',
            Carrier: record.carrier || '',
            LineType: record.line_type || ''
        }))

        // Use ExcelExporter service
        const exportResult = await excelExporter.exportCheckTableRecords(exportData, {
            sheetName: 'Wrong Numbers',
            enableStyling: true,
            stylingOptions: {}
        })

        if (!exportResult.success || !exportResult.buffer) {
            console.error('Excel export failed:', exportResult.error)
            return res.status(500).json({
                error: exportResult.error || 'Failed to generate Excel file'
            })
        }

        // Send Excel file
        const filename = `wrong_number_export_${new Date().toISOString().split('T')[0]}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', exportResult.buffer.length)


        res.send(exportResult.buffer)

    } catch (err) {
        console.error('Wrong number export error:', err)
        res.status(500).json({
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
    }
})

// GET /api/companies/search - search companies across all records
app.get('/api/companies/search', requireAuth, async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm || searchTerm.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Search term is required'
            });
        }

        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const term = `%${searchTerm.trim().toLowerCase()}%`;

        // Search across ID, phone, company_name, email, website, and physical_address
        const searchQuery = `
            SELECT id, numeric_id, phone, status,
                   company_name, physical_address,
                   email, website, carrier, line_type, real_existence, created_at, updated_at
            FROM check_table
            WHERE LOWER(id::text) LIKE $1
               OR LOWER(phone) LIKE $1
               OR LOWER(COALESCE(company_name, '')) LIKE $1
               OR LOWER(COALESCE(email, '')) LIKE $1
               OR LOWER(COALESCE(website, '')) LIKE $1
               OR LOWER(COALESCE(physical_address, '')) LIKE $1
            ORDER BY numeric_id ASC, id ASC
            LIMIT $2 OFFSET $3
        `;

        const countQuery = `
            SELECT COUNT(*) as count
            FROM check_table
            WHERE LOWER(id::text) LIKE $1
               OR LOWER(phone) LIKE $1
               OR LOWER(COALESCE(company_name, '')) LIKE $1
               OR LOWER(COALESCE(email, '')) LIKE $1
               OR LOWER(COALESCE(website, '')) LIKE $1
               OR LOWER(COALESCE(physical_address, '')) LIKE $1
        `;

        const [searchResults, countResults] = await Promise.all([
            db.query(searchQuery, [term, limit, offset]),
            db.query(countQuery, [term])
        ]);

        const total = parseInt(countResults[0]?.count || 0);

        // Get all companies to detect duplicates
        const allCompanies = await db.getCheckRecords(await db.getCheckRecordsCount(), 0);
        const phoneMap = new Map();

        // Build phone frequency map
        allCompanies.forEach(company => {
            const phone = company.phone;
            if (phone) {
                if (!phoneMap.has(phone)) {
                    phoneMap.set(phone, []);
                }
                phoneMap.get(phone).push(company.id);
            }
        });

        // Identify duplicate phone numbers
        const duplicatePhones = new Set();
        phoneMap.forEach((ids, phone) => {
            if (ids.length > 1) {
                duplicatePhones.add(phone);
            }
        });

        // Mark duplicates for search results
        const enrichedResults = searchResults.map(company => {
            const phone = company.phone;
            const isDuplicate = phone && duplicatePhones.has(phone);
            const isValidSingaporePhone = company.status === true;

            return {
                Id: company.id,
                Phone: company.phone,
                CompanyName: company.company_name,
                PhysicalAddress: company.physical_address,
                Email: company.email,
                Website: company.website,
                Carrier: company.carrier,
                LineType: company.line_type,
                Status: company.status,
                real_existence: company.real_existence,
                realExistence: company.real_existence !== undefined ? company.real_existence : company.realExistence,
                isDuplicate,
                isValidSingaporePhone
            };
        });

        return res.json({
            success: true,
            data: enrichedResults,
            count: enrichedResults.length,
            total: total,
            limit: limit,
            offset: offset,
            searchTerm: searchTerm,
            hasMore: (offset + searchResults.length) < total
        });

    } catch (error) {
        console.error('Error searching companies:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search companies'
        });
    }
});

// PUT /api/companies/:id - update company info (company fields only)
app.put('/api/companies/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ success: false, error: 'Missing company ID' });

        const { companyName = null, physicalAddress = null, email = null, website = null } = req.body || {};

        // Optional: simple sanitization/validation
        const toStrOrNull = (v) => (v === undefined || v === null || v === '' ? null : String(v));

        const payload = {
            companyName: toStrOrNull(companyName),
            physicalAddress: toStrOrNull(physicalAddress),
            email: toStrOrNull(email),
            website: toStrOrNull(website)
        };

        // Update in check_table only (Id/Phone/Status are immutable here)
        const result = await db.updateCheckRecord(id, payload);

        return res.json({ success: true, updated: result?.rowCount || 0 });
    } catch (error) {
        console.error('Error updating company:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to update company' });
    }
})

// POST /api/real-existence?from=...&to=... - check real existence using Numverify
app.post('/api/real-existence', requireAuth, async (req, res) => {
    try {
        const from = parseInt(req.query.from);
        const to = parseInt(req.query.to);
        if (isNaN(from) || isNaN(to) || from > to) {
            return res.json({ success: false, error: 'Invalid numeric_id range.' });
        }

        // Query all records with status = 1 and numeric_id in range
        const sql = `SELECT id, phone, numeric_id FROM check_table WHERE status = true AND numeric_id >= $1 AND numeric_id <= $2`;
        const records = await db.query(sql, [from, to]);
        if (!records || records.length === 0) {
            return res.json({ success: false, error: 'No records found in range.' });
        }

        // Numverify API config
        const NUMVERIFY_API_KEY = process.env.NUMVERIFY_API_KEY;
        const NUMVERIFY_URL = 'https://apilayer.net/api/validate';
        if (!NUMVERIFY_API_KEY) {
            return res.json({ success: false, error: 'Numverify API key not configured.' });
        }

        // Helper to call Numverify
        async function checkNumverify(phone) {
            const url = `${NUMVERIFY_URL}?access_key=${NUMVERIFY_API_KEY}&number=${encodeURIComponent(phone)}&country_code=SG&format=1`;
            try {
                const resp = await fetch(url);
                const data = await resp.json();
                return data;
            } catch (err) {
                return { valid: false, error: err.message };
            }
        }

        // For each record, check real existence and update DB if valid
        const results = [];
        for (const rec of records) {
            // Format phone for Numverify (add +65 if missing)
            let phone = rec.phone;
            if (!phone.startsWith('+65')) {
                phone = '+65' + phone.replace(/^65/, '');
            }
            const nv = await checkNumverify(phone);
            // Handle Numverify errors (including rate limit)
            if (nv && nv.success === false && nv.error) {
                const { code, type, info } = nv.error;
                if (code === 106 || String(type).includes('rate_limit')) {
                    // Return immediately with partial results and a specific flag
                    return res.json({
                        success: false,
                        error: info || 'Rate limit reached from Numverify',
                        errorCode: code,
                        errorType: type,
                        rateLimit: true,
                        results
                    });
                }
            }
            let valid = nv.valid === true;
            // Persist results: set carrier/line_type; set real_existence only when valid
            const carrier = nv.carrier || null;
            const lineType = nv.line_type || null;
            await db.query(
                `UPDATE check_table
                 SET carrier = $1,
                     line_type = $2,
                     real_existence = CASE WHEN $3 THEN true ELSE real_existence END,
                     updated_at = NOW()
                 WHERE id = $4`,
                [carrier, lineType, valid, rec.id]
            );
            results.push({
                id: rec.id,
                phone: rec.phone,
                valid,
                carrier: carrier || '',
                line_type: lineType || '',
                error: nv.error || ''
            });
        }

        return res.json({ success: true, results });
    } catch (error) {
        console.error('Real existence check error:', error);
        return res.json({ success: false, error: error.message });
    }
});

// POST /api/check-duplicates - Check and fill missing data for duplicate phone numbers
app.post('/api/check-duplicates', requireAuth, async (req, res) => {
    try {


        // Get all records from the database
        const allRecords = await db.query('SELECT * FROM check_table ORDER BY id');

        if (!allRecords || allRecords.length === 0) {
            return res.json({
                success: true,
                message: 'No records found in database',
                processedCount: 0,
                updatedCount: 0
            });
        }

        // Group records by phone number
        const phoneGroups = new Map();
        allRecords.forEach(record => {
            const phone = record.phone?.trim();
            if (phone) {
                if (!phoneGroups.has(phone)) {
                    phoneGroups.set(phone, []);
                }
                phoneGroups.get(phone).push(record);
            }
        });

        let processedCount = 0;
        let updatedCount = 0;

        // Process each phone group that has duplicates
        for (const [phone, records] of phoneGroups) {
            if (records.length > 1) {
                processedCount++;


                // Find the record with the most complete data
                let sourceRecord = null;
                let sourceScore = -1;

                for (const record of records) {
                    let score = 0;
                    if (record.company_name && record.company_name.trim()) score++;
                    if (record.physical_address && record.physical_address.trim()) score++;
                    if (record.email && record.email.trim()) score++;
                    if (record.website && record.website.trim()) score++;

                    if (score > sourceScore) {
                        sourceScore = score;
                        sourceRecord = record;
                    }
                }

                // If we found a source record with data, update other records
                if (sourceRecord && sourceScore > 0) {
                    for (const targetRecord of records) {
                        if (targetRecord.id !== sourceRecord.id) {
                            const updates = [];
                            const params = [];
                            let paramIndex = 1;
                            let hasUpdates = false;

                            // Check and update company_name
                            if (sourceRecord.company_name && sourceRecord.company_name.trim() &&
                                (!targetRecord.company_name || !targetRecord.company_name.trim())) {
                                updates.push(`company_name = $${paramIndex}`);
                                params.push(sourceRecord.company_name);
                                paramIndex++;
                                hasUpdates = true;
                            }

                            // Check and update physical_address
                            if (sourceRecord.physical_address && sourceRecord.physical_address.trim() &&
                                (!targetRecord.physical_address || !targetRecord.physical_address.trim())) {
                                updates.push(`physical_address = $${paramIndex}`);
                                params.push(sourceRecord.physical_address);
                                paramIndex++;
                                hasUpdates = true;
                            }

                            // Check and update email
                            if (sourceRecord.email && sourceRecord.email.trim() &&
                                (!targetRecord.email || !targetRecord.email.trim())) {
                                updates.push(`email = $${paramIndex}`);
                                params.push(sourceRecord.email);
                                paramIndex++;
                                hasUpdates = true;
                            }

                            // Check and update website
                            if (sourceRecord.website && sourceRecord.website.trim() &&
                                (!targetRecord.website || !targetRecord.website.trim())) {
                                updates.push(`website = $${paramIndex}`);
                                params.push(sourceRecord.website);
                                paramIndex++;
                                hasUpdates = true;
                            }

                            // Perform the update if there are changes
                            if (hasUpdates) {
                                updates.push(`updated_at = NOW()`);
                                params.push(targetRecord.id);

                                const updateQuery = `
                                    UPDATE check_table
                                    SET ${updates.join(', ')}
                                    WHERE id = $${paramIndex}
                                `;

                                await db.query(updateQuery, params);
                                updatedCount++;


                            }
                        }
                    }
                }
            }
        }



        return res.json({
            success: true,
            message: 'Duplicate check completed successfully',
            processedCount,
            updatedCount
        });

    } catch (error) {
        console.error('Error in check duplicates:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to check duplicates: ' + error.message
        });
    }
});

const PORT = process.env.PORT || 4000

// Initialize database connection
async function startServer() {
    try {
        // Connect to database
        await db.connect();
        // Ensure new columns exist for storing Numverify metadata
        if (typeof db.ensureOptionalColumns === 'function') {
            await db.ensureOptionalColumns();
        }


        // Start server
        app.listen(PORT, () => {
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Basic page routes rendered via EJS templates
app.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.session && req.session.userId) {
        // User is logged in, show index page
        return res.render('index')
    } else {
        // User is not logged in, show login page
        return res.render('html/login', { error: null })
    }
})

// Health check endpoint for debugging
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            connected: db.isConnected,
            type: 'PostgreSQL',
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            hasDbHost: !!process.env.DB_HOST
        },
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/login', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/')
    return res.render('html/login', { error: null })
})

app.get('/register', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/')
    return res.render('html/register')
})

app.get('/file-management', requireAuth, (req, res) => {
    return res.render('html/file-management')
})

// Start the server
startServer()
