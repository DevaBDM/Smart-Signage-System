# Test Suite Reference

This document describes the complete test suite for the Smart Digital Signage project: backend tests (Jest + Supertest) and frontend tests (Playwright).

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | `>=18.0.0` | Enforced by backend `engines` field |
| PostgreSQL | `>=14` | Dev + isolated test database |
| npm | bundled | |

---

## 1. Test Database Setup

Create a dedicated test database so tests do not interfere with development data.

```bash
# Create database
createdb -U postgres signage_test
# or via SQL:
psql -U postgres -c "CREATE DATABASE signage_test;"
```

Create a test user and grant permissions:

```sql
CREATE USER signage_admin WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE signage_test TO signage_admin;
ALTER DATABASE signage_test OWNER TO signage_admin;
\c signage_test
GRANT ALL ON SCHEMA public TO signage_admin;
```

Push the Prisma schema to the test database:

```bash
cd backend
$env:DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npx prisma db push
```

Your `backend/.env` must contain:

```env
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
JWT_SECRET=your_super_secret_key_here
```

---

## 2. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Playwright browsers (required for frontend tests)
cd frontend && npx playwright install
```

---

## 3. Running the Full Suite

### Backend

```bash
cd backend
npm test           # Run all backend tests against TEST_DATABASE_URL
npm run test:watch # Watch mode
```

### Frontend

```bash
cd frontend
npm run test:e2e   # Run all Playwright specs
```

This command:
1. Runs `globalSetup.cjs` to clean and seed the test database
2. Starts the test backend on `localhost:5001` (`../backend/start-test-server.js`)
3. Starts the Vite dev server on `localhost:5173`
4. Executes all tests in `frontend/tests/`

> **Note:** If you already have servers running, Playwright reuses them when not in CI mode.

---

## 4. Running Individual Tests

### Backend — single file

```bash
cd backend
npx jest tests/smoke.test.js
npx jest tests/deviceAuth.test.js
npx jest tests/liveStreams.crud.test.js
npx jest tests/streamRelay.lifecycle.test.js
npx jest tests/userService.priority.test.js
npx jest tests/youtubeRelay.test.js
```

### Frontend — single file or pattern

```bash
cd frontend
npx playwright test tests/auth.spec.js
npx playwright test tests/admin/devices.spec.js
npx playwright test tests/creator/
npx playwright test --ui   # Open Playwright UI for debugging
```

---

## 5. Backend Test Reference

All backend tests use **Jest** with **Supertest** and hit the test database.

| File | Type | Coverage |
|------|------|----------|
| `tests/smoke.test.js` | Integration | Posts CRUD, group access control, device registration/heartbeat, content sync, auth login/register |
| `tests/deviceAuth.test.js` | Integration (Socket.IO) | Pi device socket authentication, heartbeat ack, content_sync ack, real HTTP + Socket.IO server per test |
| `tests/liveStreams.crud.test.js` | Integration | Live stream CRUD endpoints, group-scoped listing, URL validation |
| `tests/streamRelay.lifecycle.test.js` | Unit (mocked) | Stream relay orchestration with mocked `child_process.spawn`, `fs`, `@ffmpeg-installer`, `@ffprobe-installer`, and `prisma` |
| `tests/userService.priority.test.js` | Unit (service layer) | `updateUser` priority swap logic, role-based constraints |
| `tests/youtubeRelay.test.js` | Unit (mocked) | YouTube URL resolution via mocked `yt-dlp`/`youtube-dl` child process stdout |

### Backend Test Architecture

```
backend/tests/
├── setup.js              # Jest setup: validates TEST_DATABASE_URL, cleans DB before each test
├── helpers.js            # Factories: createGroup, createUser, createPost, createPostImage, createDevice
├── smoke.test.js
├── deviceAuth.test.js
├── liveStreams.crud.test.js
├── streamRelay.lifecycle.test.js
├── userService.priority.test.js
└── youtubeRelay.test.js
```

**Key design decisions:**

- `setup.js` runs `beforeAll` to validate `TEST_DATABASE_URL` and `afterEach` to clean tables respecting FK order.
- `app.js` / `index.js` split allows Supertest to import the Express app without starting a server.
- `deviceAuth.test.js` creates a real HTTP server on a random port and connects a Socket.IO client to test end-to-end Pi auth.
- `streamRelay.lifecycle.test.js` and `youtubeRelay.test.js` are heavily mocked to avoid spawning real FFmpeg/yt-dlp processes.

---

## 6. Frontend Test Reference

All frontend tests use **Playwright**. They fall into two modes:

- **API-only (`request`)** — Fast, no browser navigation; hits `localhost:5001/api` directly.
- **Browser UI (`page`)** — Full end-to-end; navigates the React app, fills forms, clicks buttons, verifies DOM state.

| File | Mode | Coverage |
|------|------|----------|
| `tests/auth.spec.js` | **Browser UI** | Login form submission, redirect to `/admin`, `localStorage` token/role verification |
| `tests/admin/devices.spec.js` | API + UI | Device lifecycle: register, approve, list, delete; RBAC verification |
| `tests/admin/groups.spec.js` | **Browser UI** | Admin login, group CRUD via dashboard UI, form validation |
| `tests/admin/users.spec.js` | API | User lifecycle: create, update role, list, delete; creator vs admin scoping |
| `tests/creator/designer.spec.js` | **Browser UI** | Post designer loads, visual canvas mode, markdown slide mode, toolbar visibility |
| `tests/creator/live-stream.spec.js` | API | Live stream creation with HLS URL, group-scoped listing |
| `tests/creator/posts.spec.js` | API + UI | Post CRUD with image upload, scheduling, duration, publishing to signage |
| `tests/creator/signage.spec.js` | API + UI | Publish post to signage, approve pending device, verify deployment payload |
| `tests/smoke/pi-live-stream.spec.js` | Manual | **Requires a real Raspberry Pi.** Verifies Pi receives `LIVE_STREAM` deployment payload. |

### Frontend Test Architecture

```
frontend/tests/
├── globalSetup.cjs              # Cleans test DB and seeds test-admin + test-creator accounts
├── helpers/
│   └── test-helpers.js          # loginTestAdmin, loginAs, resetState, seedSignageAsset,
│                                 # seedVideoPost, seedSignageDeployment, createPendingDevice,
│                                 # mockImagePath, miniPngBuffer
├── auth.spec.js
├── admin/
│   ├── devices.spec.js
│   ├── groups.spec.js
│   └── users.spec.js
├── creator/
│   ├── designer.spec.js
│   ├── live-stream.spec.js
│   ├── posts.spec.js
│   └── signage.spec.js
└── smoke/
    └── pi-live-stream.spec.js
