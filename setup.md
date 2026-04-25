# setup.md

This guide explains how to set up SmartExpense Tracker from scratch on a new machine.

## 1. Prerequisites

Install the following first:

- Node.js 20+ and npm
- Python 3.11+ (tested with Python 3.14)
- A Supabase account and project
- Git

Optional but recommended:

- VS Code
- A Python virtual environment manager

## 2. Clone and enter project

```bash
git clone <your-repository-url>
cd SmartExpenseTracker
```

Expected top-level folders:

- [frontend](frontend)
- [backend](backend)

## 3. Create Supabase project and schema

1. Create a new Supabase project.
2. Open SQL Editor.
3. Run the full schema file from [frontend/supabase/schema.sql](frontend/supabase/schema.sql).

This creates all tables, policies, triggers, and default category seeding behavior.

## 4. Configure Supabase Auth providers

In Supabase Dashboard:

1. Go to Authentication > Providers.
2. Enable Email provider (enabled by default in many projects).
3. Go to Authentication > Settings and disable Confirm email.

## 5. Backend setup

Go to backend folder:

```bash
cd backend
```

Create environment file:

- Copy [backend/.env.example](backend/.env.example) to .env

Set variables in backend .env:

- SUPABASE_URL: your Supabase project URL
- SUPABASE_ANON_KEY: your Supabase anon key
- SUPABASE_SERVICE_ROLE_KEY: your Supabase service role key
- FRONTEND_URL: frontend origin (for CORS), for example http://localhost:5173
- PORT: backend port, for example 5000

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Run backend:

```bash
python app.py
```

Quick check:

- Open http://localhost:5000/health
- Expected response: {"ok": true}

## 6. Frontend setup

Open a second terminal:

```bash
cd frontend
```

Create environment file:

- Copy [frontend/.env.example](frontend/.env.example) to .env

Set variables in frontend .env:

- VITE_API_BASE_URL=http://localhost:5000

Install dependencies:

```bash
npm install
```

Start frontend:

```bash
npm run dev
```

Open the shown URL (usually http://localhost:5173).

## 7. Verify full flow

1. Sign up with email/password.
2. Sign in with username/password and access dashboard.
3. Create categories, expenses, income records.
4. Add investment and subscription plans.
5. Confirm recurring plans generate expense rows.
6. Check savings forecast page with trend chart.

## 8. Production deployment approach

Deploy frontend and backend separately.

### Frontend

- Build command: npm run build
- Output folder: frontend/dist
- Set VITE_API_BASE_URL to deployed backend URL

### Backend

- Deploy as a Python web app
- Keep SUPABASE_SERVICE_ROLE_KEY only in backend environment variables
- Set FRONTEND_URL to your deployed frontend origin

## 9. Security checklist

Before production, verify:

1. Service role key is never exposed in frontend files.
2. CORS only allows trusted frontend origins.
3. HTTPS is enabled for frontend and backend.
4. Rotate keys if they are ever leaked.

## 10. Common issues and fixes

### Frontend cannot reach backend

- Check VITE_API_BASE_URL value
- Confirm backend is running on expected port
- Verify CORS FRONTEND_URL matches frontend origin exactly

### Unauthorized API errors

- Confirm login completed and token exists in browser storage
- Check Authorization header is sent
- Verify Supabase project URL and keys in backend .env

### Build failures

- Frontend: run npm install again, then npm run build
- Backend: verify python version and reinstall requirements

## 11. Useful commands

Frontend build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
cd backend
python -m py_compile app.py
```

## 12. Suggested next setup improvements

1. Add Dockerfiles for frontend and backend.
2. Add docker-compose for one-command local startup.
3. Add GitHub Actions for CI build and lint checks.
4. Add automated tests before deploy.
