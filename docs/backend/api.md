# Backend API Reference

Complete REST API reference for the Smart Signage backend.

Base URL: `http://<host>:5000/api`

---

## Authentication

### User Auth (JWT)

All user endpoints require `Authorization: Bearer <jwt_token>`.

Token payload: `{ id, username, role, group_id, iat, exp }`

### Device Auth (Device Token)

Device endpoints require `x-device-token: <64-char-hex>` header.

---

## Auth Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user. First user becomes `admin`. |
| POST | `/auth/login` | Public | Authenticate, receive JWT. |
| GET | `/auth/me` | JWT | Get current user profile. |

**Login Request:**
```json
{
  "username": "alice",
  "password": "secret123"
}
```

**Login Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "alice",
    "role": "admin",
    "group_id": 1
  }
}
```

---

## Users Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | admin | List all users. |

---

## Groups Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/groups` | admin/creator | List groups. Creators see only their group's groups. |
| GET | `/groups/states` | Public | List `SignageState` enum values. |
| POST | `/groups` | admin | Create group. |
| PUT | `/groups/:id` | admin | Update group. Changing `signage_state` triggers device refresh. |
| DELETE | `/groups/:id` | admin | Delete group (cascades to devices, posts). |

**Create Group Request:**
```json
{
  "name": "Engineering Building",
  "description": "All screens in the engineering wing"
}
```

---

## Posts Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/posts?feed=true` | Public | List published posts with `allowed_on_feed=true`. |
| GET | `/posts` | JWT | List posts scoped to user's group. |
| GET | `/posts/:id` | JWT | Get single post. |
| POST | `/posts` | admin/creator | Create post. |
| PUT | `/posts/:id` | admin/creator | Update post (own content only unless `can_manage_other_posts`). |
| DELETE | `/posts/:id` | admin/creator | Delete post. |
| POST | `/posts/:id/publish` | admin/creator | Publish post (status → `published`). |
| POST | `/posts/:id/unpublish` | admin/creator | Unpublish post (status → `draft`). |
| POST | `/posts/:id/attachments` | admin/creator | Upload PDF/DOCX/PPTX attachment. |
| GET | `/posts/meta/group-creators` | admin/creator | List creators in a group. |

**Create Post Request:**
```json
{
  "title": "Campus Safety Update",
  "description_markdown": "## Important reminder...",
  "group_id": 1,
  "allowed_on_feed": true,
  "allowed_on_signage": true,
  "signage_state": "NORMAL"
}
```

---

## Devices Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/devices` | admin/creator | List devices. Admins see all; creators see devices in their group. |
| GET | `/devices/me` | Device token | Device reads its own record. |
| GET | `/devices/:id` | admin | Get single device details. |
| POST | `/devices/register` | admin | Pre-register a device (assign `id` before Pi connects). |
| POST | `/devices/:id/approve` | admin | Approve pending device and apply pending changes. |
| POST | `/devices/:id/reject` | admin | Reject pending device registration. |
| PUT | `/devices/:id` | admin | Update device settings. |
| PUT | `/devices/:id/reset` | admin | Reset device to defaults (clear signage data). |
| DELETE | `/devices/:id` | admin | Remove device and delete all associated signage data. |
| POST | `/devices/:id/emergency-asset` | admin | Upload emergency image/video (max 200 MB). |

**Register Device Request:**
```json
{
  "device_name": "Lobby Screen",
  "group_id": 1,
  "location": "Main Lobby"
}
```

**Approve Device:** Triggers `refresh_display` to the device.

---

## Signage Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/signage/device/:device_id/deployments` | Device token | Pi pulls its active deployment list. |
| POST | `/signage/publish` | admin/creator | Publish a post to one or more devices. |
| GET | `/signage/devices/:device_id/assets` | admin/creator | List Anthias assets synced to a device. |
| POST | `/signage/devices/:device_id/control` | admin/creator | Playback control: `next`, `previous`, `start`. |
| PATCH | `/signage/devices/:device_id/assets/:asset_id` | admin/creator | Toggle `is_enabled` (hide/show asset). |
| DELETE | `/signage/devices/:device_id/assets/:asset_id` | admin/creator | Permanently delete asset from device. |
| GET | `/signage/playlists` | admin | List all signage playlists. |

**Publish Request:**
```json
{
  "post_id": 42,
  "device_ids": [1, 2, 3],
  "duration_seconds": 15,
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-12-31T23:59:59Z",
  "priority": 1
}
```

**Control Request:**
```json
{
  "action": "next"
}
```

**Deployment Response (Pi):**
```json
[
  {
    "post_id": 42,
    "title": "Campus Safety Update",
    "images": [{ "image_path": "/uploads/images/abc.webp", "duration_seconds": 15 }],
    "duration_seconds": 15,
    "priority": 1
  }
]
```

---

## Live Streams Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/live-streams` | admin/creator | List streams. |
| GET | `/live-streams/:id` | admin/creator | Get stream details. |
| POST | `/live-streams` | admin/creator | Create stream. |
| PUT | `/live-streams/:id` | admin/creator | Update stream config. |
| DELETE | `/live-streams/:id` | admin/creator | Delete stream. |
| POST | `/live-streams/:id/start` | admin/creator | Start FFmpeg relay. |
| POST | `/live-streams/:id/stop` | admin/creator | Stop relay. |
| POST | `/live-streams/:id/rotate-key` | admin/creator | Generate new RTMP stream key. |
| GET | `/live-streams/:id/logs` | admin/creator | Get relay process logs. |
| POST | `/live-streams/:id/thumbnail` | admin/creator | Upload thumbnail image. |

**Create Stream Request:**
```json
{
  "title": "Commencement Ceremony",
  "stream_type": "RTMP",
  "group_id": 1
}
```

---

## Media Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/media/upload` | admin/creator | Upload image or video with optional crop/trim. |

**Upload Fields (multipart/form-data):**
- `file` — Image or video
- `crop` (optional) — JSON `{ x, y, width, height }` percentage-based crop
- `trim` (optional) — For video: `{ start, end }` in seconds

---

## AI Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ai/status` | Public | Check if OpenAI API is configured. |
| POST | `/ai/ask` | Public | Ask a question about a published post. Rate-limited: 20 req/IP/min. |

**Ask Request:**
```json
{
  "post_id": 42,
  "question": "What are the main safety tips?",
  "history": [
    { "role": "user", "content": "What is this post about?" },
    { "role": "assistant", "content": "Campus safety procedures..." }
  ]
}
```

---

## Sensors Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sensors?device_id=1&limit=100` | admin | Get sensor logs for a device. |

---

## Static / Health Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/uploads/*` | Public | Serve processed images/videos. Path-traversal protected. |
| GET | `/streams/*` | Public | Serve HLS playlists/segments. `.m3u8` has `no-store` cache. |
| GET | `/api/health` | Public | Server health check + upload directory path. |

---

## Error Responses

| Status | Meaning | Common Cause |
|--------|---------|-------------|
| 400 | Bad Request | Validation failure, missing required field |
| 401 | Unauthorized | Missing or invalid JWT / device token |
| 403 | Forbidden | Valid auth but insufficient role/permissions |
| 404 | Not Found | Record does not exist |
| 409 | Conflict | Unique constraint violation (Prisma P2002) |
| 429 | Too Many Requests | AI rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception, database failure |

---

_This document is part of the Smart Signage backend documentation. See `backend/README.md` for the high-level overview._
