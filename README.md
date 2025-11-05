# Singapore Phone Validator & Data Management System# 🎉 Authentication System - Ready to Use!



A web application for validating Singapore phone numbers, managing company data, and handling Excel file imports/exports with user authentication.## ✅ Status: FULLY IMPLEMENTED & TESTED



## 🚀 Quick StartBoth servers are running:

- **Backend API**: http://localhost:3200 ✅

### Prerequisites- **Frontend**: http://localhost:3000 ✅

- Node.js (v14 or higher)

- MySQL (v5.7 or higher)## 🚀 Quick Start

- npm or yarn

### Access the Application

### Installation

1. **Register a New Account**

1. **Clone the repository**   - Open: http://localhost:3000/html/register.html

```bash   - Enter your details (password min 8 chars)

git clone https://github.com/htooaunglynn/app-sg-phone.git   - Click "Create Account"

cd app-sg-phone   - You'll be auto-logged in!

```

2. **Login to Existing Account**

2. **Install dependencies**   - Open: http://localhost:3000/html/login.html

```bash   - Enter email and password

npm install   - Click "Sign In"

```

3. **Access Protected Pages**

3. **Setup Database**   - Home: http://localhost:3000/index.html

```bash   - Files: http://localhost:3000/html/file-management.html

# Start MySQL

mysql.server start  # macOS4. **Logout**

# or   - Click "Logout" in navigation bar

sudo systemctl start mysql  # Linux

## 📋 What's Working

# Create database and import schema

mysql -u root -p### ✅ Registration

CREATE DATABASE singapore_phone_db;- Creates new user account in database

exit;- Validates email format

- Requires 8+ character password

mysql -u root -p singapore_phone_db < schema.sql- Checks for duplicate emails

```- Hashes password with bcrypt

- Auto-logs in after registration

4. **Configure Environment**- Tracks user creation

Create a `.env` file in the root directory (or copy from `.env.example`):

```env### ✅ Login

# Server- Validates credentials against database

PORT=3200- Compares hashed passwords

NODE_ENV=development- Creates secure session

- Tracks login attempts (success/failure)

# Database- Records IP address and device

DB_HOST=localhost- Updates last seen timestamp

DB_PORT=3306- Checks account status

DB_NAME=singapore_phone_db

DB_USER=root### ✅ Logout

DB_PASSWORD=your_password- Destroys session

- Clears cookies

# Session- Redirects to login page

SESSION_SECRET=your-secret-key-change-in-production

SESSION_TIMEOUT=86400000### ✅ Session Management

- 24-hour session timeout

# Security- HTTP-only cookies (XSS protection)

BCRYPT_ROUNDS=12- Secure cookies in production

```- Session persists across pages



5. **Start the Application**### ✅ Protected Routes

```bash- Pages redirect to login if not authenticated

# Development mode (with auto-reload)- API endpoints return 401 if not authenticated

npm run dev- User info displayed in navigation

- Automatic authentication checks

# Production mode

npm start## 🧪 Test It Right Now

```

### Browser Test

The application will be available at:1. Open: http://localhost:3000/html/register.html

- **Frontend**: http://localhost:30002. Register with:

- **Backend API**: http://localhost:3200   - Name: Your Name

   - Email: test@example.com

## 📋 Features   - Password: password123

3. You should be redirected to home page with "Hello, Your Name" in nav

### ✅ User Authentication

- Secure user registration with email validation### API Test

- Login/logout functionality```bash

- Session-based authentication (24-hour timeout)# Check status (not authenticated)

- bcrypt password hashing (12 rounds)curl http://localhost:3200/api/auth/status

- HTTP-only cookies for XSS protection# Returns: {"authenticated":false}

- Login attempt tracking

- Account status management (active/inactive/banned)# Register new user

curl -X POST http://localhost:3200/api/auth/register \

### ✅ Excel File Processing  -H "Content-Type: application/json" \

- Upload Excel files with phone data  -d '{"name":"API User","email":"api@test.com","password":"password123"}' \

- Multi-worksheet support  -c cookies.txt

- Automatic column detection (flexible column names)

- Singapore phone number validation using libphonenumber-js# Login

- Duplicate detection by ID and Phone combinationcurl -X POST http://localhost:3200/api/auth/login \

- Company data updates for existing records  -H "Content-Type: application/json" \

- Export filtered data to Excel with color-coded styling  -d '{"email":"api@test.com","password":"password123"}' \

  -c cookies.txt

### ✅ Data Management

- View and search company records# Check status (authenticated)

- Filter by validation statuscurl http://localhost:3200/api/auth/status -b cookies.txt

- Edit company information inline# Returns: {"authenticated":true,"user":{...}}

- Duplicate highlighting (orange background)```

