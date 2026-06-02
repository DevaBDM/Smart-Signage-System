# Test Suite Reference

This document describes the complete test suite for the Smart Digital Signage project: **56 backend tests** (Jest + Supertest, 7 suites) and **73 frontend tests** (Playwright, Chromium).

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | `>=18.0.0` | Enforced by backend `engines` field |
| PostgreSQL | `>=14` | Dev + isolated test database |
| npm | bundled | |
| FFmpeg | `>=5.x` | Required for stream relay integration tests |

---

## 1. Quick Start

Both test suites handle database setup **automatically** — no manual DB creation required.

```bash
# Backend
cd backend
npm install
npm test           # 56 tests, 7 suites

# Frontend
cd frontend
npm install
npx playwright install
npm run test:e2e   # 73 tests, Chromium
```

### What happens automatically

| Step | Backend (`npm test`) | Frontend (`npm run test:e2e`) |
|------|---------------------|-------------------------------|
| DB creation | `jestGlobalSetup.js` creates `signage_test` if missing via `pg` module | `globalSetup.cjs` creates `signage_test` if missing |
| Schema | `prisma db push` runs automatically | `prisma db push` runs automatically |
| Server start | Supertest imports Express app directly | Playwright starts test backend (port 5001) + Vite (port 5173) |
| DB cleanup | `setup.js` cleans tables via `beforeEach` | `globalSetup.cjs` cleans + seeds on start; `resetState()` between describe blocks |

---

## 2. Environment Setup

Your `backend/.env` must contain:

```env
TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
JWT_SECRET=your_super_secret_key_here
```

The test user (`signage_admin`) must exist in PostgreSQL and have `CREATEDB` privilege, or the global setup falls back to the `postgres` superuser.

---

## 3. Running Tests

### Backend

```bash
cd backend
npm test           # Full suite (7 suites, 56 tests)
npm run test:watch # Watch mode
npx jest tests/smoke.test.js   # Single file
```

### Frontend

```bash
cd frontend
npm run test:e2e   # Full suite (73 tests, Chromium)
npx playwright test tests/auth.spec.js          # Single file
npx playwright test tests/creator/              # Directory
npx playwright test --ui                        # Playwright UI
```

### Screenshots

Frontend tests automatically capture screenshots on failure:

```
frontend/test-results/
└── <test-name>-chromium/
    └── test-failed-1.png
```

---

## 4. Backend Test Reference

All backend tests use **Jest** with **Supertest** against the test database.

| File | Type | Coverage |
|------|------|----------|
| `tests/smoke.test.js` | Integration | Posts CRUD, group access, device approval, signage publish, auth |
| `tests/deviceAuth.test.js` | Integration (Socket.IO) | Pi device socket auth, heartbeat, token generation, spoofing rejection |
| `tests/liveStreams.crud.test.js` | Integration | Live stream CRUD, group scoping, URL validation, key rotation |
| `tests/streamRelay.lifecycle.test.js` | Unit (mocked) | Stream relay start/stop/bootstrap with mocked FFmpeg |
| `tests/streamRelay.integration.test.js` | Integration (real FFmpeg) | Generates test video, spawns real FFmpeg HLS relay, verifies segments |
| `tests/userService.priority.test.js` | Unit (service layer) | Priority swap algorithm, role-based constraints |
| `tests/youtubeRelay.test.js` | Unit (mocked) | YouTube URL resolution via `yt-dlp` mock |

### Backend Test Architecture

```
backend/
├── jest.config.js              # Jest config with globalSetup
├── jestGlobalSetup.js          # Auto-create DB, push Prisma schema
└── tests/
    ├── setup.js                # Clean DB beforeEach, disconnect afterAll
    ├── helpers.js              # Factories: createGroup, createUser, createPost, createDevice, createTestServer, waitForEvent
    ├── smoke.test.js
    ├── deviceAuth.test.js
    ├── liveStreams.crud.test.js
    ├── streamRelay.lifecycle.test.js
    ├── streamRelay.integration.test.js
    ├── userService.priority.test.js
    └── youtubeRelay.test.js
```

