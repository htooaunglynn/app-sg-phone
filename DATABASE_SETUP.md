# Database Setup Guide

This application supports both **MySQL** (for local development) and **PostgreSQL** (for production).

## Quick Setup

### Option 1: PostgreSQL (Recommended for Production)

1. **Install PostgreSQL**
   ```bash
   # macOS
   brew install postgresql@16
   brew services start postgresql@16

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Set environment to PostgreSQL**

   Update your `.env` file:
   ```env
   DB_TYPE=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=singapore_phone_db
   ```

3. **Initialize the database**
   ```bash
   npm run init:postgres
   ```

4. **Start the application**
   ```bash
   npm run dev:postgres
   ```

### Option 2: MySQL (Local Development Only)

1. **Install MySQL**
   ```bash
   # macOS
   brew install mysql
   brew services start mysql

   # Ubuntu/Debian
   sudo apt-get install mysql-server
   sudo systemctl start mysql
   ```

2. **Set environment to MySQL**

   Update your `.env` file:
   ```env
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=singapore_phone_db
   ```

3. **Initialize the database**
   ```bash
   node scripts/init-postgres.js  # This works for MySQL too
   ```

4. **Start the application**
   ```bash
   npm run dev:mysql
   ```

## Production Deployment (Render, Heroku, etc.)

For production with managed PostgreSQL:

1. **Set the DATABASE_URL environment variable**

   Most platforms (Render, Heroku, Railway) provide a `DATABASE_URL` automatically.

   ```env
   DB_TYPE=postgres
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. **The application will auto-detect and use DATABASE_URL**

3. **Database will be initialized on first run**

## Switching Between Databases

The application automatically switches between MySQL and PostgreSQL based on the `DB_TYPE` environment variable:

```bash
# Use PostgreSQL
DB_TYPE=postgres npm run dev

# Use MySQL
DB_TYPE=mysql npm run dev
```

## Database Schema

Both databases use the same schema structure:

- `backup_table` - Immutable storage for all phone records
- `check_table` - Validated phone numbers with status
- `users` - User authentication
- `login_logs` - Login history tracking
- `uploaded_files` - File upload tracking

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Check PostgreSQL status
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Test connection
psql -U postgres -h localhost
```

### MySQL Connection Issues

```bash
# Check if MySQL is running
mysqladmin ping

# Check MySQL status
brew services list  # macOS
sudo systemctl status mysql  # Linux

# Test connection
mysql -u root -p
```

### Common Errors

1. **"connect ETIMEDOUT"** or **"ECONNREFUSED"**
   - Database server is not running
   - Check DB_HOST and DB_PORT in .env
   - Verify firewall settings

2. **"password authentication failed"**
   - Wrong DB_USER or DB_PASSWORD in .env
   - Update credentials in .env file

3. **"database does not exist"**
   - Run the initialization script:
     ```bash
     npm run init:postgres
     ```

4. **"Ignoring invalid configuration option"** (MySQL warnings)
   - These are just warnings, not errors
   - The app is configured for MySQL but trying PostgreSQL options
   - Set `DB_TYPE=postgres` to fix

## Environment Variables Reference

```env
# Required
DB_TYPE=postgres                    # 'mysql' or 'postgres'
DATABASE_URL=postgresql://...       # For production (overrides individual settings)

# Alternative (individual settings)
DB_HOST=localhost                   # Database host
DB_PORT=5432                        # 5432 for PostgreSQL, 3306 for MySQL
DB_USER=postgres                    # Database user
DB_PASSWORD=password                # Database password
DB_NAME=singapore_phone_db          # Database name

# Optional
DB_CONNECTION_LIMIT=20              # Max connections in pool
DB_SSL=true                         # Enable SSL (production)
```