- Invalid phone highlighting (red background)

- Valid phone display (white background)## 📊 Database Verification

- Real-time validation feedback

Check users in database:

### ✅ Security Features```bash

- Password hashing with bcryptmysql -u root -p singapore_phone_db

- Session-based authentication```

- HTTP-only cookies

- CORS protection with credentials```sql

- SQL injection prevention (parameterized queries)-- View all users

- Protected API routes with middlewareSELECT id, name, email, status, created_at FROM users;

- Login activity tracking

-- View login history

## 🔌 API EndpointsSELECT ul.*, u.email

FROM user_logins ul

### Authentication RoutesJOIN users u ON ul.user_id = u.id

| Method | Endpoint | Auth Required | Description |ORDER BY ul.login_time DESC

|--------|----------|---------------|-------------|LIMIT 10;

| POST | `/api/auth/register` | No | Create new account |```

| POST | `/api/auth/login` | No | Login to account |

| POST | `/api/auth/logout` | No | Logout from account |## 🔐 Security Features

| GET | `/api/auth/status` | No | Check authentication status |

| GET | `/api/auth/me` | Yes | Get current user info |- ✅ bcrypt password hashing (12 rounds)

- ✅ Session-based authentication

### Data Routes (Protected)- ✅ HTTP-only cookies

| Method | Endpoint | Auth Required | Description |- ✅ CORS with credentials

|--------|----------|---------------|-------------|- ✅ Password validation

| POST | `/api/upload` | Yes | Upload Excel file |- ✅ Email validation

| GET | `/api/companies` | Yes | Get all company records |- ✅ Login tracking

| POST | `/api/export` | Yes | Export data to Excel |- ✅ Account status support

| PUT | `/api/companies/:id` | Yes | Update company record |

## 📁 Key Files Created

## 💻 Usage Guide

```

### 1. Register & Loginsrc/

- Visit: http://localhost:3000/html/register.html├── routes/auth.js         # Registration, login, logout endpoints

- Create an account with:├── middleware/auth.js     # Authentication middleware

  - Name (required)└── server.js             # Updated with session management

  - Email (valid format required)

  - Password (minimum 8 characters)public/

  - Confirm Password├── js/auth.js            # Client-side auth API

- Login at: http://localhost:3000/html/login.html├── html/

│   ├── login.html        # Login page

### 2. Upload Excel File│   └── register.html     # Registration page

- Go to: http://localhost:3000/html/file-management.html└── index.html            # Protected home page

