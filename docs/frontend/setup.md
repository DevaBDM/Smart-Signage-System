# Frontend Setup & Installation

This document describes how to install, configure, build, and deploy the Smart Signage frontend.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime and package manager |
| Backend | Running | API server on port 5000 (or configured URL) |

### Verify Prerequisites

```bash
node --version      # Should be v18.x.x or higher
```

---

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

> **Fabric.js pin:** The project requires `fabric@5.3.0` exactly. It is already in `package.json`, but if you encounter issues:
> ```bash
> npm install fabric@5.3.0 --save-exact
> ```

### 2. Configure Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL. In dev, Vite proxies `/api` to this origin. |
| `VITE_PROXY_TARGET` | No | Override proxy target in `vite.config.js` (defaults to `http://127.0.0.1:5000`) |
| `VITE_API_PORT` | No | Backend port fallback (defaults to `5000`) |

> **Vite rule:** Only variables prefixed with `VITE_` are exposed to the client.

### 3. Start Development Server

```bash
npm run dev
```

- Vite dev server starts on `http://localhost:5173`
- API calls to `/api`, `/uploads`, `/streams`, and `/socket.io` are proxied to the backend
- Hot Module Replacement (HMR) is active for instant UI updates

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Start Vite dev server with HMR |
| Build | `npm run build` | Production build to `dist/` |
| Preview | `npm run preview` | Preview production build locally |
| Lint | `npm run lint` | Run ESLint |
| Format | `npm run format` | Run Prettier on all files |
| Test | `npm run test:e2e` | Run Playwright E2E tests |

---

## Production Build

```bash
npm run build
```

Outputs to `frontend/dist/`:
- Optimized JS bundles with tree shaking
- CSS extracted and minified
- Asset hashes for cache busting
- `index.html` with injected script/link tags

---

## Production Deployment

### Static File Server

The frontend is a single-page application. The server must serve `index.html` for all non-file routes.

#### Nginx (Recommended)

```nginx
server {
    listen 80;
    server_name signage.example.com;
    root /var/www/signage-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /uploads/ {
        proxy_pass http://localhost:5000/uploads/;
    }

    location /streams/ {
        proxy_pass http://localhost:5000/streams/;
    }
}
```

#### Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### Important Notes

- **Client-side routing** — All routes are handled by React Router. Direct links to `/admin/devices` must serve `index.html`.
- **API separation** — In production, `VITE_API_URL` must point to the backend. The frontend does not proxy API calls.
- **Uploads/streams** — Media and HLS streams are served by the backend, not the frontend.

---

## Testing

### Playwright E2E Tests

The project uses Playwright for end-to-end testing against real browsers.

#### Install Browsers (one-time)

```bash
npx playwright install
```

#### Run Tests

```bash
# All tests
npm run test:e2e

# Specific suites
npx playwright test tests/admin/        # Admin dashboard tests
npx playwright test tests/creator/       # Creator workflow tests
npx playwright test tests/auth.spec.js   # Login/logout tests
npx playwright test tests/smoke/       # Pi/Anthias smoke tests
```

#### Test Infrastructure

`playwright.config.js` automatically starts both backend and frontend:

```js
webServer: [
  {
    command: "node ../backend/start-test-server.js",
    url: "http://localhost:5001/api/health",
  },
  {
    command: "npm run dev",
    url: "http://localhost:5173",
    env: { VITE_PROXY_TARGET: "http://127.0.0.1:5001" },
  },
];
```

> **Important:** Do not run your production backend on port 5001 when executing tests.

#### Test Helpers

- `login(page, username, password)` — Authenticate and store session
- `resetDatabase()` — Clean test data between runs
- `seedTestData()` — Create predictable fixtures

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `Fabric is not defined` | Wrong Fabric.js version | `npm install fabric@5.3.0 --save-exact` |
| Canvas not rendering | Fabric.js initialization race | Ensure canvas element is mounted before Fabric initializes |
| Vite HMR not working | Cache or plugin issue | `npm run dev -- --force` |
| API 404 / CORS errors | Backend not running or wrong URL | Verify backend is running; check `VITE_API_URL` in `.env` |
| 401 Unauthorized loops | Expired token not cleared | Clear localStorage `token`; re-login |
| `role is undefined` | Profile not hydrated | Refresh page to trigger `/auth/me` call |
| Playwright tests fail | Port 5001 occupied | Kill any process on port 5001 before running tests |
| Live stream preview black | hls.js not loading | Check browser console for HLS manifest fetch errors |
| Markdown math not rendering | KaTeX CSS not loaded | Check that `rehype-katex` styles are imported |

---

_This document is part of the Smart Signage frontend documentation. See `frontend/README.md` for the high-level overview._