**Key design decisions:**

- `app.js` / `index.js` split allows Supertest to import the Express app without starting a full server.
- `helpers.js` provides shared `createTestServer()` (HTTP + Socket.IO on random port) and `waitForEvent()`.
- `streamRelay.integration.test.js` uses **real FFmpeg** to generate a test video and verify HLS segment output.
- Database is cleaned between each test via `beforeEach` in `setup.js`.

---

## 5. Frontend Test Reference

All frontend tests use **Playwright** with two modes:

- **API-only (`request`)** — Fast, no browser; hits `localhost:5001/api` directly.
- **Browser UI (`page`)** — Full end-to-end; navigates the React app, fills forms, clicks buttons.

| File | Mode | Coverage |
|------|------|----------|
| `tests/auth.spec.js` | **Browser UI** | Login form, redirect, localStorage token/role verification |
| `tests/admin/devices.spec.js` | API + UI | Device lifecycle: register, approve, list, delete, RBAC |
| `tests/admin/groups.spec.js` | **Browser UI** | Group CRUD via dashboard, signage state changes, delete protection |
| `tests/admin/users.spec.js` | API | User lifecycle: create, update, list, delete, priority swap, managed groups |
| `tests/creator/designer.spec.js` | **Browser UI** | Visual canvas mode, markdown mode, templates, export |
| `tests/creator/live-stream.spec.js` | **Browser UI** | Live stream CRUD, attach to post, feed publishing |
| `tests/creator/posts.spec.js` | API + UI | Post CRUD with image upload, filters, bulk actions, horizontal isolation |
| `tests/creator/signage.spec.js` | API + UI | Publish to signage, asset management, playback controls, urgency filter |
| `tests/smoke/pi-live-stream.spec.js` | Manual | **Requires a real Pi.** Verifies Pi receives `LIVE_STREAM` payload. |

### Frontend Test Architecture

```
frontend/
├── playwright.config.js         # Config with webServer, screenshots on failure, outputDir
└── tests/
    ├── globalSetup.cjs          # Auto-create DB, push schema, seed test-admin + test-creator
    ├── helpers/
    │   └── test-helpers.js      # loginTestAdmin, loginAs, loginViaApi, resetState, seedSignageAsset, ...
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

**Key helpers:**

| Helper | Purpose |
|--------|---------|
| `loginTestAdmin(request)` | Self-healing: tries login, falls back to first-user registration |
| `loginAs(page, user, pass)` | Full UI login flow with localStorage cleanup |
| `loginViaApi(page, request, user, pass)` | API login, sets localStorage directly, bypasses UI |
| `resetState(request)` | Calls `/api/test/reset` to deep-reset DB |
| `createPendingDevice(groupId)` | Seeds a pending device via backend script |

---

## 6. Test Data Isolation

```
Dev server  (port 5000)  -> signage_db   (real data)
Test server (port 5001)  -> signage_test (auto-created + seeded)
Backend Jest             -> signage_test (cleaned between tests)
```

---

## 7. Lint & Format

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

## 8. Troubleshooting

### `relation "X" does not exist`
Run `npx prisma db push` manually (global setup handles this but may fail if DB is locked):
```bash
cd backend
$env:DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npx prisma db push
```

### `Executable doesn't exist at ... chrome-headless-shell.exe`
```bash
cd frontend
npx playwright install
```

### `ERR_CONNECTION_REFUSED at http://localhost:5001/api/health`
Check PostgreSQL is running and `TEST_DATABASE_URL` is set in `backend/.env`.

### `Timeout waiting for disconnect` (backend)
`deviceAuth.test.js` requires a clean socket connection. Restart the test runner.

---

## 9. CI Example (GitHub Actions)

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
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install
      - run: cd frontend && npm run test:e2e
        env:
          TEST_DATABASE_URL: postgresql://signage_admin:yourpassword@localhost:5432/signage_test
          JWT_SECRET: ci-test-secret
```

---

_Last updated: June 2026_
