const express = require('express')
const multer = require('multer')
const ExcelJS = require('exceljs')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')
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

// Session configuration
app.use(session({
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
        console.log('Session Debug:', {
            path: req.path,
            method: req.method,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            userId: req.session?.userId,
            cookies: Object.keys(req.cookies || {}),
            secure: req.secure,
            protocol: req.protocol
        });
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
                isDuplicate,
                isValidSingaporePhone
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
        console.log(`Processing Excel file: ${filename}`)

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

        console.log('Processing result:', {
            success: result.success,
            error: result.error,
            totalRecords: result.totalRecords,
            storedRecords: result.storedRecords,
            updatedRecords: result.updatedRecords,
            insertedDelta,
            validRecords: result.validRecords,
            invalidRecords: result.invalidRecords,
            errorsCount: (result.errors || []).length
        })

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

        console.log(`Starting Excel export for ${rows.length} records with advanced styling`)
        console.log('Sample record structure:', rows[0] ? Object.keys(rows[0]) : 'No records')

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

        console.log(`Excel export completed: ${exportResult.metadata.recordCount} records, ${exportResult.metadata.fileSize} bytes`)

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

const PORT = process.env.PORT || 4000

// Initialize database connection
async function startServer() {
    try {
        // Connect to database
        await db.connect();
        console.log('Database connected successfully');

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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
