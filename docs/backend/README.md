# Backend Documentation

This folder contains comprehensive documentation for the Smart Signage backend.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [`architecture.md`](architecture.md) | Layered architecture, request flows, bootstrap sequence, module dependencies |
| [`database.md`](database.md) | Prisma schema, entity relationships, models, enums, indexes, data flows |
| [`api.md`](api.md) | Complete REST API reference with endpoints, auth, payloads, and error codes |
| [`websocket.md`](websocket.md) | Socket.IO events, device lifecycle, real-time command flow |
| [`authentication.md`](authentication.md) | JWT auth, device token auth, RBAC, control locks |
| [`media-processing.md`](media-processing.md) | Image/video upload pipeline, Sharp + FFmpeg configuration |
| [`live-streaming.md`](live-streaming.md) | Stream types, relay architecture, health monitoring, RTMP ingest |
| [`setup.md`](setup.md) | Installation, environment variables, production deployment, troubleshooting |
| [`security.md`](security.md) | Security model, hardening, device token validation, path protection |

---

## Quick Reference

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **ORM**: Prisma 5 + PostgreSQL 14+
- **Real-time**: Socket.IO 4
- **Media**: Sharp (images) + FFmpeg (videos)
- **Streaming**: node-media-server (RTMP ingest) + FFmpeg relay
- **AI**: OpenAI API
- **Testing**: Jest + Supertest

### Architecture Layers
```
Routes → Middleware → Services → Repositories → Prisma ORM → PostgreSQL
```

### Key Files
- `backend/src/index.js` — Bootstrap
- `backend/src/app.js` — Express configuration
- `backend/src/websocket/socket.js` — Socket.IO server
- `backend/prisma/schema.prisma` — Database schema

---

For the high-level backend overview, see `backend/README.md`.
