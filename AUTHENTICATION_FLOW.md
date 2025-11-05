# Authentication Flow Diagram

## Complete User Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER REGISTRATION FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

User visits /html/register.html
         │
         ▼
┌─────────────────────┐
│  Enter Details:     │
│  - Name             │
│  - Email            │
│  - Password         │
│  - Confirm Password │
└─────────┬───────────┘
          │
          ▼
  Click "Create Account"
          │
          ▼
┌──────────────────────────────────────────────────┐
│  auth.js: handleRegister()                       │
│  - Validates passwords match                     │
│  - Calls AuthAPI.register(name, email, password) │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼ POST /api/auth/register
┌──────────────────────────────────────────────────┐
│  Backend: routes/auth.js                         │
│  1. Validate input (email format, password len)  │
│  2. Check if email exists                        │
│  3. Hash password with bcrypt                    │
│  4. Insert user into database                    │
│  5. Create session (req.session.userId)          │
│  6. Return success + user data                   │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Frontend: Receives response                     │
│  - Success: redirect to /index.html              │
│  - Error: display message                        │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                           USER LOGIN FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

User visits /html/login.html
         │
         ▼
┌─────────────────────┐
│  Enter Credentials: │
│  - Email            │
│  - Password         │
└─────────┬───────────┘
          │
          ▼
  Click "Sign In"
          │
          ▼
┌──────────────────────────────────────────────────┐
│  auth.js: handleLogin()                          │
│  - Calls AuthAPI.login(email, password)          │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼ POST /api/auth/login
┌──────────────────────────────────────────────────┐
│  Backend: routes/auth.js                         │
│  1. Validate input                               │
│  2. Find user by email                           │
│  3. Check account status (active/banned)         │
│  4. Compare password with bcrypt                 │
│  5. Create session                               │
│  6. Update last_seen, ip_address                 │
│  7. Log login attempt (success/failed)           │
│  8. Return success + user data                   │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Frontend: Receives response                     │
│  - Success: redirect to /index.html              │
│  - Error: display message                        │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      PROTECTED PAGE ACCESS FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

User visits /index.html or /html/file-management.html
         │
         ▼
┌──────────────────────────────────────────────────┐
│  auth.js: DOMContentLoaded event                 │
│  - Calls checkAuthentication()                   │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼ GET /api/auth/status
┌──────────────────────────────────────────────────┐
│  Backend: routes/auth.js                         │
│  - Check req.session.userId exists               │
│  - Return {authenticated: true/false, user: ...} │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Frontend: Handle response                       │
│  ┌─────────────────┬──────────────────────────┐  │
│  │ authenticated?  │                          │  │
│  ├─────────────────┼──────────────────────────┤  │
│  │ YES             │ - Show page              │  │
│  │                 │ - Update user display    │  │
│  │                 │ - Load content           │  │
│  ├─────────────────┼──────────────────────────┤  │
│  │ NO              │ - Redirect to login      │  │
│  └─────────────────┴──────────────────────────┘  │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                          USER LOGOUT FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

User clicks "Logout" button
         │
         ▼
┌──────────────────────────────────────────────────┐
│  auth.js: logout()                               │
│  - Calls AuthAPI.logout()                        │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼ POST /api/auth/logout
┌──────────────────────────────────────────────────┐
│  Backend: routes/auth.js                         │
│  1. Destroy session (req.session.destroy())      │
│  2. Clear cookie                                 │
│  3. Return success                               │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Frontend: Redirect to /html/login.html          │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      PROTECTED API REQUEST FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

User uploads Excel file
         │
         ▼ POST /api/upload (with credentials)
┌──────────────────────────────────────────────────┐
│  Backend: middleware/auth.js                     │
│  requireAuth() checks:                           │
│  ┌────────────────┬──────────────────────────┐   │
│  │ Session exists?│                          │   │
│  ├────────────────┼──────────────────────────┤   │
│  │ YES            │ next() - allow request   │   │
│  ├────────────────┼──────────────────────────┤   │
│  │ NO             │ Return 401 Unauthorized  │   │
│  └────────────────┴──────────────────────────┘   │
└──────────────────────────────────────────────────┘
         │
         ▼ (if authenticated)
┌──────────────────────────────────────────────────┐
│  Route handler processes request                 │
│  - Upload file                                   │
│  - Process data                                  │
│  - Return response                               │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                        SESSION MANAGEMENT                            │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Express Session Configuration                   │
│  - Secret: SESSION_SECRET from .env              │
│  - Cookie lifetime: 24 hours                     │
│  - HTTP-only: true (XSS protection)              │
│  - Secure: true in production (HTTPS)            │
│  - Store: Memory (default)                       │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│  Session Data Stored:                            │
│  - userId: Database user ID                      │
│  - userEmail: User's email                       │
│  - userName: User's name                         │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE OPERATIONS                          │
└─────────────────────────────────────────────────────────────────────┘

Registration:
┌──────────────────────────────────────────────────┐
│  INSERT INTO users                               │
│  (name, email, password, status)                 │
│  VALUES (?, ?, hashed_password, 'active')        │
└──────────────────────────────────────────────────┘

Login:
┌──────────────────────────────────────────────────┐
│  1. SELECT * FROM users WHERE email = ?          │
│  2. bcrypt.compare(password, user.password)      │
│  3. UPDATE users SET last_seen, ip_address       │
│  4. INSERT INTO user_logins (login tracking)     │
└──────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                            SECURITY LAYERS                           │
└─────────────────────────────────────────────────────────────────────┘

Layer 1: Input Validation
  ├─ Email format validation
  ├─ Password length (8+ chars)
  └─ SQL injection prevention (parameterized queries)

Layer 2: Password Security
  ├─ bcrypt hashing (12 rounds)
  ├─ Salt automatically generated
  └─ Never store plain text passwords

Layer 3: Session Security
  ├─ HTTP-only cookies (no JavaScript access)
  ├─ Secure flag in production (HTTPS only)
  ├─ Session timeout (24 hours)
  └─ Session secret from environment

Layer 4: CORS Protection
  ├─ Allowed origins configured
  ├─ Credentials required
  └─ Preflight requests handled

Layer 5: Authentication Middleware
  ├─ Protected routes check session
  ├─ 401 response if not authenticated
  └─ User context in requests

Layer 6: Activity Tracking
  ├─ Login attempts logged
  ├─ IP addresses recorded
  ├─ Device information stored
  └─ Last seen timestamps
```

## Key Components

### Backend
- **routes/auth.js**: Authentication endpoints
- **middleware/auth.js**: Authentication middleware
- **server.js**: Express server with session setup

### Frontend
- **js/auth.js**: Authentication API client
- **html/login.html**: Login page
- **html/register.html**: Registration page

### Database
- **users**: User accounts
- **user_logins**: Login tracking

### Security
- bcrypt for password hashing
- Express sessions for state management
- HTTP-only cookies for XSS protection
- CORS for cross-origin security
