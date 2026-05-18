# Refactor Plan — WebServerSignage

Goal: improve maintainability without changing observable behavior. Executed in
small, reviewable phases. Each phase ships independently and leaves the system
working.

Legend: **[BE]** backend, **[FE]** frontend, **[CROSS]** both.

---

## 0. Guardrails (do these first)

Before any structural change, lock down behavior so we can refactor with
confidence.

- [ ] **[CROSS] Snapshot the current API surface.** Generate an `openapi.yaml`
      (or hand-write a short `docs/api.md`) listing every route, method, auth
      role, request body, and response shape. Source of truth during the
      refactor.
- [ ] **[BE] Add minimal smoke tests** for the routes most likely to regress:
      `POST /posts`, `PUT /posts/:id`, `POST /signage/publish`, `DELETE
      /signage/devices/:id/assets/:asset_id`, `POST /devices/:id/approve`. Use
      `supertest` + a SQLite or test Postgres URL. Target ~30 minutes of
      coverage, not exhaustive.
- [ ] **[FE] Add 2–3 Playwright happy-path tests:** create-post, publish to
      signage, approve device. They will catch the biggest regressions.
- [ ] **[CROSS] Pin formatter + linter.** Add `prettier`, `eslint:recommended`,
      `eslint-plugin-react-hooks` (frontend), `eslint-plugin-node`/`n`
      (backend). Run on the whole repo once, commit. From here on every refactor
      commit must pass lint.

Until the smoke tests exist, refactor commits should be tiny: move + re-export,
no behavior change.

---

## 1. Repository layout target

### Backend

```
backend/src/
  index.js                 # app bootstrap only
  app.js                   # express() + middleware wiring, exported for tests
  config/                  # env, constants (already partly present)
  db/
    prisma.js              # existing
  middleware/
    auth.js                # existing, extended (see phase 4)
    error.js               # NEW: central error handler
    upload.js              # NEW: multer setup (currently inline in posts.js)
  validators/              # NEW: zod schemas per route
    post.schema.js
    signage.schema.js
    device.schema.js
    user.schema.js
  repositories/            # NEW: Prisma calls, no business logic
    postRepo.js
    signageRepo.js
    deviceRepo.js
    userRepo.js
    groupRepo.js
  services/                # NEW: business logic
    postService.js         # create/update/delete/bulk, intent vs permission
    signageService.js      # publish, asset CRUD, control lock
    deviceService.js       # approve/reject/reset, group membership
    userService.js         # priority swap, managed-groups update
    deploymentService.js   # deployToSignage + Pi reconciliation
  realtime/                # NEW (rename from websocket/)
    gateway.js             # io.on("connection", ...)
    piBridge.js            # emitToDevice, emitToDeviceAck (already exported via app.set)
    heartbeat.js           # heartbeat-specific code
    sweeper.js             # offline sweeper
  routes/                  # THIN: parse req → call service → send res
    auth.js
    posts.js
    signage.js
    devices.js
    users.js
    groups.js
    media.js
    sensors.js
    playlists.js
  utils/
    signageStates.js       # existing
    media.js               # NEW: extract mediaFileExists, processMediaFiles
    permissions.js         # NEW: canManage, canManagePost, canUseDevice
    controlLock.js         # NEW: assertControlAllowed, applyControlLock
```

### Frontend

```
frontend/src/
  api/
    client.js              # axios instance (existing)
    auth.js                # NEW: /auth/me, /login
    posts.js               # NEW: list/create/update/delete/bulk
    signage.js             # NEW: publish, assets, control
    devices.js             # NEW
    users.js               # NEW
    groups.js              # NEW
  store/
    useAuthStore.js        # existing, slimmed (see phase 8)
  hooks/
    usePersistentState.js  # existing
    usePolling.js          # NEW: replace ad-hoc setInterval blocks
    useGroupDeviceSync.js  # NEW: extracted from CreatorEditor / CreatorPosts
  components/              # shared UI (existing)
    ui/                    # NEW: Button, Card, Field, MessageBanner, Modal
  features/                # NEW: feature-scoped pages
    posts/
      CreatorPosts.jsx     # composition only
      components/
        PostForm.jsx
        PostList.jsx
        PostFilters.jsx
        BulkActionsBar.jsx
        SignagePanel.jsx   # the nested "publish_to_signage" block
      hooks/
        usePostsList.js
        useBulkActions.js
    signage/
      CreatorSignage.jsx
      components/
        SignagePublishForm.jsx
        AssetList.jsx
        AssetRow.jsx
    devices/
      AdminDevices.jsx
      components/
        DeviceList.jsx
        DeviceRegisterForm.jsx
        DeviceSettingsPanel.jsx
        SensorLogPanel.jsx
        ApprovalBanner.jsx
    users/
      AdminUsers.jsx
      components/
        UserList.jsx
        UserForm.jsx
    feed/
      Feed.jsx
  pages/                   # legacy shells; eventually re-export from features/
  styles/
    tokens.css             # NEW: color/spacing tokens
    globals.css
```

