# Frontend Architecture

This document describes the layered architecture, data flows, and design decisions of the Smart Signage frontend.

---

## Layered Architecture

The frontend follows a strict layered pattern where each layer depends only on the layer beneath it.

```mermaid
flowchart TB
    subgraph Presentation["Presentation Layer"]
        P[Pages<br/>Route-level views]
        C[Components<br/>Reusable UI blocks]
    end
    subgraph State["State Layer"]
        Z[Zustand Store<br/>Global auth state]
        CT[AuthContext<br/>React context wrapper]
    end
    subgraph Data["Data Layer"]
        A[Axios API<br/>HTTP client + interceptors]
        SO[Socket.IO<br/>WebSocket client]
    end
    subgraph Config["Config Layer"]
        CB[apiBase.js<br/>Dynamic URL resolver]
        T[tokens.js<br/>Design tokens]
        S[styles.js<br/>Composed styles]
    end

    P --> C
    C --> Z
    C --> CT
    CT --> Z
    C --> A
    C --> SO
    A --> CB
    S --> T
    C --> S
    C --> T
```

### Layer Responsibilities

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Pages** | Route-level views, data fetching, layout composition | `AdminDevices.jsx` fetches devices on mount and renders `DeviceList` |
| **Components** | Reusable UI blocks, forms, editors, modals | `PostForm.jsx` handles form state and validation |
| **State** | Global auth state, localStorage sync | `useAuthStore.js` persists JWT and profile |
| **Data** | HTTP requests, WebSocket connections | `api/axios.js` attaches JWT to every request |
| **Config** | Environment URLs, design tokens, constants | `apiBase.js` resolves `/api` in dev, full URL in prod |

---

## Data Flow

### Standard API Request

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant Z as Zustand
    participant A as Axios
    participant B as Backend

    U->>C: Click action
    C->>Z: Read token
    Z-->>C: token
    C->>A: api.devices.getDevices()
    A->>A: Request interceptor<br/>attach Authorization: Bearer
    A->>B: GET /api/devices
    B-->>A: JSON response
    A->>A: Response interceptor<br/>check 401
    A-->>C: Device list
    C->>C: setState(devices)
    C->>U: Re-render table
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant L as Login.jsx
    participant AC as AuthContext
    participant Z as useAuthStore
    participant API as api/auth.js
    participant B as Backend

    U->>L: Enter credentials
    L->>AC: login(username, password)
    AC->>API: POST /auth/login
    API->>B: { username, password }
    B-->>API: { token, role, group_id, ... }
    API-->>AC: Response
    AC->>Z: setAuth(token, role, group_id, profile)
    Z->>Z: Decode JWT payload<br/>Persist to localStorage
    AC->>API: GET /auth/me
    API-->>AC: Full profile
    AC->>Z: Update with fresh fields
    AC-->>L: Success
    L->>U: Redirect to dashboard
```

---

## Entry Point Bootstrap

```mermaid
sequenceDiagram
    participant B as Browser
    participant M as main.jsx
    participant R as ReactDOM
    participant A as App.jsx
    participant BR as BrowserRouter
    participant AP as AuthProvider
    participant AR as AppRoutes

    B->>M: Load index.html
    M->>R: createRoot(document.getElementById('root'))
    R->>A: Render <App />
    A->>BR: <BrowserRouter>
    BR->>AP: <AuthProvider>
    AP->>AP: useEffect → fetch /auth/me
    AP->>AR: <AppRoutes />
    AR->>AR: useAuthStore → read token/role
    AR->>AR: Match route, render page
```

On boot:
1. `main.jsx` mounts the React app
2. `AuthProvider` fetches `/auth/me` to refresh profile fields that may have changed since JWT issuance
3. `AppRoutes` reads the auth store and renders the appropriate route
4. If the token is expired, `useAuthStore` auto-purges it from `localStorage`

---

## Module Dependency Graph

```mermaid
flowchart TB
    subgraph Entry
        M[main.jsx]
        A[App.jsx]
    end
    subgraph Pages
        AD[AdminDevices.jsx]
        CD[CreatorDashboard.jsx]
        FE[Feed.jsx]
        LO[Login.jsx]
    end
    subgraph Components
        DL[DeviceList.jsx]
        D[Designer.jsx]
        PF[PostForm.jsx]
        PL[PostList.jsx]
    end
    subgraph State
        Z[useAuthStore.js]
        AC[AuthContext.jsx]
    end
    subgraph API
        AX[api/axios.js]
        AUTH[api/auth.js]
        DEV[api/devices.js]
        POST[api/posts.js]
    end
    subgraph Config
        CB[config/apiBase.js]
        T[tokens.js]
        S[styles.js]
    end

    M --> A
    A --> AD & CD & FE & LO
    AD --> DL
    CD --> D & PF
    FE --> PL
    LO --> AC
    AC --> Z
    AC --> AUTH
    DL --> DEV
    D --> POST
    PF --> POST
    PL --> POST
    DEV & POST --> AX
    AX --> CB
    DL & D & PF --> S
    S --> T
```

---

## Design Decisions

### Why Zustand for Auth State

The auth state is a single object accessed by nearly every component. Zustand was chosen over Redux because:
- No reducers, actions, or action types
- No prop drilling (unlike Context)
- Built-in localStorage persistence with `persist` middleware pattern
- Bundle size ~1 KB vs Redux ~7 KB

### Why React Context Wraps Zustand

Zustand is used for the store, but `AuthContext.jsx` wraps it to provide:
- `login()` and `logout()` methods with side effects (API calls, localStorage)
- Profile hydration on mount via `useEffect`
- A stable API surface that components can import without knowing Zustand internals

### Why Per-Domain API Modules

Instead of a single `api.js` file, each backend domain has its own module (`api/devices.js`, `api/posts.js`, etc.):
- **Discoverability** — Developers know where to find device-related endpoints
- **Tree-shaking** — Unused API modules are excluded from the production bundle
- **Testing** — Easy to mock individual modules

---

_This document is part of the Smart Signage frontend documentation. See `frontend/README.md` for the high-level overview._
