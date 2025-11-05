# 🚀 Render Deployment Checklist

## Pre-Deployment

- [ ] Review `DEPLOYMENT_SUMMARY.md` for complete overview
- [ ] Read `RENDER_DEPLOYMENT.md` for detailed steps
- [ ] Install dependencies: `npm install`
- [ ] Verify `schema-postgres.sql` exists
- [ ] Verify `scripts/init-postgres.js` exists
- [ ] Verify `render.yaml` is configured

## Render Setup

### 1. Create PostgreSQL Database
- [ ] Go to https://render.com
- [ ] Click **New +** → **PostgreSQL**
- [ ] Name: `app-sg-phone-db`
- [ ] Click **Create Database**
- [ ] Wait for provisioning
- [ ] **Copy these values** (you'll need them):
  - [ ] Host
  - [ ] Database  
  - [ ] User
  - [ ] Password
  - [ ] Port

### 2. Create Web Service
- [ ] Click **New +** → **Web Service**
- [ ] Connect GitHub: `htooaunglynn/app-sg-phone`
- [ ] Select branch: `main`
- [ ] Verify `render.yaml` is detected
- [ ] Click **Create Web Service**

### 3. Set Environment Variables
- [ ] Go to Environment tab
- [ ] Click "Add from .env"
- [ ] Paste and update these values:

```env
DB_HOST=<from-your-postgresql>
DB_PORT=5432
DB_NAME=<from-your-postgresql>
DB_USER=<from-your-postgresql>
DB_PASSWORD=<from-your-postgresql>
DB_SSL=true
NODE_ENV=production
PORT=4000
SESSION_SECRET=<generate-random-secret>
SESSION_TIMEOUT=86400000
CORS_ORIGIN=https://<your-app-name>.onrender.com
```

- [ ] Generate SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Click **Save Changes**

### 4. Deploy
- [ ] Wait for build to complete
- [ ] Check build logs for: **"✅ Database initialization completed successfully!"**
- [ ] Note your app URL: `https://<your-app-name>.onrender.com`

## Post-Deployment Verification

- [ ] Visit your app URL
- [ ] Test `/register` page
- [ ] Create a test account
- [ ] Test `/login` page
- [ ] Login with test account
- [ ] Verify home page loads
- [ ] Check Render logs for errors

## Database Verification

- [ ] Go to your PostgreSQL database in Render
- [ ] Click **PSQL Console** or **Shell**
- [ ] Run: `\dt` (should show: users, user_logins, check_table)
- [ ] Run: `SELECT COUNT(*) FROM users;` (should show your test user)

## Update CORS (After First Deploy)

- [ ] Copy your actual Render URL
- [ ] Update `CORS_ORIGIN` environment variable
- [ ] Save changes (Render will auto-redeploy)

## Auto-Deploy Setup (Already Configured)

✅ `render.yaml` has:
- `autoDeploy: true`
- `branch: main`

**Every push to `main` branch will auto-deploy!**

## Common Issues

### Build fails at schema initialization
- [ ] Verify all DB_* environment variables are set
- [ ] Check PostgreSQL database is running
- [ ] Review build logs for specific error

### Can't connect to database
- [ ] Verify `DB_SSL=true` is set
- [ ] Check DB_HOST, DB_PORT are correct
- [ ] Verify PostgreSQL database is in same region

### Tables not created
- [ ] Check build logs for schema initialization errors
- [ ] Manually run schema in PostgreSQL console
- [ ] Verify `schema-postgres.sql` is valid

---

## Success! 🎉

When you see:
- ✅ "✅ Database initialization completed successfully!" in build logs
- ✅ Your app loads at `https://your-app.onrender.com`
- ✅ You can register and login
- ✅ Tables exist in PostgreSQL console

**Your deployment is complete!**

---

## Need Help?

- Review `RENDER_DEPLOYMENT.md` for detailed instructions
- Check Render dashboard for error logs
- Verify environment variables are correct
- Test PostgreSQL connection in Shell
