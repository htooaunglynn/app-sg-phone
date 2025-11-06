# Render Deployment Guide

⚠️ Important safety change: Production deployments no longer auto-apply the schema. The previous setup could drop tables on deploy (because `schema-postgres.sql` contains DROP TABLE statements). This guide reflects the safe, opt-in-only behavior.

## How Deploy Works Now

1. Build phase: `npm ci --only=production`
   - Installs dependencies
2. Start phase: `node scripts/start.js`
   - Starts your Express server
   - Skips DB initialization by default

To intentionally run the schema in production, you must set both of these env vars (DANGEROUS):
- `DB_INIT_ON_BOOT=true`
- `ALLOW_SCHEMA_RESET=true`

Without both, the schema will NOT run in production.

### Environment Variables Required

Make sure these are set in your Render web service:

| Variable             | Example                                | Description                    |
| -------------------- | -------------------------------------- | ------------------------------ |
| `DB_HOST`            | `dpg-xxxxx.oregon-postgres.render.com` | From Render PostgreSQL         |
| `DB_PORT`            | `5432`                                 | PostgreSQL port (default 5432) |
| `DB_NAME`            | `your_database_name`                   | From Render PostgreSQL         |
| `DB_USER`            | `your_database_user`                   | From Render PostgreSQL         |
| `DB_PASSWORD`        | `your_database_password`               | From Render PostgreSQL         |
| `DB_SSL`             | `true`                                 | Enable SSL for production      |
| `NODE_ENV`           | `production`                           | Environment mode               |
| `PORT`               | `4000`                                 | Server port                    |
| `SESSION_SECRET`     | `your-random-secret-key`               | Session encryption key         |
| `SESSION_TIMEOUT`    | `86400000`                             | Session timeout (24h)          |
| `CORS_ORIGIN`        | `https://your-app.onrender.com`        | Your Render URL                |
| `DB_INIT_ON_BOOT`    | `false`                                | Do NOT init DB on boot         |
| `ALLOW_SCHEMA_RESET` | `false`                                | Extra guard to block schema    |

## Deployment Steps

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
   - Render will install dependencies and start your server
   - It will NOT touch your database unless explicitly enabled

6. **Verify Deployment**
   - Check build logs for: "✅ Database initialization completed successfully!"
   - Visit your app URL
   - Test login/register functionality

### Manually Applying the Schema (One-time only)

Use one of these controlled methods:

- Preferred: Run in the database console (PSQL) on Render and paste `schema-postgres.sql` after taking a backup.
- Or: Temporarily set `DB_INIT_ON_BOOT=true` and `ALLOW_SCHEMA_RESET=true` → deploy once → immediately set them back to `false` and redeploy.

Never leave these toggles enabled in production.

### Troubleshooting

**Build fails at schema initialization:**
- Check environment variables are set correctly
- Verify PostgreSQL database is running
- Check Render build logs for specific error

**Tables not created:**
- Run schema manually in Render PostgreSQL Shell
- Check `schema-postgres.sql` for syntax errors

## Data Loss Incident Playbook

If you lost data due to a deploy running the schema:

1. Immediately set `DB_INIT_ON_BOOT=false` and `ALLOW_SCHEMA_RESET=false` and redeploy.
2. Restore your Render Postgres from backup (point-in-time restore):
   - Render Dashboard → Your Postgres → Backups/Restores → Restore to a new database at a time before the deploy.
   - Update your app's DB_* env vars to point to the restored database.
3. Consider extracting only the affected tables (e.g., `check_table`, `users`, `user_logins`) if you prefer migrating data instead of a full DB swap.
4. Keep the dangerous toggles OFF going forward.

**Connection errors:**
- Verify `DB_SSL=true` for Render PostgreSQL
- Check database host/port/credentials

### What Happens on Each Deployment

- The server starts. The schema does NOT run automatically.
- Your data is preserved.

---

## Next Steps After Deployment

1. **Update CORS_ORIGIN**: Set to your actual Render URL
2. **Test authentication**: Register and login
3. **Monitor logs**: Check Render dashboard for errors
4. **Set up custom domain** (optional)

Your app is now production-ready! 🎉
