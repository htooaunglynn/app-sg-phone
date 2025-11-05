# Authentication System Setup

This document describes the authentication system implementation for DataHub.

## Features

✅ **User Registration** - Create new accounts with name, email, and password
✅ **User Login** - Secure login with bcrypt password hashing
✅ **User Logout** - Session-based logout functionality
✅ **Session Management** - Express sessions with cookies
✅ **Protected Routes** - API endpoints require authentication
✅ **Login Tracking** - Tracks login attempts and user activity
✅ **Password Security** - Minimum 8 characters, bcrypt hashing with configurable rounds

## Database Tables Used

- **users** - Stores user accounts (name, email, hashed password, status)
- **user_logins** - Tracks login history (timestamps, IP addresses, success/failure)

## API Endpoints

### Authentication Routes (prefix: `/api/auth`)

| Method | Endpoint             | Description            | Authentication Required |
| ------ | -------------------- | ---------------------- | ----------------------- |
| POST   | `/api/auth/register` | Register new user      | No                      |
| POST   | `/api/auth/login`    | Login user             | No                      |
| POST   | `/api/auth/logout`   | Logout current user    | No                      |
| GET    | `/api/auth/status`   | Check if authenticated | No                      |
| GET    | `/api/auth/me`       | Get current user info  | Yes                     |

### Protected Routes

| Method | Endpoint      | Description          |
| ------ | ------------- | -------------------- |
| POST   | `/api/upload` | Upload Excel file    |
| POST   | `/api/export` | Export data to Excel |

## Setup Instructions

### 1. Install Dependencies

All required dependencies are already in `package.json`:
- bcrypt (password hashing)
- express-session (session management)
- cookie-parser (cookie handling)
- cors (cross-origin requests)

```bash
npm install
```

### 2. Database Setup

The database tables are already defined in `schema.sql`. Make sure your MySQL database is running and configured in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=singapore_phone_db
DB_USER=root
DB_PASSWORD=password
```

### 3. Environment Configuration

Key authentication settings in `.env`:

```env
# Session Configuration
SESSION_SECRET=singapore-phone-detect-secret-change-in-production
SESSION_TIMEOUT=86400000  # 24 hours in milliseconds

# Password Security
BCRYPT_ROUNDS=12  # Higher = more secure but slower

# Authentication
ENABLE_AUTH=true
```

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Or standard mode
npm start
```

The server will run on `http://localhost:4000` (or the PORT specified in .env)

### 5. Access the Application

- **Login Page**: `http://localhost:3000/html/login.html`
- **Register Page**: `http://localhost:3000/html/register.html`
- **Home Page**: `http://localhost:3000/index.html` (requires authentication)

## Usage Flow

1. **First Time Users**:
   - Visit `/html/register.html`
   - Enter name, email, and password (min 8 characters)
   - Submit to create account
   - Automatically logged in and redirected to home

2. **Existing Users**:
   - Visit `/html/login.html`
   - Enter email and password
   - Submit to login
   - Redirected to home page

3. **Logout**:
   - Click "Logout" button in navigation
   - Session destroyed
   - Redirected to login page

## Security Features

- ✅ **Password Hashing**: bcrypt with configurable rounds (default: 12)
- ✅ **Session Security**: HTTP-only cookies, secure in production
- ✅ **Email Validation**: Regex validation for proper email format
- ✅ **Password Requirements**: Minimum 8 characters
- ✅ **Login Tracking**: All login attempts logged with timestamps and IP
- ✅ **Account Status**: Support for active/inactive/banned users
- ✅ **Protected API Routes**: Middleware checks authentication

## File Structure

```
src/
├── routes/
│   └── auth.js              # Authentication route handlers
├── middleware/
│   └── auth.js              # Authentication middleware
└── server.js                # Main server with session setup

public/
├── js/
│   └── auth.js              # Client-side authentication API
└── html/
    ├── login.html           # Login page
    └── register.html        # Registration page
```

## Client-Side API Usage

The `AuthAPI` object provides methods to interact with the backend:

```javascript
// Register a new user
const result = await AuthAPI.register(name, email, password);

// Login
const result = await AuthAPI.login(email, password);

// Logout
const result = await AuthAPI.logout();

// Check authentication status
const status = await AuthAPI.checkStatus();

// Get current user info
const userInfo = await AuthAPI.getCurrentUser();
```

## Troubleshooting

### Users can't login after registration
- Check database connection
- Verify bcrypt is installed: `npm install bcrypt`
- Check server logs for errors

### Session not persisting
- Ensure cookies are enabled in browser
- Check CORS settings in server.js
- Verify `credentials: 'include'` in fetch requests

### Database errors
- Ensure MySQL is running
- Verify database exists: `singapore_phone_db`
- Check user has permissions
- Import schema: `mysql -u root -p singapore_phone_db < schema.sql`

## Next Steps

Potential enhancements:
- [ ] Email verification for new accounts
- [ ] Password reset functionality
- [ ] Two-factor authentication (2FA)
- [ ] OAuth integration (Google, GitHub, etc.)
- [ ] Rate limiting for login attempts
- [ ] Password strength meter
- [ ] Remember me functionality
- [ ] Session timeout warnings
