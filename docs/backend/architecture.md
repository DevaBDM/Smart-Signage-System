# Backend Architecture

This document describes the layered architecture, request/response flows, and design decisions of the Smart Signage backend.

---

## Layered Architecture

The backend follows a strict layered pattern. Each layer has exactly one responsibility and depends only on the layer beneath it.

```mermaid
flowchart TB
    subgraph HTTP_Entry["HTTP Entry Layer"]
        R[Routes<br/>Express routers]
    end
    subgraph Cross_Cutting["Cross-Cutting Layer"]
        M[Middleware<br/>auth, authDevice, asyncHandler, upload, error]
    end
    subgraph Business["Business Logic Layer"]
        S[Services<br/>auth, device, post, signage, stream, AI]
    end
    subgraph Data_Access["Data Access Layer"]
        REPO[Repositories<br/>user, device, post, liveStream]
    end
    subgraph ORM["ORM Layer"]
        P[Prisma Client<br/>Type-safe query builder]
    end
    subgraph Storage["Storage Layer"]
        DB[(PostgreSQL)]
        FS[File System<br/>uploads/ + streams/]
    end

    R --> M
    M --> S
    S --> REPO
    S --> FS
    REPO --> P
    P --> DB
```

### Layer Responsibilities

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Routes** | HTTP semantics, path mapping, parameter extraction | `POST /api/posts` → call `postService.create()` |
| **Middleware** | Authentication, authorization, error wrapping, file handling | `auth.js` sets `req.user`; `asyncHandler.js` catches promise rejections |
| **Services** | Business rules, workflow orchestration, validation | `deviceService.approveDevice()` applies pending changes and emits refresh |
| **Repositories** | Database queries, transaction boundaries | `deviceRepo.findByToken()` wraps `prisma.device.findFirst()` |
| **Prisma ORM** | Query construction, migration management, connection pooling | Generates type-safe client from `schema.prisma` |
| **PostgreSQL** | Persistent storage, ACID transactions, indexing | Stores all relational data |

---

## Request Flow

### Standard HTTP Request

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Express Route
    participant M as Middleware
    participant S as Service
    participant Repo as Repository
    participant P as Prisma
    participant DB as PostgreSQL

    C->>R: HTTP Request /api/devices
    R->>M: auth middleware
    M->>P: decode JWT, find user
    P->>DB: SELECT * FROM users WHERE id = ?
    DB-->>P: User record
    P-->>M: req.user populated
    M-->>R: continue
    R->>S: deviceService.listDevices(req.user)
    S->>Repo: deviceRepo.findMany({ group_id: ... })
    Repo->>P: prisma.device.findMany(...)
    P->>DB: SQL query
    DB-->>P: Result set
    P-->>Repo: Typed device[]
    Repo-->>S: Device list
    S-->>R: JSON payload
    R-->>C: 200 OK + devices
```

### Device-Authenticated Request

Device endpoints use `authDevice.js` instead of `auth.js`. The middleware verifies the `x-device-token` header against `Device.device_token`.

```mermaid
sequenceDiagram
    participant Pi as Raspberry Pi
    participant R as Express Route
    participant M as authDevice Middleware
    participant S as Service
    participant Repo as Repository
    participant P as Prisma

    Pi->>R: GET /api/signage/device/3/deployments<br/>x-device-token: abc...
    R->>M: authDevice
    M->>Repo: find device by token
    Repo->>P: prisma.device.findFirst({ device_token })
    P-->>Repo: Device { id: 3, ... }
    Repo-->>M: req.device populated
    M-->>R: continue
    R->>S: deploymentService.getVisibleForDevice(3)
    S-->>R: Active deployments
    R-->>Pi: JSON
