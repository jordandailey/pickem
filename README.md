# Pick'em Contest App

## Beta Deployment (Railway + Vercel — free, public URL)

### Step 1: Deploy the backend to Railway
1. Go to railway.app → New Project → Deploy from GitHub
2. Push the `backend/` folder to a GitHub repo (or connect this folder)
3. Set these environment variables in Railway:
   - `DATABASE_URL` — Railway will auto-fill this when you add a Postgres plugin
   - `JWT_SECRET` — any long random string (e.g. generate at random.org)
   - `PORT` — 3001
   - `NODE_ENV` — production
4. Add a PostgreSQL plugin in Railway — it auto-sets DATABASE_URL
5. Your backend URL will be something like `https://pickem-backend.up.railway.app`

### Step 2: Deploy the frontend to Vercel
1. Go to vercel.com → New Project → Import GitHub repo
2. Set root directory to `frontend/`
3. Set environment variable:
   - `VITE_API_URL` = `https://your-railway-url.up.railway.app/api`
4. Deploy — you'll get a URL like `https://pickem.vercel.app`

### Step 3: Update backend CORS
In Railway, add:
- `FRONTEND_URL` = `https://your-vercel-url.vercel.app`

---

## Home Server Deployment (Docker)

```bash
# Clone / copy this folder to your server
cd pickem

# Edit JWT_SECRET in docker-compose.yml first!

docker-compose up -d

# App runs at http://localhost
# Backend API at http://localhost:3001
```

---

## Player Logins (Beta)
Default password = username for all players:

| Name      | Username | Password |
|-----------|----------|----------|
| Dan S.    | dans     | dans     |
| Jack      | jack     | jack     |
| Tony 2    | tony2    | tony2    |
| Rich K.   | richk    | richk    |
| Luke      | luke     | luke     |
| Steve S.  | steves   | steves   |
| Tony      | tony     | tony     |
| Dan D.    | dand     | dand     |
| Dave I.   | davei    | davei    |
| Jordan    | jordan   | jordan   |
| Scott     | scott    | scott    |
| Sebby     | sebby    | sebby    |
| Troy      | troy     | troy     |
| Joe Jr.   | joejr    | joejr    |
| Peter I.  | peteri   | peteri   |
| Verdi     | verdi    | verdi    |
| Joey I.   | joeyi    | joeyi    |

**Jack is the admin.** Admin panel visible only when logged in as jack.

---

## Commissioner Workflow Each Week

1. **Wednesday**: Log in as jack → Admin → Set up new week → Add games (enter lines manually)
2. **Friday 10pm**: Picks auto-lock at deadline
3. **After games**: Admin → Enter final scores → app grades all picks automatically
4. **Adjust if needed**: Admin → (coming: pick override panel)

---

## Making Changes via Claude
Tell Claude what you want changed and paste the file path + current code.
Claude will give you the exact replacement to copy in.

Example: "Change the grand prize to $2,500 in the seed data"
→ Claude edits `backend/src/db/schema.sql` line XX
