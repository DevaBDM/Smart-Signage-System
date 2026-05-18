# API Surface Snapshot

> Source of truth for the refactor. Every route, method, auth role, request body,
> and response shape as of the Phase 0 baseline.

---

## Legend

- **Auth:** `Bearer <JWT>` required unless marked "public".
- **Roles:** `admin`, `creator`, `viewer` (viewer has no dedicated routes today).
- **Socket.IO events** are documented separately in `websocket.md` (not yet written).

---

## Auth (`/api/auth`)

### `POST /api/auth/register`
- **Auth:** First user = no auth; after that `admin` only.
- **Body:** `{ username, password, role, group_id?, auto_approve?, can_manage_other_posts?, creator_priority?, control_lock_minutes?, max_signage_state?, managed_group_ids? }`
- **Response:** `{ id, username, role, auto_approve, can_manage_other_posts, creator_priority, control_lock_minutes, max_signage_state, managed_group_ids }`
- **Notes:** Auto-assigns `creator_priority` for new creators as `max + 1`.

### `POST /api/auth/login`
- **Auth:** public
- **Body:** `{ username, password }`
- **Response:** `{ token, role, group_id, can_manage_other_posts, creator_priority, control_lock_minutes, max_signage_state, managed_group_ids }`
- **Notes:** Token expires in 8h.

### `GET /api/auth/me`
- **Auth:** any valid token
- **Response:** Same shape as login, but pulls fresh DB values.
- **Notes:** Used by `AuthContext` on mount to refresh stale JWT fields.

---

## Users (`/api/users`)

### `GET /api/users`
- **Auth:** `admin`
- **Response:** `User[]` (includes `managed_groups`)

### `PUT /api/users/:id`
- **Auth:** `admin`
- **Body:** `{ role?, group_id?, auto_approve?, can_manage_other_posts?, creator_priority?, control_lock_minutes?, max_signage_state?, managed_group_ids? }`
- **Response:** Updated user (same shape as list item)
- **Notes:** Implements three-step priority swap when `creator_priority` collides.

### `DELETE /api/users/:id`
- **Auth:** `admin`
- **Notes:** Self-deletion is blocked.

---

## Groups (`/api/groups`)

### `GET /api/groups/states`
- **Auth:** public (anyone with a token; no role check)
- **Response:** `{ states: [{ value, label }] }`

### `GET /api/groups`
- **Auth:** `admin` sees all; `creator` sees own + managed groups.
- **Response:** `Group[]` (includes `_count` for users, devices, posts, playlists)

### `POST /api/groups`
- **Auth:** `admin`
- **Body:** `{ name, description?, signage_state? }`
- **Response:** Created `Group`

### `PUT /api/groups/:id`
- **Auth:** `admin`
- **Body:** `{ name?, description?, signage_state? }`
- **Response:** Updated `Group`
- **Notes:** If `signage_state` changes, calls `refreshGroupDevices(req.app, groupId)` to push to Pis.

### `DELETE /api/groups/:id`
- **Auth:** `admin`
- **Response:** `{ ok: true }` or 400 if group still has children.

---

## Posts (`/api/posts`)

### `GET /api/posts`
- **Auth:** public if `?feed=true`; otherwise `admin|creator`.
- **Query:** `feed?, group_id?, status?, channel?('feed'|'signage'), device_id?, creator_id?`
- **Response:** `Post[]` (includes `author`, `images`, `signage_metadata`, `signage_deployments`, `group`)
- **Notes:** Non-admins are scoped to `group_id IN [own_group, ...managed_groups]`.

### `GET /api/posts/meta/group-creators`
- **Auth:** `admin|creator`
- **Query:** `group_id?`
- **Response:** `{ id, username }[]` of creators in the requested/allowed group.

### `GET /api/posts/:id`
- **Auth:** `admin|creator`
- **Response:** Single `Post` (includes `author`, `images`, `signage_metadata`, `signage_deployments`)
- **Notes:** Non-admins get 403 if post's `group_id` is outside their allowed set.

