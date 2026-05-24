# Smart Signage — Backend

The backend is the **central command and data hub** of the Smart Signage System. Written in **Node.js** with **Express.js**, it exposes a REST API, manages a PostgreSQL database via Prisma, maintains persistent Socket.IO connections to Raspberry Pi display agents, processes media with Sharp and FFmpeg, relays live video streams, and integrates with OpenAI for content Q&A.

---

## What the Backend Is

The backend is a single Node.js process that serves three distinct consumers simultaneously:

1. **React Admin Dashboard** — Content creators and administrators use a web UI to write posts, assign content to devices, approve new devices, manage groups, start live streams, and trigger emergency broadcasts.
2. **Raspberry Pi Display Agents** — Field devices poll the REST API for their deployment playlists, push sensor data via Socket.IO, and receive real-time commands (play next, emergency start, refresh display) from the server.
3. **Public Feed Consumers** — Anonymous visitors browse a public content feed and ask AI-powered questions about published posts.

Every piece of signage content, every device heartbeat, every sensor reading, every emergency trigger, and every live stream passes through this backend.

---

## What the Backend Does

The backend performs six core functions:

### 1. Content Lifecycle Management

Posts are the atomic unit of content. A post can contain:
- A title, markdown description, and URL slug
- Multiple images and videos (uploaded, cropped, transcoded)
- PDF, DOCX, and PPTX attachments with full-text extraction for AI context
- A linked live stream
- Scheduling metadata (`start_date`, `end_date`, `duration_seconds`, `priority`)
- A `signage_state` (NORMAL, BREAKING_NEWS, SECURITY_RISK, EMERGENCY)

Posts move through a **draft → published** workflow. Only published posts with `allowed_on_signage = true` can be deployed to devices. The feed channel (`allowed_on_feed`) is separate from the signage channel.

### 2. Device Registry & Command Center

Devices must be **pre-registered** by an admin before they can connect. Upon first heartbeat, the device receives a **64-character hex token** via Socket.IO. This token binds the physical Pi to its database record.

The backend tracks:
- Online/offline status (30-second heartbeat timeout)
- IP address, location, and pending change requests
- Multi-group membership (`DeviceGroup` join table)
- Sensor logs (motion, brightness, rain)
- Per-device error logs

Admins can send **playback controls** (`next`, `previous`, `start`), **refresh** displays, or trigger **emergency mode** across entire groups.

### 3. Real-Time Socket.IO Bus

Socket.IO is not just a notification channel — it is the **primary control plane** for devices. The server maintains a `deviceSockets` Map (`device_id → socket.id`) to target individual devices.

Inbound events from Pi:
- `heartbeat` — registration, status, token handshake
- `sensor_update` — environmental data ingestion
- `emergency_trigger` — hardware button → group-wide emergency broadcast
- `signage_asset_synced` — confirmation that Anthias received an asset
- `error_log` — remote error collection

Outbound events to Pi:
- `device_token` — assign/re-assign auth token
- `signage_command` — publish, hide, show, delete, next, previous, start
- `emergency_mode_start` / `emergency_mode_end` — enter/exit emergency
- `refresh_display` / `restart_display` — display control

### 4. Signage Deployment Engine

When a post is published to a device, a `SignageDeployment` record is created. The Pi polls `GET /api/signage/device/:id/deployments` every 60 seconds. The backend returns a filtered, ordered list of active posts based on:
- Current date within `start_date`–`end_date` window
- Post status = `published`
- `is_enabled = true`
- Priority ordering

For Anthias devices, the Pi's `content_sync.py` then uploads assets to Anthias. For MPV devices, the agent downloads files directly to local cache.

### 5. Media Processing Pipeline

All uploads are processed before storage:

- **Images** (Sharp): auto-orient, optional percentage-based crop, compress to WebP (quality 88), save to `uploads/images/`
- **Videos** (FFmpeg/fluent-ffmpeg): probe metadata, optional temporal trim + spatial crop, transcode to H.264/AAC MP4 with faststart, save to `uploads/videos/`
- **Attachments** (PDF/DOCX/PPTX): text extraction via `mammoth`/`pdf-parse-fork` for AI context

Static files are served from `/uploads/*` and `/streams/*`.

### 6. Live Stream Relay

Four stream types are supported:

| Type | Ingest | Relay |
|------|--------|-------|
| HLS | External `.m3u8` URL | Direct proxy + segment caching |
| RTSP | Camera URL | FFmpeg → HLS segments |
| YouTube | YouTube HLS URL | Proxy + segment caching |
| RTMP | OBS/Encoder push to `rtmp://server:1935/live/<key>` | FFmpeg → HLS segments |

