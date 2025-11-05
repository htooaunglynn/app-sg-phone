# 🎯 Authentication System - Quick Reference

## 🌐 URLs

| Purpose        | URL                                             |
| -------------- | ----------------------------------------------- |
| **Register**   | http://localhost:3000/html/register.html        |
| **Login**      | http://localhost:3000/html/login.html           |
| **Home**       | http://localhost:3000/index.html                |
| **Files**      | http://localhost:3000/html/file-management.html |
| **API Status** | http://localhost:3200/api/auth/status           |

## 🔌 API Endpoints

| Method | Endpoint             | Auth Required | Purpose                |
| ------ | -------------------- | ------------- | ---------------------- |
| POST   | `/api/auth/register` | No            | Create new account     |
| POST   | `/api/auth/login`    | No            | Login to account       |
| POST   | `/api/auth/logout`   | No            | Logout from account    |
| GET    | `/api/auth/status`   | No            | Check if authenticated |
| GET    | `/api/auth/me`       | Yes           | Get current user info  |
| POST   | `/api/upload`        | Yes           | Upload Excel file      |
| POST   | `/api/export`        | Yes           | Export to Excel        |

## 💻 npm Commands

```bash
npm install              # Install dependencies
npm run dev             # Start both servers (development)
npm run server          # Start backend only (with nodemon)
npm run client          # Start frontend only
npm run server:prod     # Start backend (production)
npm start               # Start both servers (production)
```

## 🗄️ Database Queries

```sql
-- View all users
SELECT id, name, email, status, created_at FROM users;

-- View login history
SELECT ul.*, u.email
FROM user_logins ul
JOIN users u ON ul.user_id = u.id
ORDER BY ul.login_time DESC;

-- Check specific user
SELECT * FROM users WHERE email = 'test@example.com';

-- Count users
SELECT COUNT(*) as total_users FROM users;

-- Recent logins
SELECT * FROM user_logins
ORDER BY login_time DESC
LIMIT 10;
```

## 🧪 Testing Commands

```bash
# Test auth status
curl http://localhost:3200/api/auth/status

# Register new user
curl -X POST http://localhost:3200/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"password123"}' \
  -c cookies.txt

# Login
curl -X POST http://localhost:3200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  -c cookies.txt

# Check status (with session)
curl http://localhost:3200/api/auth/status -b cookies.txt

# Logout
curl -X POST http://localhost:3200/api/auth/logout -b cookies.txt
```

## 📋 Request/Response Examples

### Register Request
```json
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

### Register Response (Success)
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Login Request
```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

### Login Response (Success)
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Status Response (Authenticated)
```json
GET /api/auth/status
{
  "authenticated": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Status Response (Not Authenticated)
```json
GET /api/auth/status
{
  "authenticated": false
}
```

## 🔧 Environment Variables (.env)

```bash
# Server
PORT=3200
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=singapore_phone_db
DB_USER=root
DB_PASSWORD=password

# Session
SESSION_SECRET=your-secret-key-change-in-production
SESSION_TIMEOUT=86400000

# Security
BCRYPT_ROUNDS=12
```

## ⚙️ Configuration Options

| Setting           | Default               | Description                 |
| ----------------- | --------------------- | --------------------------- |
| `PORT`            | 4000                  | Backend server port         |
| `SESSION_TIMEOUT` | 86400000              | Session duration (24 hours) |
| `BCRYPT_ROUNDS`   | 12                    | Password hashing rounds     |
| `CORS_ORIGIN`     | http://localhost:3000 | Allowed CORS origin         |

## 🔒 Password Requirements

- Minimum length: 8 characters
- No maximum length
- Automatically hashed with bcrypt
- Salt rounds: 12 (configurable)

## 📁 File Locations

```
src/
├── routes/auth.js              # Auth endpoints
├── middleware/auth.js          # Auth middleware
└── server.js                   # Main server

public/
├── js/auth.js                  # Frontend auth API
├── html/
│   ├── login.html
│   └── register.html
└── index.html

.env                             # Configuration
schema.sql                       # Database schema
package.json                     # Dependencies
```

## 🐛 Common Errors & Fixes

| Error                        | Solution                                        |
| ---------------------------- | ----------------------------------------------- |
| "Cannot connect to database" | Check MySQL is running, verify .env credentials |
| "Port already in use"        | `lsof -ti:3200                                  | xargs kill -9` |
| "Session not persisting"     | Clear cookies, check CORS settings              |
| "401 Unauthorized"           | Login first, check session exists               |
| "bcrypt install failed"      | `xcode-select --install` on macOS               |

## 📞 Quick Troubleshooting

```bash
# Check if servers are running
lsof -i :3000  # Frontend
lsof -i :3200  # Backend

# Check MySQL
mysql.server status

# View logs
tail -f /path/to/logs

# Clear browser storage
# Chrome: DevTools → Application → Clear storage
```

## ✅ Health Checks

```bash
# Backend health
curl http://localhost:3200/api/auth/status

# Database connection
mysql -u root -p singapore_phone_db -e "SELECT 1"

# Check tables exist
mysql -u root -p singapore_phone_db -e "SHOW TABLES"
```

## 🎯 Quick Test Checklist

- [ ] Servers running (3000 & 3200)
- [ ] Database accessible
- [ ] Can register new user
- [ ] Can login
- [ ] Protected page redirects
- [ ] Logout works
- [ ] User name shows in nav

## 📚 Documentation Files

- **README.md** - Overview and quick start
- **QUICKSTART.md** - Step-by-step setup guide
- **AUTH_SETUP.md** - Complete technical documentation
- **IMPLEMENTATION_SUMMARY.md** - Full implementation details
- **AUTHENTICATION_FLOW.md** - Visual flow diagrams
- **QUICK_REFERENCE.md** - This file

---

**Quick Start**: `npm run dev` → Visit http://localhost:3000/html/register.html 🚀