### `POST /api/posts`
- **Auth:** `admin|creator`
- **Content-Type:** `multipart/form-data` (images up to 10 files, 200MB each)
- **Body:** `{ title, description_markdown?, group_id?, group_ids?, allowed_on_feed?|publish_to_feed?, allowed_on_signage?|publish_to_signage?, status?, device_ids?, duration_seconds?, start_date?, end_date?, priority?, display_group?, signage_state?, is_enabled?, play_order?, nocache?, skip_asset_check?, processed_media?, media_crops? }`
- **Response:** `{ posts: Post[], count: number }`
- **Notes:**
  - Creates one post per group in `group_ids`.
  - `auto_approve` users / admins set `allowed_on_feed/signage` directly; others set `requested_*` flags.
  - If `device_ids` provided, calls `deployToSignage` per group.

### `PUT /api/posts/:id`
- **Auth:** `admin|creator` + `canManagePost` permission
- **Content-Type:** `multipart/form-data` (optional new images)
- **Body:** Same fields as create.
- **Response:** Updated `Post`
- **Notes:**
  - Admin edits update `allowed_*` permissions directly.
  - Creator edits update `requested_*` intent; `allowed_*` only if `auto_approve`.
  - Media replacement deletes old files + DB rows, then inserts new.
  - Complex deployment sync: if signage turned off → purge Pi assets; if on → redeploy; if devices changed → remove old + add new.

### `DELETE /api/posts/:id`
- **Auth:** `admin|creator` + `canManagePost`
- **Response:** `{ ok: true }`
- **Notes:** Deletes playlist items, signage assets (DB + Pi purge for online devices), media files, then the post.

### `POST /api/posts/bulk-action`
- **Auth:** `admin|creator`
- **Body:** `{ ids: number[], action: string, device_ids? }`
- **Actions:** `delete`, `remove-signage`, `remove-feed`, `add-feed`, `add-signage`, `add-both`
- **Response:** `{ ok: true, count: number }`
- **Notes:** `add-signage` / `add-both` can trigger `deployToSignage` for each post.

---

## Devices (`/api/devices`)

### `GET /api/devices`
- **Auth:** `admin` sees all; `creator` sees displays in allowed groups + `all_groups`.
- **Query:** `sortBy?, sortOrder?`
- **Response:** `Device[]` (includes `group`, `groups`)

### `GET /api/devices/:id`
- **Auth:** `admin`
- **Response:** `Device` (includes `group`, `groups`, last 50 `sensor_logs`)

### `POST /api/devices/register`
- **Auth:** `admin`
- **Body:** `{ id?, device_name, ip_address, group_id?, group_ids?, location?, all_groups? }`
- **Response:** Created `Device`
- **Notes:** Manual registration is auto-approved.

### `POST /api/devices/:id/approve`
- **Auth:** `admin`
- **Body:** `{ group_ids?, group_id?, all_groups? }`
- **Response:** Updated `Device`
- **Notes:** Applies pending_name/pending_ip/pending_location if present.

### `POST /api/devices/:id/reject`
- **Auth:** `admin`
- **Response:** `{ message }`
- **Notes:** If device was never approved, deletes it. Otherwise clears pending fields.

### `PUT /api/devices/:id`
- **Auth:** `admin`
- **Body:** `{ device_name?, ip_address?, group_id?, group_ids?, location?, all_groups? }`
- **Response:** Updated `Device`

### `PUT /api/devices/:id/reset`
- **Auth:** `admin`
- **Response:** `{ message, device }`
- **Notes:** Resets name to `Pi Display {id}`, clears location and IP.

### `DELETE /api/devices/:id`
- **Auth:** `admin`
- **Response:** `{ ok: true, message }`
- **Notes:** Emits `clear_all` to Pi (best effort), then cascade-deletes.

---

## Signage (`/api/signage`)

### `GET /api/signage/device/:device_id/deployments`
- **Auth:** Pi pulls this; called by Pi agent, not frontend directly.
- **Response:** Deployment[] with post info, filtered by `postVisibleForGroup` and urgency sort.

### `POST /api/signage/publish`
- **Auth:** `admin|creator`
- **Body:** `{ post_id, device_id, duration_seconds?, start_date?, end_date?, priority?, display_group?, signage_state? }`
- **Response:** `{ ok, pi_notified, pi_result, error? }`
- **Notes:**
  - Checks `canManagePost`, `canUseDevice`, control lock, approval, online status.
  - Upserts `signage_metadata` and `signage_deployment`.
  - Auto-approved creators push to Pi immediately; others queue in DB.