A `node-media-server` RTMP ingest server runs on port 1935. FFmpeg child processes relay incoming streams to HLS segments in `streams/{id}/`. A health monitor restarts crashed relays automatically. Stream keys can be rotated for security.

---

## Where the Backend Fits

```mermaid
flowchart TB
    subgraph Clients
        F[React Admin<br/>Dashboard]
        P1[Pi Device 1<br/>Anthias]
        P2[Pi Device 2<br/>Anthias]
        P3[Pi Device 3<br/>MPV]
        U[Public Users<br/>Feed + AI Q&A]
    end

    subgraph Backend
        E[Express HTTP<br/>REST API]
        S[Socket.IO<br/>Real-Time Bus]
        M[Media Processor<br/>Sharp + FFmpeg]
        R[Stream Relay<br/>RTMP/HLS]
        A[AI Service<br/>OpenAI API]
    end

    subgraph Data
        DB[(PostgreSQL<br/>Prisma ORM)]
        FS[File System<br/>uploads/ + streams/]
    end

    F -->|JWT Auth| E
    P1 -->|Device Token| E
    P1 <-->|Socket.IO| S
    P2 -->|Device Token| E
    P2 <-->|Socket.IO| S
    P3 -->|Device Token| E
    P3 <-->|Socket.IO| S
    U -->|Public| E
    E --> M
    M --> FS
    E --> R
    R --> FS
    E --> A
    E --> DB
    S --> DB
```

The backend sits at the center of the topology. It is the **single source of truth** for:
- All content (posts, images, videos, streams)
- All device state (online, offline, emergency, deployments)
- All user and group permissions
- All sensor and error logs

The Pi agents cache content locally, but the backend decides **what** they should cache. The frontend renders content, but the backend decides **which** content the user is allowed to see.

---

## Who Uses the Backend

| Consumer | Authentication | Primary Operations |
|----------|---------------|-------------------|
| **Admin** | JWT (`role: admin`) | Full CRUD on users, groups, devices, posts, streams. Approve devices. Trigger emergency. Manage all content. |
| **Creator** | JWT (`role: creator`) | Create/edit own group posts. Publish to assigned devices. Control signage playback. View scoped devices. |
| **Viewer** | JWT (`role: viewer`) | Read-only access to feed and signage content (frontend-enforced). |
| **Pi Agent** | Device token (Socket.IO + REST) | Heartbeat, pull deployments, push sensor data, receive commands, report errors. |
| **Public User** | None (rate-limited) | Browse public feed, ask AI questions about published posts. |

---

## How the Backend Is Built

### Design Philosophy

- **Layered architecture** — Routes → Middleware → Services → Repositories → Prisma → PostgreSQL. Each layer has a single responsibility.
- **Separation of concerns** — Business logic lives in `services/`. Data access is abstracted in `repositories/`. HTTP concerns stay in `routes/`.
- **Stateless REST, stateful sockets** — HTTP requests are stateless (JWT/device token in headers). Socket.IO connections are stateful (tracked in memory via `deviceSockets`).
- **Offline-first devices** — The backend tells devices what to play, but devices cache content and fallback assets locally. The backend never directly controls the display; it issues commands.
- **Approval workflow** — Devices must be pre-registered and approved. Changes to approved devices (name, IP, location) are staged as "pending" until an admin approves them.

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 18+ | Event-driven, non-blocking I/O for high-concurrency Socket.IO |
| Framework | Express.js 5 | Mature, minimal, middleware-based routing |
| ORM | Prisma 5 | Type-safe queries, automatic migrations, excellent PostgreSQL support |
| Database | PostgreSQL 14+ | ACID compliance, JSON support, robust for relational signage data |
| Real-time | Socket.IO 4 | Bidirectional event bus with room targeting and ack support |
| Auth | jsonwebtoken + bcryptjs | Industry-standard JWT with secure password hashing |
| Images | Sharp | Fast WebP conversion, cropping, auto-orientation |
| Video | fluent-ffmpeg + FFmpeg | Transcoding, metadata probing, stream relay |
| Streaming | node-media-server | RTMP ingest server with minimal config |
| AI | OpenAI API | GPT-based Q&A with contextual post content |
| Testing | Jest + Supertest | Unit tests, HTTP integration tests, WebSocket tests |

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client (React / Pi)
    participant R as Express Router
    participant M as Middleware
    participant S as Service
    participant Repo as Repository
    participant P as Prisma ORM
    participant DB as PostgreSQL

    C->>R: HTTP Request
    R->>M: auth / authDevice / asyncHandler
    M->>P: Verify JWT or device token
    P->>DB: SELECT user/device
    DB-->>P: Record
    P-->>M: Valid
    M-->>R: req.user / req.device
    R->>S: Call business logic
    S->>Repo: Query/Command
    Repo->>P: Prisma findMany / create / update
    P->>DB: SQL
    DB-->>P: Result
    P-->>Repo: Typed result
    Repo-->>S: Data
    S-->>R: Response payload
    R-->>C: JSON Response