- Upload Excel file with columns:

  - **Id** (or ID, No, Number)Documentation:

  - **Phone** (or Mobile, Tel, Contact)├── AUTH_SETUP.md              # Complete technical docs

  - **Company Name** (or CompanyName, Company)├── QUICKSTART.md              # Quick start guide

  - **Physical Address** (or Address, PhysicalAddress)├── IMPLEMENTATION_SUMMARY.md  # Full implementation details

  - **Email**└── README.md                  # This file

  - **Website**```

- System automatically:

  - Validates Singapore phone numbers## 🎯 What You Can Do Now

  - Detects duplicates by ID + Phone

  - Updates existing records or inserts new ones✅ Users can register accounts

✅ Users can login securely

### 3. View & Manage Data✅ Users can logout

- Home page (http://localhost:3000) shows all company records✅ Sessions persist across pages

- **Color coding**:✅ Protected pages work

  - 🟠 **Orange rows**: Duplicate phone numbers✅ API routes are protected

  - 🔴 **Red rows**: Invalid Singapore phone numbers✅ User activity is tracked

  - ⚪ **White rows**: Valid Singapore phone numbers

- Search across all fields## 📞 Support

- Filter by validation status

- Edit company information inlineIf something isn't working:

1. Check both servers are running (ports 3000 & 3200)

### 4. Export Data2. Verify database connection in .env

- Filter or search for specific records3. Clear browser cache/cookies

- Click "Export to Excel" button4. Check browser console for errors

- Downloads formatted Excel file with:5. Review server logs for errors

  - Color-coded rows

  - All company data## 🎊 Success!

  - Validation status

Your authentication system is **fully functional** and ready to use!

## 🗄️ Database Schema

Try it now: http://localhost:3000/html/register.html

### Tables

**users**
- Stores user accounts
- Fields: `id`, `name`, `email`, `password` (hashed), `status`, `device`, `ip_address`, `location`, `last_seen`, `created_at`, `updated_at`

**user_logins**
- Tracks login history
- Fields: `id`, `user_id`, `login_time`, `ip_address`, `device`, `location`, `result`

**check_table**
- Main data storage for phone records
- Fields: `id`, `numeric_id`, `phone`, `status`, `company_name`, `physical_address`, `email`, `website`, `created_at`, `updated_at`
- Indexes on: `phone`, `status`, `email`, `company_name`, `numeric_id`
- `status`: 1 = valid Singapore phone, 0 = invalid

## 🛠️ Development

### Available Scripts

```bash
npm install          # Install dependencies
npm run dev         # Start both servers in development mode
npm run server      # Start backend with nodemon (auto-reload)
npm run client      # Start frontend static server
npm run build:css   # Build Tailwind CSS
npm run watch:css   # Watch and rebuild CSS
npm start           # Start both servers in production mode
```

### Project Structure

```
app-sg-phone/
├── src/
│   ├── server.js                        # Main Express server
│   ├── routes/
│   │   └── auth.js                      # Authentication routes
│   ├── middleware/
│   │   └── auth.js                      # Auth middleware
│   ├── services/
│   │   ├── excelProcessor.js            # Excel file processing
│   │   ├── singaporePhoneValidator.js   # Phone validation
│   │   ├── duplicateDetectionService.js # Duplicate detection
│   │   ├── excelExporter.js             # Excel export
│   │   ├── columnMapper.js              # Column mapping
│   │   ├── dataValidator.js             # Data validation
│   │   ├── fileManager.js               # File management
│   │   └── worksheetDetector.js         # Worksheet detection
│   └── utils/
│       ├── database.js                  # Database operations
│       ├── config.js                    # Configuration
│       ├── initDatabase.js              # DB initialization
│       ├── colorConfig.js               # Excel color config
│       ├── colorValidation.js           # Color validation
│       └── excelStylingConfig.js        # Excel styling
├── public/
│   ├── index.ejs                        # Home page
│   ├── css/
│   │   ├── styles.css                   # Tailwind source
│   │   └── output.css                   # Compiled CSS
│   ├── html/
│   │   ├── login.ejs                    # Login page
│   │   ├── register.ejs                 # Registration page
│   │   └── file-management.ejs          # File upload page
│   └── js/
│       ├── app.js                       # Main frontend logic
│       └── auth.js                      # Authentication client
├── uploads/                             # Temporary upload storage
│   ├── excel/                           # Excel uploads
│   └── temp/                            # Temp files
├── exports/                             # Temporary export storage
│   └── temp/                            # Temp exports
├── schema.sql                           # Database schema
├── .env                                 # Environment variables (create this)
├── .env.example                         # Environment template
├── package.json                         # Dependencies
├── tailwind.config.js                   # Tailwind configuration
├── postcss.config.js                    # PostCSS configuration
└── README.md                            # This file
```

## 🧪 Testing

### Test Authentication
```bash
# Register new user
curl -X POST http://localhost:3200/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"password123"}' \
  -c cookies.txt

# Login
curl -X POST http://localhost:3200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  -c cookies.txt

# Check authentication status
curl http://localhost:3200/api/auth/status -b cookies.txt

# Logout
curl -X POST http://localhost:3200/api/auth/logout -b cookies.txt
```

### Database Queries
```sql
-- View all users
SELECT id, name, email, status, created_at FROM users;

-- View login history
SELECT ul.*, u.email FROM user_logins ul
JOIN users u ON ul.user_id = u.id
ORDER BY ul.login_time DESC LIMIT 10;

-- View company data
SELECT id, phone, status, company_name, email FROM check_table LIMIT 10;

-- Count total records
SELECT COUNT(*) as total FROM check_table;

-- Count valid vs invalid phones
SELECT
  status,
  COUNT(*) as count,
  CASE WHEN status = 1 THEN 'Valid' ELSE 'Invalid' END as type
FROM check_table
GROUP BY status;

-- Find duplicates
SELECT phone, COUNT(*) as count
FROM check_table
GROUP BY phone
HAVING COUNT(*) > 1;
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3200 (backend)
lsof -ti:3200 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues
```bash
# Check if MySQL is running
mysql.server status

# Start MySQL
mysql.server start  # macOS
sudo systemctl start mysql  # Linux

# Verify database exists
mysql -u root -p -e "SHOW DATABASES;"

# Import schema
mysql -u root -p singapore_phone_db < schema.sql
```