```

---

## Bootstrap Sequence

When `src/index.js` starts, the following initialization occurs in order:

```mermaid
sequenceDiagram
    participant I as index.js
    participant A as app.js
    participant S as Socket.IO
    participant PB as piBridge
    participant SR as streamRelay
    participant HM as healthMonitor
    participant RTMP as rtmpServer

    I->>I: Validate JWT_SECRET and DATABASE_URL
    I->>A: Create HTTP server
    I->>S: Attach Socket.IO to HTTP server
    I->>PB: Set emitter (emitToDeviceAck)
    I->>SR: Prune orphan stream directories
    I->>SR: Bootstrap all published live streams
    I->>HM: Start periodic health checks
    I->>RTMP: Start RTMP ingest server (port 1935)
    I->>I: server.listen(PORT, "0.0.0.0")
```

This ensures that:
1. The database connection is valid before accepting traffic
2. All previously-running stream relays are restored after a restart
3. The RTMP server is ready before any device attempts to push

---

## Module Dependency Graph

```mermaid
flowchart TB
    subgraph Entry
        IDX[index.js]
        APP[app.js]
    end
    subgraph Routes
        AUTH_R[auth.js]
        DEV_R[devices.js]
        SIG_R[signage.js]
        POST_R[posts.js]
        LS_R[liveStreams.js]
        AI_R[ai.js]
    end
    subgraph Services
        AUTH_S[authService.js]
        DEV_S[deviceService.js]
        SIG_S[signageService.js]
        DEP_S[deploymentService.js]
        LS_S[liveStreamService.js]
        AI_S[aiService.js]
        PB[piBridge.js]
        SR[streamRelay/]
    end
    subgraph Repositories
        U_REPO[userRepo.js]
        D_REPO[deviceRepo.js]
        P_REPO[postRepo.js]
        L_REPO[liveStreamRepo.js]
    end
    subgraph Utils
        MP[mediaProcessor.js]
        PERM[permissions.js]
        SA[signageAssets.js]
        CL[controlLock.js]
    end
    subgraph Prisma
        DB[prisma.js]
    end

    IDX --> APP
    IDX --> SR
    IDX --> PB
    APP --> AUTH_R & DEV_R & SIG_R & POST_R & LS_R & AI_R

    AUTH_R --> AUTH_S
    DEV_R --> DEV_S
    SIG_R --> SIG_S & DEP_S
    POST_R --> DEV_S
    LS_R --> LS_S
    AI_R --> AI_S

    AUTH_S --> U_REPO
    DEV_S --> D_REPO & PB
    SIG_S --> SA & PB
    DEP_S --> D_REPO
    LS_S --> L_REPO & SR
    AI_S --> P_REPO

    U_REPO & D_REPO & P_REPO & L_REPO --> DB
    DEV_S --> PERM
    SIG_S --> CL
    POST_R --> MP
    LS_S --> MP
```

---

## Error Handling Strategy

1. **Synchronous errors** in Express routes are caught by Express's built-in error handler.
2. **Asynchronous errors** in route handlers are caught by `asyncHandler.js`, which forwards them to the global error middleware.
3. **Prisma errors** (P2002 unique constraint, P2025 record not found) are translated to appropriate HTTP status codes in `middleware/error.js`.
4. **Socket.IO errors** do not crash the server. Each event handler wraps its Prisma calls in `.catch(() => {})` to prevent unhandled promise rejections from disconnecting all sockets.

---

## Design Decisions

### Why Services and Repositories?

Splitting business logic (`services/`) from data access (`repositories/`) allows:
- **Unit testing** services by mocking repositories
- **Query optimization** in one place (repository files)
- **Business rule changes** without touching database queries

### Why a Single Process?

The backend runs as a single Node.js process. This simplifies deployment and state management (e.g., `deviceSockets` Map). If horizontal scaling is needed in the future, Socket.IO can be migrated to Redis Adapter, and `deviceSockets` replaced with a Redis-backed lookup.

### Why File System for Media?

Images and videos are stored on the local file system rather than object storage (S3) to reduce infrastructure complexity. For a university campus deployment with predictable storage needs, local SSD/NAS storage is sufficient. The `uploads/` and `streams/` directories are mounted volumes in production.

---

_This document is part of the Smart Signage backend documentation. See `backend/README.md` for the high-level overview._