```

### Socket.IO Device Lifecycle

```mermaid
sequenceDiagram
    participant Pi as Raspberry Pi
    participant IO as Socket.IO Server
    participant DB as PostgreSQL

    Pi->>IO: connect (no token)
    IO-->>Pi: connection accepted
    Pi->>IO: heartbeat { device_id: 1, ... }
    IO->>DB: SELECT device WHERE id=1
    DB-->>IO: Device registered, no token
    IO->>DB: UPDATE device_token = <new>
    IO-->>Pi: device_token { token }

    Note over Pi,IO: Next connection

    Pi->>IO: connect (auth.token)
    IO->>DB: SELECT device WHERE device_token = ?
    DB-->>IO: Device found
    IO-->>Pi: connection accepted (verified)

    loop Every 10 seconds
        Pi->>IO: heartbeat { device_id: 1, token, ... }
        IO->>DB: UPDATE last_seen, status = online
    end

    Pi->>IO: disconnect
    IO->>DB: UPDATE status = offline
```

### Emergency Mode Broadcast

```mermaid
sequenceDiagram
    participant Pi as Pi (Button Pressed)
    participant IO as Socket.IO Server
    participant DB as PostgreSQL
    participant Targets as Other Pis in Group

    Pi->>IO: emergency_trigger { device_id: 3 }
    IO->>DB: SELECT groups for device 3
    DB-->>IO: Group IDs [2, 5]
    IO->>DB: UPDATE groups SET signage_state = EMERGENCY
    IO->>DB: SELECT online devices in groups [2, 5]
    DB-->>IO: Device IDs [1, 2, 3, 4]

    IO->>Targets: emergency_mode_start { triggered_by: 3, groups: [2,5] }
    IO-->>Pi: emergency_mode_start
