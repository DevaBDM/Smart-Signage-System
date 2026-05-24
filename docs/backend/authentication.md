# Backend Authentication & Authorization

This document describes the dual authentication system (JWT for users, device tokens for Pis) and role-based access control.

---

## Dual Authentication Model

The backend serves two fundamentally different security principals:

1. **Human users** (admins, creators, viewers) who log in with passwords
2. **Device agents** (Raspberry Pis) who authenticate with pre-generated tokens

These systems are completely separate to prevent token confusion and allow different validation rules.

```mermaid
flowchart LR
    subgraph "User Auth"
        U[User] -->|POST /auth/login| J[JWT]
        J -->|Authorization: Bearer| E[Express Routes]
    end
    subgraph "Device Auth"
        P[Pi] -->|heartbeat| T[Device Token]
        T -->|x-device-token| D[Device Routes]
    end
    E --> A[auth.js middleware]
    D --> B[authDevice.js middleware]
```

---

## User Authentication (JWT)

### Registration

`POST /api/auth/register`

- First user to register automatically becomes `role: admin`
- Subsequent registrations default to `role: creator`
- Password hashed with bcrypt (10 rounds)

### Login

`POST /api/auth/login`

```mermaid
sequenceDiagram
    participant C as Client
    participant R as auth.js Route
    participant S as authService
    participant DB as PostgreSQL

    C->>R: { username, password }
    R->>S: authenticate(username, password)
    S->>DB: SELECT user WHERE username = ?
    DB-->>S: User { password_hash }
    S->>S: bcrypt.compare(password, hash)
    S->>S: jwt.sign({ id, username, role, group_id }, JWT_SECRET)
    S-->>R: { token, user }
    R-->>C: 200 + token
```

### JWT Middleware (`middleware/auth.js`)

1. Extract `Authorization: Bearer <token>` header
2. Verify JWT signature with `JWT_SECRET`
3. Look up user in database to ensure still active
4. Populate `req.user` with `{ id, username, role, group_id }`
5. Reject with 401 if token invalid, expired, or user not found

---

## Device Authentication (Device Token)

### Token Lifecycle

```mermaid
sequenceDiagram
    participant A as Admin
    participant B as Backend
    participant Pi as Raspberry Pi

    A->>B: POST /devices/register { name, group }
    B-->>A: Device { id: 5 }

    Note over A,Pi: Pi configured with DEVICE_ID=5

    Pi->>B: Socket.IO connect (no token)
    Pi->>B: heartbeat { device_id: 5 }
    B->>B: Generate crypto.randomBytes(32).toString("hex")
    B->>B: Save device_token to DB
    B-->>Pi: emit device_token { token }

    Note over Pi,B: Pi persists token locally

    Pi->>B: Future connect (auth.token)
    B->>B: Verify token matches DB
    B-->>Pi: Connection accepted
```

### Token Security Properties

- **Length**: 64 hexadecimal characters (256 bits of entropy)
- **Generation**: `crypto.randomBytes(32).toString("hex")`
- **Storage**: Persisted in `Device.device_token` column (plain text; the token itself is the credential, not a hash)
- **Transmission**: Sent via Socket.IO `device_token` event over TLS (production) or local network
- **Scope**: Per-device; no two devices share the same token

### Device Auth Middleware (`middleware/authDevice.js`)

1. Extract `x-device-token` header
2. Query `prisma.device.findFirst({ where: { device_token } })`
3. Populate `req.device` with full device record
4. Reject with 401 if token not found or device not approved

### Socket.IO Token Validation

The Socket.IO server has its own handshake middleware:

```mermaid
sequenceDiagram
    participant Pi as Pi
    participant IO as Socket.IO
    participant DB as PostgreSQL

    Pi->>IO: connect (auth.token)
    IO->>DB: SELECT device WHERE device_token = ?
    alt Device found
        DB-->>IO: Device record
        IO-->>Pi: socket.verifiedDeviceId = device.id
    else Invalid token
        IO-->>Pi: Error: "Invalid device token"
    end
```

**Additional hardening:**
- If `socket.verifiedDeviceId` is set and heartbeat claims a different `device_id` → disconnect immediately
- If device already has a token but socket presents none/invalid → disconnect

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access. Can manage all users, groups, devices, posts, and streams. |
| `creator` | Can create and manage content within their assigned group. Can view and control assigned devices. Cannot manage users or approve devices. |
| `viewer` | Read-only access. Can browse feed and signage content. Frontend-enforced. |

### Permission Helpers (`utils/permissions.js`)

```js
// Group scoping
isAdmin(user)          // user.role === 'admin'
getScopedQuery(user)   // { group_id: user.group_id } for creators

// Content ownership
canEditPost(user, post) // admin OR (creator AND post.created_by === user.id)
```

### Middleware Enforcement

Route-level protection:

```js
// Admin only
router.get("/users", auth, requireRole("admin"), ...);

// Admin or creator (group-scoped)
router.get("/devices", auth, requireRole("admin", "creator"), ...);

// Device only
router.get("/signage/device/:id/deployments", authDevice, ...);
```

---

## Control Locks

When multiple admins or creators attempt to control the same device simultaneously, control locks prevent race conditions.

### Lock Fields (`Device` table)

| Field | Description |
|-------|-------------|
| `control_lock_user_id` | User who acquired the lock |
| `control_lock_priority` | Priority level (higher wins) |
| `control_lock_until` | Lock expiration timestamp |
| `control_lock_action` | Action being performed |

### Lock Logic (`utils/controlLock.js`)

1. Check if device has an active lock (`control_lock_until > now()`)
2. If requesting user's priority > existing lock priority → steal the lock
3. If requesting user's priority <= existing → reject with 423 Locked
4. On successful action, release the lock

```mermaid
sequenceDiagram
    participant U1 as User A (priority 5)
    participant U2 as User B (priority 3)
    participant CL as controlLock.js
    participant D as Device

    U1->>CL: Lock device for "start"
    CL->>D: control_lock_user_id=1, priority=5, until=+120min
    CL-->>U1: Lock acquired

    U2->>CL: Lock device for "next"
    CL->>D: Check existing lock (priority 5)
    CL-->>U2: 423 Locked (priority too low)

    U1->>CL: Perform action + release
    CL->>D: Clear control_lock_* fields
```

---

## Security Checklist

- [x] JWT secret minimum 32 characters, checked at startup
- [x] bcrypt password hashing (10 rounds)
- [x] Per-device unique tokens (256-bit entropy)
- [x] Device pre-registration required (no auto-accept)
- [x] Token mismatch detection and immediate disconnection
- [x] Path traversal protection on static file serving
- [x] Control locks prevent concurrent device manipulation
- [x] Rate limiting on AI endpoint (20 req/IP/min)
- [x] Role-based middleware on all mutating routes

---

_This document is part of the Smart Signage backend documentation. See `backend/README.md` for the high-level overview._
