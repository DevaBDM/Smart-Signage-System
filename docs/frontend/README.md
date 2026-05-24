# Frontend Documentation

This folder contains comprehensive documentation for the Smart Signage frontend.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [`architecture.md`](architecture.md) | Layered architecture, data flows, design decisions, module dependencies |
| [`routing.md`](routing.md) | Route map, role guards, navigation structure, client-side routing |
| [`state-management.md`](state-management.md) | Zustand auth store, localStorage sync, profile hydration |
| [`api-layer.md`](api-layer.md) | Axios instance, interceptors, per-domain API modules, error handling |
| [`components.md`](components.md) | Component inventory, designer subsystem, UI primitives, design tokens |
| [`authentication.md`](authentication.md) | Login flow, JWT handling, 401 redirects, logout |
| [`real-time.md`](real-time.md) | Socket.IO client, lazy connections, event handling |
| [`designer.md`](designer.md) | Fabric.js canvas, templates, safe zones, export pipeline |
| [`setup.md`](setup.md) | Installation, environment variables, build, production deployment |

---

## Quick Reference

### Tech Stack
- **Framework**: React 19 + Vite 8
- **Routing**: React Router DOM 7
- **State**: Zustand 5 + React Context
- **HTTP**: Axios 1.16
- **Real-time**: Socket.IO Client 4.8
- **Visual Editor**: Fabric.js 5.3.0
- **Media Player**: hls.js 1.6
- **Markdown**: react-markdown 10
- **Testing**: Playwright 1.48

### Architecture Layers
```
Pages → Components → State (Zustand/Context) → API (Axios/Socket.IO) → Config
```

### Key Files
- `frontend/src/main.jsx` — Entry point
- `frontend/src/App.jsx` — Root component with router
- `frontend/src/store/useAuthStore.js` — Auth state
- `frontend/src/context/AuthContext.jsx` — Auth context wrapper
- `frontend/src/api/axios.js` — HTTP client
- `frontend/src/socket/socket.js` — WebSocket client
- `frontend/src/tokens.js` — Design tokens

---

For the high-level frontend overview, see `frontend/README.md`.