```

---

## Why These Design Choices

### Why PostgreSQL + Prisma

The data model is deeply relational: users belong to groups, groups contain devices and posts, posts have images and deployments, deployments link posts to devices. Prisma provides type-safe queries, schema migrations, and excellent developer experience. PostgreSQL ensures ACID compliance for critical operations like emergency state changes and device token generation.

### Why Socket.IO over raw WebSockets

Socket.IO provides automatic reconnection, room-based broadcasting, acknowledgements (ack), and fallback transports. The `emitToDeviceAck` helper uses timeouts to confirm a Pi received a command — essential for signage control where "fire and forget" is not acceptable.

### Why Layered Architecture

- **Routes** handle HTTP semantics (status codes, JSON serialization) and delegate to services
- **Services** encapsulate business rules (e.g., "a creator can only publish to devices in their group")
- **Repositories** isolate Prisma queries, making testing easier and allowing query optimization in one place
- **Middleware** enforces cross-cutting concerns (auth, error handling) without polluting business logic

### Why Dual Auth (JWT + Device Token)

Users and devices are fundamentally different security principals. Users log in with passwords and receive time-limited JWTs. Devices receive perpetual tokens generated server-side. Separating the auth middleware (`auth.js` for users, `authDevice.js` for Pis) prevents token confusion and allows different validation rules.

### Why Control Locks

When multiple admins might control the same device simultaneously, `control_lock` prevents race conditions. A lock records the user, priority, action, and expiration time. Lower-priority users cannot override higher-priority locks.

### Why State Hierarchy

Signage states have a strict priority: `EMERGENCY` > `SECURITY_RISK` > `BREAKING_NEWS` > `NORMAL`. This ensures that a campus-wide emergency broadcast cannot be accidentally overridden by a routine announcement.

---

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema (models, enums, indexes, relations)
├── src/
│   ├── index.js               # Bootstrap: HTTP server, Socket.IO, stream relay, RTMP
│   ├── app.js                 # Express config: routes, CORS, static files, error handler
│   ├── db/
│   │   └── prisma.js          # PrismaClient singleton (switches to TEST_DATABASE_URL in test)
│   ├── routes/                # 12 Express routers (HTTP entry points)
│   │   ├── auth.js            # Login, register, /me
│   │   ├── users.js           # User list (admin only)
│   │   ├── groups.js          # Group CRUD + signage_state management
│   │   ├── posts.js           # Post CRUD, publish, attachments
│   │   ├── devices.js         # Device CRUD, approve, emergency asset upload
│   │   ├── signage.js         # Publish, deployments, playback controls, asset hide/show/delete
│   │   ├── liveStreams.js     # Stream CRUD, start/stop, key rotation, logs
│   │   ├── media.js           # Image/video upload with crop support
│   │   ├── playlists.js       # Playlist CRUD
│   │   ├── sensors.js         # Sensor log query endpoint
│   │   ├── uploads.js         # Static file serving with path traversal protection
│   │   └── ai.js              # AI Q&A + status endpoint
│   ├── services/              # Business logic layer
│   │   ├── authService.js     # Password hashing, JWT generation/validation
│   │   ├── userService.js     # User CRUD with group scoping
│   │   ├── deviceService.js   # Registration, approval, reset, removal, token management
│   │   ├── postService.js     # Post create/update/delete with image reordering
│   │   ├── signageService.js  # Publish/unpublish, asset upsert, deployment sync
│   │   ├── deploymentService.js # Deployment querying with date/priority filters
│   │   ├── liveStreamService.js # Stream business logic, relay coordination
│   │   ├── aiService.js       # OpenAI prompt building, rate limiting
│   │   ├── piBridge.js        # Socket.IO emitter wrapper for HTTP route → Pi communication
│   │   └── streamRelay/       # Live stream relay subsystem
│   │       ├── index.js       # Start/stop relay orchestrator
│   │       ├── rtmpServer.js  # node-media-server RTMP ingest
│   │       └── healthMonitor.js # Periodic FFmpeg health checks + auto-restart
│   ├── repositories/            # Thin Prisma query wrappers
│   │   ├── userRepo.js
│   │   ├── deviceRepo.js
│   │   ├── postRepo.js
│   │   └── liveStreamRepo.js
│   ├── middleware/              # Cross-cutting concerns
│   │   ├── auth.js              # JWT verification → req.user
│   │   ├── authDevice.js        # Device token verification → req.device
│   │   ├── asyncHandler.js      # Wrap async routes to catch errors
│   │   ├── error.js             # Global error handler (500, Prisma errors)
│   │   ├── upload.js            # Multer config for image/video uploads
│   │   └── uploadAttachment.js  # Multer config for PDF/DOCX/PPTX uploads
│   ├── utils/                   # Helper modules
│   │   ├── mediaProcessor.js    # Sharp + FFmpeg processing pipeline
│   │   ├── permissions.js       # RBAC helpers, group scoping
│   │   ├── signageAssets.js     # SignageAsset upsert/sync helpers
│   │   ├── signageStates.js     # State comparison + urgency ordering
│   │   ├── controlLock.js       # Device control lock logic
│   │   ├── devicePermissions.js # Device access control
│   │   ├── signagePermissions.js # Asset management permissions
│   │   ├── refreshGroupDevices.js # Group state change → device refresh broadcast
│   │   ├── textExtractor.js     # PDF/DOCX/PPTX text extraction for AI context
│   │   └── parsers.js           # Boolean/string parsers for query params
│   ├── websocket/
│   │   └── socket.js            # Socket.IO server: handshake, heartbeat, sensor, emergency, emit helpers
│   └── validators/
│       └── (Joi/Zod schemas if any)
├── uploads/                     # Runtime: images/, videos/, temp/
├── streams/                     # Runtime: HLS segment output
├── tests/                       # Jest + Supertest suites
├── .env                         # Environment variables
├── package.json
└── README.md                    # This file
```

---

## Quick Start

```bash
cd backend
npm install

# Create .env
cat > .env <<EOF
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/signage_db
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
NODE_ENV=development
EOF

# Database
npx prisma migrate dev --name init
npx prisma generate

# Run
npm run dev   # nodemon with auto-reload
# or
npm start     # production
```

---

## Component Documentation

For deep-dive documentation on each subsystem, see the component guides in `docs/backend/`:

| Guide | Covers |
|-------|--------|
| `docs/backend/architecture.md` | Layered architecture, request/response flows, design decisions |
| `docs/backend/database.md` | Prisma schema, entity relationships, indexes, enums, data model rationale |
| `docs/backend/api.md` | Complete REST API reference with auth requirements and payloads |
| `docs/backend/websocket.md` | Socket.IO events, device lifecycle, real-time command flow |
| `docs/backend/authentication.md` | JWT auth, device token auth, RBAC, control locks |
| `docs/backend/media-processing.md` | Image/video upload pipeline, Sharp + FFmpeg configuration |
| `docs/backend/live-streaming.md` | Stream types, relay architecture, health monitoring, RTMP ingest |
| `docs/backend/setup.md` | Full installation, environment variables, production deployment |
| `docs/backend/security.md` | Security model, hardening, device token validation, path protection |

---

_Licensed under ISC._
