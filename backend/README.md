# Smart Digital Signage — Backend

A production-grade **Node.js / Express** backend for a university-campus digital signage system. It powers content management, multi-device synchronization, real-time socket communication, live streaming (RTMP/HLS), AI-assisted content queries, and emergency override systems.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [Project Structure](#project-structure)
7. [Environment Variables](#environment-variables)
8. [Authentication & Authorization](#authentication--authorization)
9. [REST API Reference](#rest-api-reference)
10. [Socket.IO Events](#socketio-events)
11. [Media Processing Pipeline](#media-processing-pipeline)
12. [Live Streaming](#live-streaming)
13. [Emergency Mode](#emergency-mode)
14. [AI Integration](#ai-integration)
15. [Setup & Installation](#setup--installation)
16. [Testing](#testing)
17. [Troubleshooting](#troubleshooting)

---

## Overview

The backend is the central hub of the Smart Digital Signage system. It:

- Manages **users**, **groups**, **posts**, and **devices** with role-based access control (RBAC)
- Serves a **REST API** consumed by a React/Vite frontend and Raspberry Pi agents
- Maintains **persistent WebSocket connections** to field devices via Socket.IO
- Processes and stores **images** (Sharp) and **videos** (FFmpeg)
- Proxies **live streams** (HLS, RTMP, RTSP, YouTube) with automatic health monitoring
- Provides an **AI Q&A endpoint** powered by OpenAI for content inquiries

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 5 |
| ORM | Prisma 5 (PostgreSQL) |
| Real-time | Socket.IO 4 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Media | Sharp (images), FFmpeg (videos), fluent-ffmpeg |
| Streaming | node-media-server (RTMP ingest), FFmpeg relay (HLS) |
| AI | OpenAI API |
| Testing | Jest + Supertest |
| Linting | ESLint + Prettier |

---

## Features

### Content Management
- **Posts** with rich markdown descriptions, multiple images/videos, and attachments
- **Groups** to organize users, devices, and content
- **Playlists** for ordered content sequencing
- **Draft / Published** workflow with admin approval gates
- **Feed channel** (public consumption) vs **Signage channel** (device-only)

### Device Management
- Device registration, approval, and token-based authentication
- Per-device emergency asset upload (image/video, max 200 MB)
- Device grouping with multi-group membership
- Online/offline status tracking via 30-second heartbeat timeout
- Sensor data ingestion (motion, brightness, rain)

### Signage Operations
- Publish posts to specific devices with scheduling (`start_date`, `end_date`, `duration_seconds`)
- Priority-based deployment ordering
- Playback controls (`next`, `previous`, `start`) via Socket.IO
- Asset hide/show without deletion
- Signage state hierarchy: `EMERGENCY` > `SECURITY_RISK` > `BREAKING_NEWS` > `NORMAL`

### Live Streaming
- **HLS** (pull from external URL)
- **RTMP** (push to local ingest server)
- **RTSP** (camera relay)
- **YouTube** (HLS proxy)
- Stream key rotation for RTMP
- Health monitoring with auto-restart

### AI Integration
- `POST /api/ai/ask` — Q&A about published posts using OpenAI
- Contextual answers from post title, description, and attachment text
- Per-IP rate limiting (20 requests / 60s)

### Security
- JWT-based user auth with role enforcement (`admin`, `creator`, `viewer`)
- Per-device token auth for Pi agents
- Socket.IO handshake token validation
- Device ID mismatch detection and disconnection
- Path traversal protection on media resolution
- Control locks to prevent conflicting admin actions on the same device

---

## Architecture

### High-Level System Diagram

```mermaid
flowchart TB
    subgraph Clients
        A[React Frontend]
        B[Pi Device 1 / Anthias]
        C[Pi Device 2 / Anthias]
        D[Pi Device 3 / MPV]
    end

    subgraph Backend
        E[Express HTTP Server]
        F[Socket.IO Server]
        G[Prisma ORM]
        H[Media Processor]
        I[Stream Relay]
        J[AI Service]
    end

    subgraph Storage
        K[(PostgreSQL)]
        L[File System<br/>uploads/ + streams/]
    end

    A -->|REST API| E
    B -->|REST + Socket.IO| E
    C -->|REST + Socket.IO| E
    D -->|REST + Socket.IO| E
    E --> F
    E --> G
    G --> K
    E --> H
    H --> L
    E --> I
    I --> L
    E --> J
    J -->|OpenAI API| M[(OpenAI)]
```

### Request Flow Diagram

```mermaid
sequenceDiagram
    participant Pi as Raspberry Pi
    participant IO as Socket.IO Server
    participant Express as Express Router
    participant MW as Middleware
    participant Svc as Service
    participant Prisma as Prisma ORM
    participant DB as PostgreSQL

    Pi->>IO: heartbeat + device token
    IO->>Prisma: find device by token
    Prisma->>DB: SELECT device
    DB-->>Prisma: device record
    Prisma-->>IO: device
    IO-->>Pi: emit device_token (if new)

    Pi->>Express: GET /api/signage/device/:id/deployments
    Express->>MW: authDevice middleware
    MW->>Prisma: verify token
    Prisma-->>MW: device
    MW-->>Express: req.device
    Express->>Svc: fetch deployments
    Svc->>Prisma: findMany with filters
    Prisma->>DB: query
    DB-->>Prisma: results
    Prisma-->>Svc: deployments
    Svc-->>Express: visible posts
    Express-->>Pi: JSON response
```

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Routes (Express routers)                    │  ← HTTP entry points, parameter validation
├─────────────────────────────────────────────┤
│  Middleware (auth, authDevice, asyncHandler)   │  ← JWT/device verification, error wrapping
├─────────────────────────────────────────────┤
│  Services (business logic)                     │  ← DeviceService, AuthService, PostService, ...
├─────────────────────────────────────────────┤
│  Repositories (data access)                  │  ← Thin Prisma wrappers for queries
├─────────────────────────────────────────────┤
│  Utilities (helpers)                         │  ← MediaProcessor, Permissions, SignageAssets
├─────────────────────────────────────────────┤
│  Prisma ORM → PostgreSQL                     │  ← Schema-migrated relational DB
└─────────────────────────────────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram (Prisma)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Group     │1────N │    User      │N────1 │   UserGroup  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ name (UQ)    │       │ username(UQ) │       │ user_id (FK) │
│ signage_state│       │ password_hash│       │ group_id(FK) │
│ description  │       │ role         │       └──────────────┘
└──────────────┘       │ group_id(FK) │
       │ 1             └──────────────┘
       │
       │ N
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Device     │N────1 │ DeviceGroup  │1────N │    Group     │
├──────────────┤       ├──────────────┤       └──────────────┘
│ id (PK)      │       │ id (PK)      │
│ device_name  │       │ device_id(FK)│
│ group_id(FK) │       │ group_id(FK) │
│ ip_address   │       └──────────────┘
│ status       │
│ is_approved  │
│ device_token │       ┌──────────────┐       ┌──────────────┐
│ emergency_.. │       │  SensorLog   │       │   ErrorLog   │
│ control_lock │       ├──────────────┤       ├──────────────┤
└──────────────┘       │ id (PK)      │       │ id (PK)      │
       │               │ device_id(FK)│       │ device_id(FK)│
       │ N             │ motion       │       │ error_type   │
       │               │ brightness   │       │ message      │
       │               │ rain         │       └──────────────┘
       │               └──────────────┘
       │
       │ 1
┌──────────────┐
│SignageDeploym│
├──────────────┤
│ id (PK)      │
│ device_id(FK)│
│ post_id (FK) │
│ duration_sec │
│ start_date   │
│ end_date     │
│ priority     │
│ status       │
└──────────────┘
       │
       │ N
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     Post     │1────1│SignageMetada │       │  PostImage   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ title        │       │ post_id (FK) │       │ post_id (FK) │
│ slug (UQ)    │       │ duration_sec │       │ image_path   │
│ group_id(FK) │       │ start_date   │       │ media_type   │
│ created_by(FK)│      │ end_date     │       │ order_index  │
│ status       │       │ priority     │       └──────────────┘
│ signage_state│       └──────────────┘
│ allowed_on.. │
│ live_stream  │       ┌──────────────┐       ┌──────────────┐
└──────────────┘       │SignageAsset  │       │  Playlist    │
       │               ├──────────────┤       ├──────────────┤
       │               │ id (PK)      │       │ id (PK)      │
       │               │ device_id(FK)│       │ group_id(FK) │
       │               │ post_id (FK) │       │ name         │
       │               │ asset_id     │       └──────────────┘
       │               │ image_url    │
       │               │ mimetype     │       ┌──────────────┐
       │               │ is_enabled   │       │PlaylistItem  │
       │               └──────────────┘       ├──────────────┤
       │                                       │ id (PK)      │
       │                                       │ playlist(FK) │
       │ N                                     │ post_id (FK) │
       │                                       └──────────────┘
       │
┌──────────────┐       ┌──────────────┐
│  LiveStream  │       │PostAttachment│
├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │
│ title        │       │ post_id (FK) │
│ stream_type  │       │ file_path    │
│ source_url   │       │ file_name    │
│ relay_url    │       │ mime_type    │
│ stream_key   │       │ file_size    │
│ status       │       │ extracted_text
│ group_id(FK) │       └──────────────┘
│ created_by   │
└──────────────┘
```

### Key Enums

| Enum | Values |
|------|--------|
| `Role` | `admin`, `creator`, `viewer` |
| `PostStatus` | `draft`, `published` |
| `SignageState` | `EMERGENCY`, `SECURITY_RISK`, `BREAKING_NEWS`, `NORMAL` |
| `LiveStreamType` | `HLS`, `RTSP`, `YOUTUBE`, `RTMP` |
| `LiveStreamStatus` | `idle`, `starting`, `online`, `offline`, `error` |
| `MediaType` | `IMAGE`, `VIDEO`, `LIVE_STREAM` |

---

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema definition
├── src/
│   ├── index.js               # Entry point: HTTP + Socket.IO server bootstrap
│   ├── app.js                 # Express app config, routes, static files
│   ├── db/
│   │   └── prisma.js          # PrismaClient singleton (test DB aware)
│   ├── routes/
│   │   ├── auth.js            # Login, register, /me
│   │   ├── users.js           # User CRUD
│   │   ├── groups.js          # Group CRUD + signage_state management
│   │   ├── posts.js           # Post CRUD, publish, attachments
│   │   ├── devices.js         # Device CRUD, approve, emergency asset upload
│   │   ├── signage.js         # Publish to devices, deployments, playback controls
│   │   ├── liveStreams.js     # Stream CRUD, start/stop, key rotation
│   │   ├── media.js           # Media upload endpoint
│   │   ├── playlists.js       # Playlist CRUD
│   │   ├── sensors.js         # Sensor log query endpoint
│   │   ├── uploads.js         # Static file serving with path protection
│   │   └── ai.js              # AI Q&A + status
│   ├── services/
│   │   ├── authService.js     # Password hashing, token generation
│   │   ├── deviceService.js   # Device registration, approval, reset, removal
│   │   ├── postService.js     # Post create/update/delete logic
│   │   ├── signageService.js  # Publish/unpublish/delete signage assets
│   │   ├── liveStreamService.js # Stream business logic
│   │   ├── aiService.js       # OpenAI integration
│   │   ├── piBridge.js        # Socket.IO emitter wrapper for HTTP routes
│   │   └── streamRelay/       # Live stream relay subsystem
│   │       ├── index.js       # Start/stop relay orchestrator
│       ├── rtmpServer.js      # RTMP ingest server (node-media-server)
│       └── healthMonitor.js   # Periodic health checks
│   ├── repositories/
│   │   ├── userRepo.js        # User DB queries
│   │   ├── deviceRepo.js      # Device DB queries
│   │   ├── postRepo.js        # Post DB queries
│   │   └── liveStreamRepo.js  # LiveStream DB queries
│   ├── middleware/
│   │   ├── auth.js            # JWT user auth middleware
│   │   ├── authDevice.js      # Device token auth middleware
│   │   ├── asyncHandler.js    # Wraps async route handlers
│   │   ├── error.js           # Global error handler
│   │   ├── upload.js          # Multer media upload config
│   │   └── uploadAttachment.js # Multer attachment upload config
│   ├── utils/
│   │   ├── mediaProcessor.js  # Sharp image + FFmpeg video processing
│   │   ├── permissions.js     # RBAC helpers, group scoping
│   │   ├── signageAssets.js   # SignageAsset upsert/sync helpers
│   │   ├── signageStates.js   # State comparison + urgency ordering
│   │   ├── controlLock.js     # Device control lock logic
│   │   ├── devicePermissions.js # Device access control
│   │   ├── signagePermissions.js # Asset management permissions
│   │   ├── refreshGroupDevices.js # Group state change → device refresh
│   │   ├── textExtractor.js   # PDF/DOCX/PPTX text extraction
│   │   └── parsers.js         # Boolean/string parsers
│   ├── websocket/
│   │   └── socket.js          # Socket.IO server: Pi connections, events, offline detection
│   └── validators/
│       └── (Joi/Zod schemas if any)
├── uploads/                   # Runtime: images/, videos/, temp/
├── streams/                   # Runtime: HLS segment output
├── .env                       # Environment variables (not committed)
├── package.json
└── README.md                  # This file
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Required
PORT=5000
DATABASE_URL=postgresql://signage_admin:your_password@localhost:5432/signage_db
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Optional
NODE_ENV=development
TEST_DATABASE_URL=postgresql://signage_admin:your_password@localhost:5432/signage_test_db
STREAMS_DIR=./streams
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | HTTP server port (default: 5000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `TEST_DATABASE_URL` | No | Separate DB for Jest tests |
| `STREAMS_DIR` | No | HLS output directory (default: `backend/streams`) |
| `OPENAI_API_KEY` | No | Required for `/api/ai/ask` endpoint |

---

## Authentication & Authorization

### User Authentication (JWT)

1. `POST /api/auth/login` → returns `{ token, ... }`
2. Include `Authorization: Bearer <token>` in all subsequent requests
3. Token payload: `{ id, username, role, group_id, iat, exp }`

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **admin** | Full system access |
| **creator** | Create posts, manage own group content, view assigned devices, control signage |
| **viewer** | Read-only (if implemented by frontend) |

### Device Authentication

- Each approved device receives a **per-device token** (64-char hex) via Socket.IO after first heartbeat
- Pi must store the token locally and present it on every Socket.IO connection and REST request
- The `authDevice` middleware validates the token against the `device_token` column

### Socket.IO Security

- Handshake verifies `auth.token` against `Device.device_token`
- Unknown device IDs are rejected
- Device ID mismatch (socket claims different ID than token) triggers disconnection

---

## REST API Reference

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Bootstrap / Admin | Register user (first user becomes admin) |
| POST | `/api/auth/login` | Public | Authenticate, receive JWT |
| GET | `/api/auth/me` | JWT | Get current user profile |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | admin | List all users |

### Groups

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/groups` | admin/creator | List groups (scoped for creators) |
| GET | `/api/groups/states` | Public | List signage states enum |
| POST | `/api/groups` | admin | Create group |
| PUT | `/api/groups/:id` | admin | Update group (triggers device refresh on state change) |
| DELETE | `/api/groups/:id` | admin | Delete group |

### Posts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/posts` | Public (feed) / Auth | List posts (feed=public, otherwise scoped) |
| GET | `/api/posts/:id` | Auth | Get single post |
| POST | `/api/posts` | admin/creator | Create post |
| PUT | `/api/posts/:id` | admin/creator | Update post |
| DELETE | `/api/posts/:id` | admin/creator | Delete post |
| POST | `/api/posts/:id/publish` | admin/creator | Publish post |
| POST | `/api/posts/:id/unpublish` | admin/creator | Unpublish post |
| POST | `/api/posts/:id/attachments` | admin/creator | Upload file attachments (PDF, DOCX, PPTX) |
| GET | `/api/posts/meta/group-creators` | admin/creator | List creators in a group |

### Devices

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/devices` | admin/creator | List devices (group-scoped for creators) |
| GET | `/api/devices/me` | Device token | Device reads its own settings |
| GET | `/api/devices/:id` | admin | Get single device |
| POST | `/api/devices/register` | admin | Pre-register a device |
| POST | `/api/devices/:id/approve` | admin | Approve pending device / apply pending changes |
| POST | `/api/devices/:id/reject` | admin | Reject pending device |
| PUT | `/api/devices/:id` | admin | Update device settings |
| PUT | `/api/devices/:id/reset` | admin | Reset device to defaults |
| DELETE | `/api/devices/:id` | admin | Remove device and clear all signage data |
| POST | `/api/devices/:id/emergency-asset` | admin | Upload emergency image/video (max 200 MB) |

### Signage

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/signage/device/:device_id/deployments` | Device token | Pi pulls its deployment list |
| POST | `/api/signage/publish` | admin/creator | Publish post to device(s) |
| GET | `/api/signage/devices/:device_id/assets` | admin/creator | List Anthias assets on a device |
| POST | `/api/signage/devices/:device_id/control` | admin/creator | Playback control: `next` / `previous` / `start` |
| PATCH | `/api/signage/devices/:device_id/assets/:asset_id` | admin/creator | Hide/show asset |
| DELETE | `/api/signage/devices/:device_id/assets/:asset_id` | admin/creator | Permanently delete asset from device |
| GET | `/api/signage/playlists` | admin | List signage playlists |

### Live Streams

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/live-streams` | admin/creator | List streams |
| GET | `/api/live-streams/:id` | admin/creator | Get stream details |
| POST | `/api/live-streams` | admin/creator | Create stream |
| PUT | `/api/live-streams/:id` | admin/creator | Update stream |
| DELETE | `/api/live-streams/:id` | admin/creator | Delete stream |
| POST | `/api/live-streams/:id/start` | admin/creator | Start relay |
| POST | `/api/live-streams/:id/stop` | admin/creator | Stop relay |
| POST | `/api/live-streams/:id/rotate-key` | admin/creator | Rotate RTMP stream key |
| GET | `/api/live-streams/:id/logs` | admin/creator | Get relay logs |
| POST | `/api/live-streams/:id/thumbnail` | admin/creator | Upload thumbnail |

### Media

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/media/upload` | admin/creator | Upload image/video with optional crop |

### AI

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/ai/status` | Public | Check AI service health |
| POST | `/api/ai/ask` | Public (rate-limited) | Ask a question about a published post |

### Sensors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/sensors` | admin | Get sensor logs (query by device, limit) |

### Static / Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/uploads/*` | Public | Serve processed images/videos |
| GET | `/streams/*` | Public | Serve HLS playlists/segments |
| GET | `/api/health` | Public | Server health check |

---

## Socket.IO Events

### Pi → Server (Inbound)

| Event | Payload | Description |
|-------|---------|-------------|
| `heartbeat` | `{ device_id, device_name, ip_address, location, status }` | Register/refresh device online status |
| `sensor_update` | `{ device_id, motion, brightness, rain }` | Forward Arduino sensor readings |
| `error_log` | `{ device_id, error_type, message }` | Report Pi-side errors |
| `playlist_ack` | `{ device_id }` | Confirm playlist receipt |
| `signage_asset_synced` | `{ device_id, post_id, image_url, asset }` | Confirm asset synced to Anthias |
| `emergency_trigger` | `{ device_id }` | Hardware emergency button pressed |

### Server → Pi (Outbound)

| Event | Payload | Description |
|-------|---------|-------------|
| `device_token` | `{ device_id, token }` | Assign or re-emit device auth token |
| `auth_error` | `{ error }` | Reject connection/heartbeat |
| `signage_command` | `{ action, ... }` | `publish_asset`, `list`, `next`, `previous`, `start`, `hide_asset`, `show_asset`, `delete_asset` |
| `emergency_mode_start` | `{ triggered_by, groups }` | Enter emergency playback |
| `emergency_mode_end` | `{}` | Exit emergency playback |
| `refresh_display` | `{}` | Refresh Anthias/MPV display |
| `restart_display` | `{}` | Restart Anthias/MPV player |

### Server Internals

- **Offline detection**: Every 15 seconds, devices with `last_seen < now - 30s` are marked `offline`
- **Socket tracking**: `deviceSockets` Map maintains `device_id → socket.id` for targeted emits

---

## Media Processing Pipeline

### Image Processing (Sharp)

```
Upload (temp) → Sharp extract/crop → Auto-rotate → WebP (quality 88)
                                   → Save to /uploads/images/
                                   → Return public URL: /uploads/images/<name>.webp
```

### Video Processing (FFmpeg)

```
Upload (temp) → FFprobe duration/metadata → FFmpeg transcode (H.264 AAC)
              → Apply spatial crop if specified
              → Save to /uploads/videos/
              → Return public URL: /uploads/videos/<name>.mp4
```

### Supported Operations

| Feature | Image | Video |
|---------|-------|-------|
| Upload | JPG, PNG, WebP | MP4, MOV, etc. |
| Crop / Extract | Percentage-based crop | Temporal trim + spatial crop |
| Output format | WebP | MP4 (H.264, faststart) |
| Max upload | Configured via multer | Configured via multer |

---

## Live Streaming

### Stream Types

| Type | Source | Ingest | Relay |
|------|--------|--------|-------|
| **HLS** | External `.m3u8` URL | N/A | Direct proxy + segment caching |
| **RTSP** | Camera URL | N/A | FFmpeg → HLS segments |
| **YouTube** | YouTube HLS URL | N/A | Proxy + segment caching |
| **RTMP** | OBS / Encoder | `rtmp://server/live/<key>` | FFmpeg → HLS segments |

### Architecture

```mermaid
flowchart LR
    A[OBS/Encoder] -->|RTMP push| B[node-media-server<br/>rtmp://:1935]
    B --> C[FFmpeg relay]
    C --> D[HLS segments<br/>streams/{id}/]
    D --> E[Express static<br/>/streams/{id}/index.m3u8]
    E --> F[Pi / Anthias / MPV]
```

### Lifecycle

1. **Create** stream record in DB (`idle`)
2. **Start** → FFmpeg process spawned, status → `starting` → `online`
3. **Health monitor** checks every interval; restarts on crash
4. **Stop** → Kills FFmpeg, status → `offline`
5. **Rotate key** (RTMP only) → Generates new `stream_key`, invalidates old one

---

## Emergency Mode

### Trigger Sources

| Source | Mechanism |
|--------|-----------|
| Hardware button | Pi sends `emergency_trigger` → server sets group(s) to `EMERGENCY` |
| Admin dashboard | Admin updates group `signage_state` to `EMERGENCY` |

### Server-Side Flow

1. Receive `emergency_trigger` from device
2. Query all groups the device belongs to (`group_id` + `DeviceGroup` memberships)
3. Update each group: `signage_state = "EMERGENCY"`
4. Find all online approved devices in those groups
5. Emit `emergency_mode_start` to each device's Socket.IO socket

### Clearing Emergency

- Admin sets group `signage_state` back to `NORMAL`
- `refreshGroupDevices()` triggers `refresh_display` to affected devices
- Devices check **all** their groups via `/devices/me` before exiting emergency mode
- A device stays in emergency if **any** of its groups is still `EMERGENCY`

---

## AI Integration

### Endpoint

`POST /api/ai/ask`

### Request Body

```json
{
  "post_id": 42,
  "question": "What are the key points?",
  "history": [
    { "role": "user", "content": "What is this about?" },
    { "role": "assistant", "content": "This post covers..." }
  ]
}
```

### How it works

1. Validate post is `published` and `allowed_on_feed`
2. Fetch post title, description, and attachment extracted text
3. Build OpenAI prompt with context + question + conversation history
4. Return the generated answer

### Rate Limiting

- 20 requests per IP per 60-second window
- Returns `429 Too Many Requests` when exceeded

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- FFmpeg (for video processing and stream relay)

### Install Dependencies

```bash
cd backend
npm install
```

### Database Setup

```bash
# Create database
npx prisma migrate dev --name init
npx prisma generate
```

### Run Development Server

```bash
npm run dev
# or
npm start
```

The server will be available at `http://localhost:5000`.

### Production Deployment Notes

- Set `NODE_ENV=production`
- Use a process manager (PM2, systemd)
- Place an Nginx reverse proxy in front for SSL termination
- Ensure `uploads/` and `streams/` directories have sufficient disk space
- FFmpeg must be available in `$PATH` (or `@ffmpeg-installer/ffmpeg` will use its bundled binary)

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Test utilities include:
- **Jest** for test runner
- **Supertest** for HTTP endpoint testing
- **socket.io-client** for WebSocket testing
- `TEST_DATABASE_URL` isolation for clean test data

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `FATAL: JWT_SECRET is not set` | Add `JWT_SECRET` to `.env` |
| `FATAL: DATABASE_URL is not set` | Add `DATABASE_URL` to `.env` |
| Prisma connection errors | Verify PostgreSQL is running and credentials are correct |
| FFmpeg not found | Install FFmpeg system-wide or ensure `@ffmpeg-installer` resolves correctly |
| Socket.IO connections rejected | Check device token matches `device_token` in DB; verify Pi `SERVER_URL` |
| Live stream segments 404 | Verify `STREAMS_DIR` exists and FFmpeg relay is running |
| RTMP ingest fails | Check port 1935 is not blocked; verify stream key matches |
| AI endpoint 429 | Reduce request rate; check `RATE_LIMIT` / `RATE_WINDOW_MS` in `ai.js` |
| Media upload fails | Check disk space in `uploads/temp/` and `uploads/images/`, `uploads/videos/` |

---

_Licensed under ISC. Built for university campus digital signage environments._
