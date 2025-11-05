# Render Deployment Guide

## Automatic PostgreSQL Schema Initialization

Your project is configured to automatically initialize the PostgreSQL database when deployed to Render.

### How It Works

1. **Build Phase**: `npm install && npm run build:css && node scripts/init-postgres.js`
   - Installs dependencies
   - Builds Tailwind CSS
   - **Runs PostgreSQL schema initialization script**

2. **Start Phase**: `node src/server.js`
   - Starts your Express server

### Database Schema Auto-Setup

The `scripts/init-postgres.js` script automatically:
- ✅ Connects to your Render PostgreSQL database
- ✅ Executes `schema-postgres.sql`
- ✅ Creates all tables (users, user_logins, check_table)
- ✅ Sets up ENUM types, indexes, and triggers
- ✅ Verifies tables were created successfully
- ✅ Logs table counts for monitoring

### Environment Variables Required

Make sure these are set in your Render web service:

| Variable          | Example                                | Description                    |
| ----------------- | -------------------------------------- | ------------------------------ |
| `DB_HOST`         | `dpg-xxxxx.oregon-postgres.render.com` | From Render PostgreSQL         |
| `DB_PORT`         | `5432`                                 | PostgreSQL port (default 5432) |
| `DB_NAME`         | `your_database_name`                   | From Render PostgreSQL         |
| `DB_USER`         | `your_database_user`                   | From Render PostgreSQL         |
| `DB_PASSWORD`     | `your_database_password`               | From Render PostgreSQL         |
| `DB_SSL`          | `true`                                 | Enable SSL for production      |
| `NODE_ENV`        | `production`                           | Environment mode               |
| `PORT`            | `4000`                                 | Server port                    |
| `SESSION_SECRET`  | `your-random-secret-key`               | Session encryption key         |
| `SESSION_TIMEOUT` | `86400000`                             | Session timeout (24h)          |
| `CORS_ORIGIN`     | `https://your-app.onrender.com`        | Your Render URL                |

### Deployment Steps

1. **Create PostgreSQL Database on Render**
   - Dashboard → New → PostgreSQL
   - Name it (e.g., `app-sg-phone-db`)
   - Wait for provisioning

2. **Get Database Connection Details**
   - Click on your database
   - Copy: Host, Database, User, Password, Port

3. **Create Web Service on Render**
   - Dashboard → New → Web Service
   - Connect your GitHub repo
   - Select `main` branch
   - Render will detect `render.yaml` automatically

4. **Set Environment Variables**
   - Go to Environment tab
   - Add all variables from the table above
   - Use values from your PostgreSQL database

5. **Deploy**
   - Click "Create Web Service"
   - Render will:
     1. Install dependencies
     2. Build CSS
     3. **Run schema initialization** ✨
     4. Start your server
   - Check build logs to verify schema was created

6. **Verify Deployment**
   - Check build logs for: "✅ Database initialization completed successfully!"
   - Visit your app URL
   - Test login/register functionality

### Manual Schema Initialization (If Needed)

If you need to manually run the schema:

```bash
# Local test
node scripts/init-postgres.js

# Or use Render Shell
# Go to your PostgreSQL database → Shell
# Paste contents of schema-postgres.sql
```

### Auto-Deploy on Git Push

Since `render.yaml` has `autoDeploy: true` and `branch: main`:
- Every push to `main` branch triggers automatic deployment
- Schema initialization runs on every deployment
- Existing tables are preserved (using `IF NOT EXISTS`)

### Troubleshooting

**Build fails at schema initialization:**
- Check environment variables are set correctly
- Verify PostgreSQL database is running
- Check Render build logs for specific error

**Tables not created:**
- Run schema manually in Render PostgreSQL Shell
- Check `schema-postgres.sql` for syntax errors

**Connection errors:**
- Verify `DB_SSL=true` for Render PostgreSQL
- Check database host/port/credentials

### What Happens on Each Deployment

1. ✅ Schema creates tables if they don't exist
2. ✅ Existing data is preserved
3. ✅ New columns/indexes are added if schema updated
4. ✅ No data loss on redeployment

---

## Next Steps After Deployment

1. **Update CORS_ORIGIN**: Set to your actual Render URL
2. **Test authentication**: Register and login
3. **Monitor logs**: Check Render dashboard for errors
4. **Set up custom domain** (optional)

Your app is now production-ready! 🎉
