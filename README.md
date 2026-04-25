# SmartExpense Tracker

SmartExpense Tracker is a full-stack personal finance application that helps users track monthly expenses, salary, savings, investments, subscriptions, and savings forecasts.

This project is implemented as two separately deployable services:

- Frontend service: React + TypeScript + Vite + Tailwind + Recharts
- Backend service: Python Flask API that owns all Supabase access

The frontend no longer communicates with Supabase directly. All authentication and data operations flow through the backend API.

## Problem Statement

The original implementation used direct frontend-to-Supabase communication. While this is valid for many products, it becomes less ideal when:

- Frontend and backend are deployed as independent services
- A centralized API policy layer is required
- You want a single place for auth/session checks, query validation, and data scoping

This solution introduces a backend API facade over Supabase to support production-ready multi-service deployment.

## Final Solution Summary

### 1) Separated deployment units

The codebase is split into two isolated folders:

- frontend: all web client code and build artifacts
- backend: Flask API service and Python dependencies

This enables separate CI/CD pipelines, release schedules, and infrastructure scaling.

### 2) Backend-owned Supabase access

The backend service in [backend/app.py](backend/app.py) handles:

- Auth flows
- Session/user validation
- Query operations
- Data mutation operations

Supabase credentials are stored in backend environment variables and not exposed to browser runtime.

### 3) Frontend client abstraction

The file [frontend/src/lib/supabase.ts](frontend/src/lib/supabase.ts) was replaced with a backend-proxy client that preserves the call style used by pages and modals.

This minimizes frontend rewrites while redirecting operations to Flask endpoints.

### 4) Security controls

The backend applies user-scoping rules for user-owned tables before executing DB operations.

Even though database access uses a service key, rows are constrained by authenticated user identity.

## Feature Coverage

The delivered app supports:

- Monthly expense tracking
- Category-based expense organization (Food, Grocery, Movies, Sports, etc.)
- Custom category creation
- Monthly salary/income tracking
- Savings tracking and cumulative insight
- Dashboard metrics and visual trends
- Category increase/decrease patterns and averages
- Savings forecasting from historical trends
- Investment tracking (SIP, Stock, Mutual Fund, etc.)
- Automatic expense generation for recurring investments
- Subscription tracking (monthly, quarterly, yearly)
- Automatic expense generation for subscriptions
- Multi-user auth with username/password sign-in

## Architecture

## High-level flow

1. User opens frontend and authenticates.
2. Frontend obtains/stores access token.
3. Frontend sends API requests to Flask with Bearer token.
4. Flask validates token with Supabase Auth.
5. Flask executes scoped queries/mutations via Supabase.
6. Flask returns sanitized responses to frontend.

## Folder structure

- [frontend](frontend)
- [frontend/src](frontend/src)
- [frontend/src/pages](frontend/src/pages)
- [frontend/src/components](frontend/src/components)
- [frontend/src/contexts](frontend/src/contexts)
- [frontend/src/lib](frontend/src/lib)
- [backend](backend)
- [backend/app.py](backend/app.py)
- [backend/requirements.txt](backend/requirements.txt)
- [frontend/supabase/schema.sql](frontend/supabase/schema.sql)

## Backend API Endpoints

Implemented in [backend/app.py](backend/app.py):

- GET /health
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET /auth/session
- POST /db/query
- POST /db/mutate

### DB operations design

The frontend sends generic query/mutation payloads to reduce endpoint count and keep UI implementation flexible.

The backend still enforces table-level user scoping for safety.

## Data Model

Database schema is in [frontend/supabase/schema.sql](frontend/supabase/schema.sql).

Core tables:

- profiles
- categories
- expenses
- income
- investments
- subscriptions

The schema includes:

- Row Level Security policies
- Auth trigger for profile/category seeding
- Updated_at triggers
- Constraints for valid frequency, billing cycles, and amount validation

## Authentication Design

- Username/password signup and login are supported through backend auth endpoints.
- Access token is stored client-side and sent as Authorization Bearer token.
- Auth state in frontend is managed in [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx).

## Frontend UX Design

The UI was designed to be:

- Clean and responsive
- Easy to operate on desktop and mobile
- Organized by domain pages (Dashboard, Expenses, Income, Categories, Investments, Subscriptions, Savings)

Reusable modal forms provide consistent CRUD behavior:

- [frontend/src/components/modals/ExpenseModal.tsx](frontend/src/components/modals/ExpenseModal.tsx)
- [frontend/src/components/modals/CategoryModal.tsx](frontend/src/components/modals/CategoryModal.tsx)
- [frontend/src/components/modals/IncomeModal.tsx](frontend/src/components/modals/IncomeModal.tsx)
- [frontend/src/components/modals/InvestmentModal.tsx](frontend/src/components/modals/InvestmentModal.tsx)
- [frontend/src/components/modals/SubscriptionModal.tsx](frontend/src/components/modals/SubscriptionModal.tsx)

## Auto-generated Expenses

Recurring investment/subscription costs are synchronized via:

- [frontend/src/lib/autoExpenses.ts](frontend/src/lib/autoExpenses.ts)

On authenticated load, the app evaluates active plans and inserts missing expense rows up to current date.

## Build and Validation Status

Validated locally:

- Frontend TypeScript and production build: success
- Backend Python compile check: success

## Deployment Model

Deploy frontend and backend independently:

- Frontend can be hosted on static platforms (Vercel, Netlify, Azure Static Web Apps)
- Backend can be hosted on API platforms (Azure App Service, Render, Railway, Fly.io)
- Supabase is managed externally

Use environment variables to connect services without hardcoding hostnames or credentials.

## Risks and Notes

- Current token persistence is local storage based.
- Generic /db/query and /db/mutate endpoints require careful backend validation as the system evolves.
- Chunk-size warning exists in frontend build and can be optimized with route-level code splitting.

## Recommended Next Improvements

1. Add strict request schema validation in Flask (pydantic or marshmallow).
2. Add rate limiting and API key abuse protection at edge or gateway.
3. Add structured logging and tracing for API debugging.
4. Add automated tests:
   - Backend unit tests for auth and scoping
   - Frontend integration tests for critical flows
5. Add route-based code splitting to reduce frontend bundle size.

## License

Use your preferred license (MIT, Apache-2.0, or proprietary) before publishing.