> Decision to make in phase 8: keep inline-style objects vs introduce CSS
> modules or Tailwind. **Recommendation: CSS modules** — minimal install, no
> build changes, easy to colocate with components.

---

## 2. Phasing — order of operations

Each phase is one PR (or one focused session). Phases below can be paused at
any boundary and the app still runs.

### Phase A — Backend route slimming (highest ROI)

A1. **Extract `posts.js` helpers** into `utils/permissions.js`,
    `utils/media.js`, `utils/controlLock.js`. No behavior change; just move +
    re-export.

A2. **Create `services/postService.js`** and move:
    - `deployToSignage` → `deploymentService.deployPostToDevices`
    - `parseDeviceIds`, `deploymentSchedule`, `toBool` (or move shared helpers
      to `utils/`)
    - Business logic for create/update (the intent-vs-permission block,
      `requested_*` reconciliation).

    Routes call `await postService.create(req.user, body, files)` and translate
    errors to HTTP. The routes file should drop to ~200 lines.

A3. **Create `repositories/postRepo.js`** and move every `prisma.post.*`,
    `prisma.postImage.*`, `prisma.signageDeployment.*` call out of services.
    Repositories return plain data; services compose.

A4. **Add `validators/post.schema.js`** with zod schemas for create/update/
    bulk-action bodies. Routes do `const body = postSchema.parse(req.body)`
    and the validator throws → caught by `middleware/error.js`.

### Phase B — Backend signage slimming

B1. Move `_emitToDeviceAck`, `sendSignageCommand` into `realtime/piBridge.js`.
B2. Extract `assertCanManageAsset`, `canUseDevice`, `getAllowedDevice` to
    `utils/permissions.js`.
B3. Create `services/signageService.js` for publish + asset CRUD;
    `services/deploymentService.js` already covers the post→signage path from
    phase A.
B4. Add `validators/signage.schema.js`.

### Phase C — Backend devices + users

C1. `services/deviceService.js` (approve/reject/reset/erase) and
    `repositories/deviceRepo.js`.
C2. `services/userService.js` houses the priority-swap algorithm — currently
    inside `routes/users.js`. Add a unit test for the swap before moving.
C3. Centralize the JWT payload shape in `services/authService.js` so login,
    register, and `/me` all build the response from one function.

### Phase D — Backend cross-cutting

D1. **Central error handler** (`middleware/error.js`). All routes use
    `next(err)` or services throw `class HttpError extends Error { statusCode }`.
    Remove the ~20 `try/catch { res.status(400).json({error: e.message}) }`
    blocks.
D2. **Async route wrapper**: `asyncHandler(fn)` to remove repeated try/catch
    boilerplate in routes.
D3. **Replace `app.set("emitToDeviceAck", ...)`** with a proper module export.
    Currently routes pull it via `req.app.get(...)` which is awkward and
    untestable.
D4. **Move `app.use` route mounting** out of `index.js` into `app.js`; keep
    `index.js` for server startup only. Enables `supertest` testing.

### Phase E — Frontend page splits

E1. `CreatorPosts.jsx` → `features/posts/`:
    - `PostForm.jsx` (lines ~382–683 today)
    - `PostList.jsx` (lines ~686–940)
    - `PostFilters.jsx`
    - `BulkActionsBar.jsx`
    - `SignagePanel.jsx` (the nested "publish_to_signage" block, currently
      repeated in `CreatorEditor.jsx`)
    - `usePostsList(filters)` hook for fetching + state
    - `useBulkActions(selectedIds, devices)` hook

    Pause point: page works identically, just composed of smaller pieces.

E2. `AdminDevices.jsx` → `features/devices/` (DeviceList, RegisterForm,
    SettingsPanel, ApprovalBanner, SensorLogPanel).

E3. `CreatorSignage.jsx` → `features/signage/` (SignagePublishForm, AssetList,
    AssetRow). Share `SignagePanel` from E1.

E4. `CreatorEditor.jsx` — reuse `SignagePanel` instead of duplicating the same
    block of form fields. Removes ~150 lines of duplication.

### Phase F — Frontend API layer

F1. Create `src/api/posts.js`, `signage.js`, `devices.js`, `users.js`,
    `groups.js`, `auth.js`. Move every `api.get/post/put/delete` call out of
    components into these modules.
F2. Convert ad-hoc fetch logic in `CreatorSignage.jsx:71-97` (the loop over
    allowed group ids) into `postsApi.listForGroups(groupIds)`.
F3. Type the responses with JSDoc `@typedef` (or migrate to TypeScript — see
    phase H).

### Phase G — Frontend styling

G1. Introduce `styles/tokens.css` with CSS custom properties for the inline
    colors used throughout (`#2563eb`, `#dcfce7`, etc. — there are dozens).
G2. Migrate one feature at a time to CSS modules. Keep `styles.js` working as a
    facade until the migration is complete.