```

**Key design decisions:**

- `playwright.config.js` starts **two** `webServer` processes: the test backend (`../backend/start-test-server.js` on port 5001) and the Vite dev server (port 5173). Tests can use either endpoint.
- `globalSetup.cjs` runs once before all tests to wipe the database and seed two accounts (`test-admin` / `test-creator`).
- `workers: 1` + `test.describe.configure({ mode: "serial" })` in every spec ensures tests do not race against shared DB state.
- `loginTestAdmin(request)` is self-healing: tries login first, falls back to first-user registration if the account does not exist.
- Browser UI tests use `baseURL: "http://localhost:5173"` so `page.goto("/login")` hits the React app.
- API-only tests use `API_URL = "http://localhost:5001/api"` and the `request` fixture.
- `resetState(request)` hits the backend `/api/test/reset` endpoint to deep-reset DB between serial describe blocks.

---

## 7. Test Data Isolation

```
Dev server  (port 5000)  -> signage_db   (real data)
Test server (port 5001)  -> signage_test (auto-seeded by globalSetup.cjs / start-test-server.js)
Backend Jest             -> signage_test (cleaned between tests by setup.js)
```

---

## 8. Lint & Format

```bash
# Backend
cd backend
npm run lint      # ESLint
npm run format    # Prettier

# Frontend
cd frontend
npm run lint      # ESLint
npm run format    # Prettier
```

---

## 9. Troubleshooting

### `relation "X" does not exist`

Push the Prisma schema to the test database:

```bash
cd backend
$env:DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npx prisma db push
```

### `permission denied for schema public`

```sql
\c signage_test
GRANT ALL ON SCHEMA public TO signage_admin;
```

### `Executable doesn't exist at ... chrome-headless-shell.exe`

```bash
cd frontend
npx playwright install
```

### `ERR_CONNECTION_REFUSED at http://localhost:5001/api/health`

Playwright timed out waiting for the test backend. Check:
- `TEST_DATABASE_URL` is set in `backend/.env`
- PostgreSQL is running
- Run `node ../backend/start-test-server.js` manually to see the error

### `Timeout waiting for disconnect` (backend)

`deviceAuth.test.js` requires a clean socket connection. If a previous test left the socket open, restart the test runner.

### Backend lint: `node/no-unsupported-features/es-syntax`

Ensure `backend/package.json` has:

```json
"engines": { "node": ">=18.0.0" }
```

### Frontend lint: `process is not defined`

Ensure `frontend/eslint.config.js` contains:

```js
globals: { ...globals.browser, process: 'readonly' }
```

---

## 10. CI Example (GitHub Actions)

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: signage_test
          POSTGRES_USER: signage_admin
          POSTGRES_PASSWORD: yourpassword
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma db push
        env:
          DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test
      - run: cd backend && npm test
        env:
          TEST_DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test
          JWT_SECRET: ci-test-secret

  frontend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: signage_test
          POSTGRES_USER: signage_admin
          POSTGRES_PASSWORD: yourpassword
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma db push
        env:
          DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install
      - run: cd frontend && npm run test:e2e
        env:
          TEST_DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test
          JWT_SECRET: ci-test-secret
```

---

_Last updated: May 2026_
