# Quick Start Guide - Authentication System

## 🚀 Quick Setup (3 steps)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup Database
Make sure MySQL is running, then import the schema:
```bash
mysql -u root -p singapore_phone_db < schema.sql
```

### Step 3: Start the Application
```bash
npm run dev
```

This will start:
- **Backend API Server**: http://localhost:4000
- **Frontend Static Server**: http://localhost:3000

## 📝 Testing the Authentication

### 1. Register a New User
- Open browser to: http://localhost:3000/html/register.html
- Fill in:
  - **Name**: Your Name
  - **Email**: test@example.com
  - **Password**: password123 (min 8 chars)
  - **Confirm Password**: password123
- Click "Create Account"
- You'll be automatically logged in and redirected to home page

### 2. Login with Existing User
- Open browser to: http://localhost:3000/html/login.html
- Enter your email and password
- Click "Sign In"
- You'll be redirected to home page

### 3. Access Protected Pages
- **Home**: http://localhost:3000/index.html (requires login)
- **Files**: http://localhost:3000/html/file-management.html (requires login)
- If not logged in, you'll be automatically redirected to login page

### 4. Logout
- Click the "Logout" button in the navigation bar
- You'll be logged out and redirected to login page

## 🔍 Verify It's Working

### Check Session
Open browser console and run:
```javascript
fetch('http://localhost:4000/api/auth/status', { credentials: 'include' })
  .then(r => r.json())
  .then(data => console.log(data))
```

Should return:
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "name": "Your Name",
    "email": "test@example.com"
  }
}
```

### Check Database
```sql
-- View registered users
SELECT id, name, email, status, created_at FROM users;

-- View login history
SELECT ul.*, u.name, u.email
FROM user_logins ul
JOIN users u ON ul.user_id = u.id
ORDER BY ul.login_time DESC
LIMIT 10;
```

## 🐛 Common Issues

### Issue: "Cannot connect to database"
**Solution**:
1. Make sure MySQL is running: `mysql.server start` (macOS)
2. Check `.env` file has correct database credentials
3. Create database if it doesn't exist: `CREATE DATABASE singapore_phone_db;`

### Issue: "Port 4000 already in use"
**Solution**:
1. Kill the process: `lsof -ti:4000 | xargs kill -9`
2. Or change PORT in `.env` file

### Issue: "Session not persisting"
**Solution**:
1. Make sure cookies are enabled in browser
2. Clear browser cache and cookies
3. Check browser console for CORS errors

### Issue: "bcrypt installation failed"
**Solution** (macOS):
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Then reinstall
npm install bcrypt --build-from-source
```

## 📊 Test API Endpoints

### Register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test2@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

### Check Status (using saved cookies)
```bash
curl http://localhost:4000/api/auth/status \
  -b cookies.txt
```

### Logout
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -b cookies.txt
```

## ✅ Success Indicators

You'll know everything is working when:
- ✅ Registration creates a new user in the database
- ✅ Login redirects to home page
- ✅ Accessing index.html without login redirects to login page
- ✅ User name appears in navigation bar when logged in
- ✅ Logout redirects to login page
- ✅ Login attempts are tracked in `user_logins` table

## 🎯 Next Actions

Once authentication is working:
1. Test uploading Excel files (should work when logged in)
2. Test exporting data (should work when logged in)
3. Try accessing /api/upload without logging in (should get 401 error)
4. Check user activity in database

## 📚 Documentation

For more details, see:
- **AUTH_SETUP.md** - Complete authentication system documentation
- **schema.sql** - Database schema and table structures
- **.env** - Configuration options
