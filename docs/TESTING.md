# Testing Guide

This document covers how to run the test suite for both the backend (Jest + Supertest) and frontend (Playwright) codebases.

---

## Prerequisites

| Requirement | Version           | Notes                                    |
| ----------- | ----------------- | ---------------------------------------- |
| Node.js     | `>=18.0.0`        | Backend `engines` field enforces this    |
| PostgreSQL  | `>=14`            | Required for both dev and test databases |
| npm         | bundled with Node |                                          |

## 1. Test Database Setup

The backend tests use a **dedicated test database** so they don't interfere with your development data.

### Create the test database

```bash
# Using psql (run as a PostgreSQL superuser)
createdb -U postgres signage_test

# Or via SQL
psql -U postgres -c "CREATE DATABASE signage_test;"
```

### Create the test user

```sql
-- Run inside psql as superuser
CREATE USER signage_admin WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE signage_test TO signage_admin;
ALTER DATABASE signage_test OWNER TO signage_admin;

-- Grant schema permissions (needed for Prisma)
\c signage_test
GRANT ALL ON SCHEMA public TO signage_admin;
```

### Sync the Prisma schema

```bash
cd backend
$env:DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npx prisma db push
```

### Verify `.env`

Your `backend/.env` should contain:

```env
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
JWT_SECRET=your_super_secret_key_here
```

---

## 2. Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

### Playwright Browsers (frontend e2e only)

```bash
cd frontend
npx playwright install
```

This downloads Chromium (~100MB) required for headless browser tests.

---

## 3. Running Tests

### Backend Unit/Smoke Tests

```bash
cd backend
# Option 1: Let jest.config.js pick up TEST_DATABASE_URL from .env
npm test

# Option 2: Explicitly override (useful in CI)
$env:TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npm test
```

Expected output:

```
 PASS  tests/smoke.test.js
  POST /api/posts
    √ creates a post and returns it
    √ rejects post without group access
  ...

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

### Backend Watch Mode

```bash
cd backend
npm run test:watch
```

### Frontend E2E Tests

```bash
cd frontend
npm run test:e2e
```

This command:

1. Auto-starts a **test backend** on `localhost:5001` (via `webServer` config)
2. The test backend connects to `signage_test` DB (isolated from dev)
3. Mocks Socket.IO so signage publish works without a real Raspberry Pi
4. Runs 2 API-only smoke tests against `localhost:5001`

Expected output:

```
Running 2 tests using 1 worker
  ✓  create a post via API
  ✓  publish to signage and approve device

  2 passed (2s)
```

### Frontend E2E with UI (debugging)

```bash
cd frontend
npx playwright test --ui
```

---

## 4. Lint & Format

### Backend

```bash
cd backend
npm run lint      # ESLint check
npm run format    # Prettier fix
```

### Frontend

```bash
cd frontend
npm run lint      # ESLint check
npm run format    # Prettier fix
```

---

## 5. Test Architecture

### Backend (`backend/tests/`)

| File            | Purpose                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| `setup.js`      | Jest setup: DB cleanup between tests via `deleteMany`                                   |
| `helpers.js`    | Factories: `createGroup`, `createUser`, `createPost`, `createPostImage`, `createDevice` |
| `smoke.test.js` | 11 tests covering posts, signage, devices, auth                                         |

**Key design decisions:**

- Tests use the test database (`TEST_DATABASE_URL`) exclusively
- `app.js` / `index.js` split allows `supertest` to import the Express app without starting a server
- Socket.IO is mocked via `app.set("emitToDeviceAck", jest.fn(...))`

### Frontend (`frontend/tests/`)

| File            | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `smoke.spec.js` | 2 e2e tests: create post via API, publish to signage |

**Key design decisions:**

- API-only tests (no UI navigation) for reliability without a running Vite dev server
- `playwright.config.js` auto-starts `../backend/start-test-server.js` on port 5001
- Test backend mocks Socket.IO (`emitToDeviceAck`) so no real Pi is needed
- `loginTestAdmin()` is self-healing: tries login first, falls back to first-user registration

### Test Data Isolation

```
Dev server  (port 5000) → signage_db  (real data)
Test server (port 5001) → signage_test (test data, auto-seeded)
Backend Jest              → signage_test (cleaned between tests)
```

---

## 6. Troubleshooting

### `ERR_CONNECTION_REFUSED at http://localhost:5173`

The old UI-based tests required the Vite dev server. The current tests are **API-only** and hit `localhost:5001` (auto-started test backend). If you see this, ensure your `smoke.spec.js` uses `API_URL = "http://localhost:5001/api"`.

### `relation "X" does not exist`

Run Prisma db push on the test database:

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

Playwright browsers not installed:

```bash
cd frontend
npx playwright install
```

### Backend lint: `node/no-unsupported-features/es-syntax`

Make sure `backend/package.json` has:

```json
"engines": { "node": ">=18.0.0" }
```

### Frontend lint: `process is not defined`

The ESLint config already adds `process` to globals. If this error appears, ensure `frontend/eslint.config.js` contains:

```js
globals: { ...globals.browser, process: 'readonly' }
```

---

## 7. CI Considerations

For GitHub Actions or similar:

```yaml
- name: Start PostgreSQL
  uses: harmon758/postgresql-action@v1
  with:
    postgresql version: "14"
    postgresql db: signage_test
    postgresql user: signage_admin
    postgresql password: yourpassword

- name: Setup backend
  run: |
    cd backend
    npm ci
    npx prisma db push

- name: Run backend tests
  run: cd backend && npm test
  env:
    TEST_DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test

- name: Setup frontend
  run: |
    cd frontend
    npm ci
    npx playwright install

- name: Run frontend e2e tests
  run: cd frontend && npm run test:e2e
```

---

_Last updated: Phase 0 baseline — pre-refactor._
