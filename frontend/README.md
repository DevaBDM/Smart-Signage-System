# Smart Digital Signage — Frontend

React + Vite frontend for the Smart Digital Signage System. Provides admin and creator dashboards, live stream management, post creation with Fabric.js visual editor, and device signage control.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite 5 |
| State Management | Zustand (`useAuthStore.js`) |
| HTTP Client | Axios (`api/axios.js`) |
| Realtime | Socket.IO Client |
| UI Components | Custom + Fabric.js 5.3.0 (visual designer) |
| Styling | Inline styles + `styles.js` tokens |
| Testing | Playwright |

---

## Project Structure

```
frontend/
├── src/
│   ├── api/                     ← Backend API wrappers
│   │   ├── auth.js
│   │   ├── devices.js
│   │   ├── groups.js
│   │   ├── liveStreams.js       ← Live stream CRUD + start/stop
│   │   ├── media.js
│   │   ├── playlists.js
│   │   ├── posts.js
│   │   ├── signage.js
│   │   └── users.js
│   │
│   ├── components/              ← Reusable UI components
│   │   ├── AdminSidebar.jsx
│   │   ├── CreatorSidebar.jsx
│   │   └── FabricDesigner.jsx   ← Visual post editor (Fabric.js)
│   │
│   ├── context/
│   │   └── AuthContext.jsx      ← React auth context provider
│   │
│   ├── pages/
│   │   ├── admin/               ← Admin-only pages
│   │   ├── creator/             ← Creator pages
│   │   │   ├── CreatorDashboard.jsx
│   │   │   ├── CreatorEditor.jsx       ← Post editor with Fabric.js
│   │   │   ├── CreatorLiveStreams.jsx  ← Live stream management
│   │   │   ├── CreatorPosts.jsx
│   │   │   └── CreatorSignage.jsx
│   │   └── public/              ← Public pages (login, etc.)
│   │
│   ├── socket/
│   │   └── socket.js            ← Socket.IO client connection
│   │
│   ├── store/
│   │   └── useAuthStore.js      ← Zustand auth state (token, user, role)
│   │
│   ├── styles.js                ← Shared color/size tokens
│   └── App.jsx                  ← Route definitions
│
├── tests/                       ← Playwright e2e tests
│   ├── admin/
│   ├── creator/                 ← Creator UI tests (posts, live streams)
│   ├── smoke/
│   │   └── pi-live-stream.spec.js  ← Pi/Anthias smoke test
│   └── helpers/
│       └── test-helpers.js      ← Login, reset, seed helpers
│
├── playwright.config.js         ← Test configuration (auto-starts test backend)
├── .env                         ← VITE_API_URL
└── package.json
```

---

## Setup

```bash
cd frontend
npm install
npm install fabric@5.3.0 --save-exact
```

Create `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Development

```bash
npm run dev
```

The dev server starts on `http://localhost:5173` and proxies API calls to the backend.

---

## Testing

### Install Playwright browsers (one-time)

```bash
npx playwright install
```

### Run all tests

```bash
npx playwright test --reporter=line
```

### Run specific suites

```bash
# Admin dashboard tests
npx playwright test tests/admin/ --reporter=line

# Creator tests (posts, editor, live streams)
npx playwright test tests/creator/ --reporter=line

# Pi/Anthias live stream smoke test
npx playwright test tests/smoke/pi-live-stream.spec.js --reporter=line
```

> **Note:** The smoke test auto-starts a test backend on port 5001. Do not run your real backend on that port.

---

## Key Pages

| Page | Role | Description |
|------|------|-------------|
| `/login` | Public | Username/password login |
| `/admin/*` | Admin only | Users, groups, devices, system settings |
| `/creator` | Creator | Dashboard with post/live stream overview |
| `/creator/posts` | Creator | Create/edit posts with Fabric.js designer |
| `/creator/live-streams` | Creator | Create/manage HLS/RTSP/YouTube/RTMP streams |
| `/creator/signage` | Creator | View device status and deployments |

---

## API Client Modules

All API calls are wrapped in `src/api/*.js` modules. Example:

```js
// src/api/liveStreams.js
import api from "./axios";

export const getLiveStreams = () => api.get("/live-streams");
export const createLiveStream = (data) => api.post("/live-streams", data);
export const startStream = (id) => api.post(`/live-streams/${id}/start`);
export const stopStream = (id) => api.post(`/live-streams/${id}/stop`);
export const rotateStreamKey = (id) => api.post(`/live-streams/${id}/rotate-key`);
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Fabric is not defined` | Ensure `fabric@5.3.0` is installed exactly |
| Canvas rendering issues | Check browser DevTools console for Fabric.js errors |
| Vite hot reload not working | `npm run dev -- --force` |
| API 404 errors | Check `VITE_API_URL` points to running backend |
| Playwright tests fail | Ensure backend is NOT running on port 5001 (test server uses it) |

---

_See the root `README.md` for full system setup instructions._