G3. Pull common pieces (Card, Button, Field, Label, MessageBanner) into
    `components/ui/`. The `messageStyle(msg)` helper in `CreatorSignage.jsx`
    becomes `<MessageBanner kind="success|warning|error" />`.

### Phase H — Optional but high-leverage

- **TypeScript** for the backend (incremental via `// @ts-check` then `.ts`).
  Prisma already emits TS types so this is mostly mechanical for repositories.
- **TypeScript** for the frontend api/ layer first, components later.
- **Replace inline styles with Tailwind** if the team prefers it over CSS
  modules — single decision point in phase G.

---

## 3. File-by-file move log (do this when executing)

Maintain a checklist as each move happens. Example for phase A:

| Symbol | From | To |
|---|---|---|
| `canManage(user, gid)` | `routes/posts.js` | `utils/permissions.js` |
| `canManagePost(actor, post)` | `routes/posts.js` + `routes/signage.js` | `utils/permissions.js` |
| `deploymentSchedule` | `routes/posts.js` | `services/deploymentService.js` |
| `deployToSignage` | `routes/posts.js` | `services/deploymentService.js` |
| `parseDeviceIds` | `routes/posts.js` | `utils/parsers.js` |
| `mediaFileExists`, `processMediaFiles`, `deleteMediaFile` | scattered | `utils/media.js` |
| `assertControlAllowed`, `applyControlLock` | scattered | `utils/controlLock.js` |
| `assertCanManageAsset` | `routes/signage.js` | `utils/permissions.js` |
| `sendSignageCommand`, `_emitToDeviceAck` | `routes/signage.js` | `realtime/piBridge.js` |
| `uploadMedia` (multer) | `routes/posts.js` | `middleware/upload.js` |

Append rows during each subsequent phase.

---

## 4. Risks and how to mitigate

- **Circular imports** between services and repositories. Mitigation: services
  import repositories, never the reverse. Routes import services, never
  repositories.
- **`app.set("emitToDeviceAck", ...)` hidden coupling**. Routes today reach
  into `req.app.get(...)` for the socket emitter. Replacing this in one go
  risks missing call sites. Mitigation: grep for `emitToDeviceAck` before each
  phase that touches signage code.
- **`prisma.$transaction` boundaries**. Moving Prisma calls into repositories
  can accidentally break transactions if a service wraps multiple repo calls
  without passing the `tx` client. Mitigation: repositories accept an optional
  `client = prisma` argument; services pass `tx` when inside a transaction.
- **Frontend persistent state keys**. `usePersistentState(userScopedKey(...))`
  stores form state in `localStorage` keyed by string. Renaming a component
  must not change the key, or users lose drafts. Mitigation: keep the same
  string literal for the key even if the file moves.
- **Behavioral drift during extraction**. Mitigation: each extraction PR must
  pass the smoke tests from phase 0 unchanged. No "while I'm here" fixes mixed
  into refactor commits.

---

## 5. Definition of done per phase

A phase is done when:
1. All targeted moves are in place.
2. No behavior changed (smoke tests + Playwright pass with the exact same
   request/response bodies as before).
3. The file size of the file that motivated the phase shrank by ≥50% or below
   300 lines.
4. No `eslint-disable` was added.
5. The move log table in this file is updated.

---

## 6. Out of scope (explicitly)

- Database schema changes.
- Switching frameworks (Express → Fastify, React → Next.js).
- Switching the realtime transport (Socket.IO → SSE/WebRTC).
- Auth model changes (JWT → session). The stale-JWT fix already shipped uses
  `/auth/me` refresh and is sufficient for now.
- Internationalization / accessibility audit. Worth doing but not a refactor.

---

## 7. Execution checklist (tick as we go)

- [x] Phase 0 guardrails: lint, smoke tests, Playwright happy paths
- [x] Phase A1: extract posts.js helpers to utils/
- [x] Phase A2: postService
- [x] Phase A3: postRepo
- [x] Phase A4: post validators
- [x] Phase B1: piBridge
- [x] Phase B2: signage permissions to utils/
- [x] Phase B3: signageService
- [x] Phase B4: signage validators
- [x] Phase C1: deviceService + repo
- [x] Phase C2: userService (priority swap with unit test)
- [x] Phase C3: authService unified JWT shape
- [x] Phase D1: central error handler
- [x] Phase D2: asyncHandler
- [x] Phase D3: piBridge module (drop app.set)
- [x] Phase D4: app.js / index.js split
- [x] Phase E1: CreatorPosts split
- [x] Phase E2: AdminDevices split
- [x] Phase E3: CreatorSignage split
- [x] Phase E4: CreatorEditor reuses SignagePanel
- [x] Phase F1: frontend api/ modules
- [x] Phase F2: postsApi.listForGroups
- [ ] Phase G1: design tokens
- [ ] Phase G2: CSS modules per feature
- [ ] Phase G3: components/ui kit
- [ ] Phase H: TypeScript (optional)