### Session Not Persisting
- Clear browser cache and cookies
- Check CORS settings in `src/server.js`
- Verify `credentials: 'include'` in fetch requests
- Ensure cookies are enabled in browser
- Check `SESSION_SECRET` is set in `.env`

### bcrypt Installation Failed (macOS)
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Reinstall bcrypt
npm install bcrypt --build-from-source

# Alternative: use bcryptjs
npm install bcryptjs
# Then update imports in src/routes/auth.js
```

### Excel Upload Errors
- Ensure columns have standard names (Id, Phone, etc.)
- Check file format is .xlsx or .xls
- Verify file is not corrupted
- Check file size (should be reasonable)
- Review server logs for specific errors

## 🔒 Security Best Practices

### Production Deployment
- ✅ Change `SESSION_SECRET` to a strong random string
- ✅ Set `NODE_ENV=production`
- ✅ Use HTTPS (secure cookies enabled automatically)
- ✅ Regularly update dependencies: `npm audit fix`
- ✅ Use strong database passwords
- ✅ Enable firewall rules
- ✅ Regular database backups
- ✅ Monitor login attempts
- ✅ Set up rate limiting (consider adding express-rate-limit)

### Password Requirements
- Minimum 8 characters
- Hashed with bcrypt (12 rounds)
- Never stored in plain text
- Validated on both client and server

## 📊 Environment Variables Reference

| Variable          | Default            | Description                                    |
| ----------------- | ------------------ | ---------------------------------------------- |
| `PORT`            | 3200               | Backend server port                            |
| `NODE_ENV`        | development        | Environment (development/production)           |
| `DB_HOST`         | localhost          | MySQL host                                     |
| `DB_PORT`         | 3306               | MySQL port                                     |
| `DB_NAME`         | singapore_phone_db | Database name                                  |
| `DB_USER`         | root               | Database username                              |
| `DB_PASSWORD`     | -                  | Database password (required)                   |
| `SESSION_SECRET`  | -                  | Session encryption key (required)              |
| `SESSION_TIMEOUT` | 86400000           | Session duration in ms (24 hours)              |
| `BCRYPT_ROUNDS`   | 12                 | Password hashing rounds (higher = more secure) |

## 🎯 Data Flow

### Upload Flow
```
User uploads Excel
    ↓
Extract data from all worksheets
    ↓
Map columns (flexible name matching)
    ↓
For each row:
    ├─ Check if ID + Phone exists in check_table
    │   ├─ Yes → UPDATE company data
    │   └─ No  → INSERT new record
    ↓
Validate phone number (Singapore format)
    ↓
Store with status (1=valid, 0=invalid)
    ↓
Return summary to user
```

### Authentication Flow
```
User registers/logs in
    ↓
Validate credentials
    ↓
Hash password (register) or compare hash (login)
    ↓
Create session with userId
    ↓
Set HTTP-only cookie
    ↓
Track login in user_logins table
    ↓
Return user data to client
```

## 📈 Future Enhancements

Potential improvements for future versions:
- [ ] Email verification for new accounts
- [ ] Password reset via email
- [ ] Two-factor authentication (2FA)
- [ ] OAuth integration (Google, GitHub)
- [ ] Rate limiting for login attempts
- [ ] Password strength indicator
- [ ] "Remember me" functionality
- [ ] Session timeout warnings
- [ ] Account lockout after failed attempts
- [ ] User profile management
- [ ] Bulk data operations
- [ ] Advanced filtering and sorting
- [ ] Data export in multiple formats (CSV, PDF)
- [ ] API rate limiting
- [ ] Audit logs for data changes

## 📝 License

This project is private and proprietary.

## 👤 Author

**Htoo Aung Lynn**
- GitHub: [@htooaunglynn](https://github.com/htooaunglynn)
- Repository: [app-sg-phone](https://github.com/htooaunglynn/app-sg-phone)

## 🙏 Acknowledgments

- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) - Phone number validation
- [ExcelJS](https://github.com/exceljs/exceljs) - Excel file processing
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Express](https://expressjs.com/) - Web application framework
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - Password hashing
- [MySQL2](https://github.com/sidorares/node-mysql2) - MySQL client

## 📞 Support

If you encounter issues:
1. Check both servers are running (ports 3000 & 3200)
2. Verify database connection in `.env`
3. Clear browser cache/cookies
4. Check browser console for errors
5. Review server logs for detailed error messages
6. Ensure all dependencies are installed: `npm install`
7. Verify database schema is imported: `mysql -u root -p singapore_phone_db < schema.sql`

---

**Last Updated**: November 5, 2025