### `GET /api/signage/devices/:device_id/assets`
- **Auth:** `admin|creator`
- **Response:** `{ ok, assets[], tracked_assets[], stale? }`
- **Notes:** Sends `list` command to Pi; if Pi responds, syncs to DB. Falls back to stale tracked assets on failure.

### `POST /api/signage/devices/:device_id/control`
- **Auth:** `admin|creator`
- **Body:** `{ command: 'next'|'previous'|'start', asset_id? }`
- **Response:** Pi command result
- **Notes:** `start` requires `asset_id` and `assertCanManageAsset` permission.

### `PATCH /api/signage/devices/:device_id/assets/:asset_id`
- **Auth:** `admin|creator`
- **Body:** `{ is_enabled }`
- **Response:** Pi command result
- **Notes:** Hides or shows asset in Anthias without deleting it.

### `DELETE /api/signage/devices/:device_id/assets/:asset_id`
- **Auth:** `admin|creator`
- **Query:** `force?`
- **Response:** Pi command result
- **Notes:** Deletes from Anthias + DB. If `?force=true`, cleans DB even if Pi command fails.

### `GET /api/signage/playlists`
- **Auth:** `admin`
- **Response:** `Playlist[]` (includes items with posts)

---

## Media (`/api/media`)

### `POST /api/media/probe`
- **Auth:** `admin|creator`
- **Content-Type:** `multipart/form-data` (single file)
- **Response:** `{ media_type: 'VIDEO'|'IMAGE', duration_seconds?, width?, height? }`
- **Notes:** Probes with ffprobe (video) or sharp (image). Deletes temp file after.

### `POST /api/media/process`
- **Auth:** `admin|creator`
- **Content-Type:** `multipart/form-data` (single file)
- **Body:** `crop?` JSON string
- **Response:** `{ image_path, media_type, width?, height?, duration_seconds?, thumbnail_path? }`
- **Notes:** Server-side crop/trim. Returns paths ready to attach to a post.

### `DELETE /api/media`
- **Auth:** `admin|creator`
- **Body:** `{ image_path }`
- **Response:** `{ deleted: true }` or `{ deleted: false, reason: 'in_use' }`
- **Notes:** Blocks deletion if path is referenced by any `PostImage`.

---

## Sensors (`/api/sensors`)

### `POST /api/sensors/log`
- **Auth:** `x-device-api-key` header if `DEVICE_API_KEY` env is set; otherwise public.
- **Body:** `{ device_id, motion, brightness, rain }`
- **Response:** Created `SensorLog`
- **Notes:** Backup REST path; main ingestion is Socket.IO `sensor_update`.

### `GET /api/sensors/:device_id`
- **Auth:** `admin`
- **Response:** Last 100 `SensorLog[]` for device.

---

## Static Files

### `GET /uploads/images/:filename`
### `GET /uploads/videos/:filename`
- **Auth:** public (CORS enabled)
- **Notes:** Safe path traversal check via `isPathInside`. Serves with correct MIME type.

### `GET /uploads/*`
- **Auth:** public
- **Notes:** Static file serving from `backend/uploads/`.

### `GET /api/health`
- **Auth:** public
- **Response:** `{ status: 'ok', uploads_dir }`

---

## Response Error Shapes

All error responses follow:

```json
{ "error": "string message" }
```

Status codes used:
- `400` — bad input, validation failure, or Prisma error
- `401` — missing/invalid token (except auth middleware bug: returns 400 for invalid token)
- `403` — insufficient permissions, control lock, unapproved device
- `404` — resource not found
- `502` — Pi command failed (publish endpoint)
- `503` — Pi offline or did not respond (control/asset endpoints)

---

## Frontend → Backend API Client

`frontend/src/api/axios.js` creates an axios instance with:
- `baseURL` from `apiBaseUrl()` (reads `VITE_API_URL`)
- `Authorization: Bearer <token>` header from `localStorage`
- 15-second timeout

All components import `api` from this module and call it directly (no feature-level API modules yet).

---

## Auth Store ↔ Backend Contract

`useAuthStore` stores in `localStorage`:
- `token`, `role`, `group_id`, `max_signage_state`, `managed_group_ids`
- `managed_group_ids` is JSON-stringified array of numbers

On mount, `AuthContext` calls `GET /auth/me` and refreshes the store with latest DB values. This is the "stale JWT fix" — the JWT may have old fields, but `/auth/me` keeps them current.

---

_Last updated: Phase 0 baseline — pre-refactor._
