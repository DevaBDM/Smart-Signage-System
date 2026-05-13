## STEP 1 — Install New Dependencies

```bash
cd WebServer/frontend
npm install react-markdown zustand socket.io-client
```

---

## STEP 2 — Updated Folder Structure

```
src/
├── api/
│   └── axios.js
├── context/
│   └── AuthContext.jsx
├── store/
│   └── useAuthStore.js          ← Zustand auth store
├── socket/
│   └── socket.js                ← Socket.IO client instance
├── pages/
│   ├── Login.jsx
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   ├── AdminDevices.jsx
│   │   ├── AdminUsers.jsx
│   │   ├── AdminPosts.jsx
│   │   ├── AdminPlaylists.jsx
│   │   └── AdminLogs.jsx
│   ├── creator/
│   │   ├── CreatorDashboard.jsx
│   │   ├── CreatorPosts.jsx
│   │   ├── CreatorEditor.jsx
│   │   └── CreatorSignage.jsx
│   └── public/
│       ├── Feed.jsx
│       └── PostDetail.jsx
├── components/
│   ├── AdminSidebar.jsx
│   ├── CreatorSidebar.jsx
│   └── FabricDesigner.jsx
└── App.jsx
```

```bash
mkdir -p src/store src/socket src/pages/admin src/pages/creator src/pages/public
touch src/store/useAuthStore.js
touch src/socket/socket.js
touch src/pages/admin/AdminDashboard.jsx
touch src/pages/admin/AdminDevices.jsx
touch src/pages/admin/AdminUsers.jsx
touch src/pages/admin/AdminPosts.jsx
touch src/pages/admin/AdminPlaylists.jsx
touch src/pages/admin/AdminLogs.jsx
touch src/pages/creator/CreatorDashboard.jsx
touch src/pages/creator/CreatorPosts.jsx
touch src/pages/creator/CreatorEditor.jsx
touch src/pages/creator/CreatorSignage.jsx
touch src/pages/public/Feed.jsx
touch src/pages/public/PostDetail.jsx
touch src/components/AdminSidebar.jsx
touch src/components/CreatorSidebar.jsx
```

---

## STEP 3 — Zustand Auth Store (`src/store/useAuthStore.js`)

```js
import { create } from "zustand";

const useAuthStore = create((set) => ({
  token: localStorage.getItem("token") || null,
  role: localStorage.getItem("role") || null,
  department_id: localStorage.getItem("department_id") || null,

  setAuth: (token, role, department_id) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("department_id", department_id ?? "");
    set({ token, role, department_id });
  },

  clearAuth: () => {
    localStorage.clear();
    set({ token: null, role: null, department_id: null });
  },
}));

export default useAuthStore;
```

---

## STEP 4 — Socket Client (`src/socket/socket.js`)

```js
import { io } from "socket.io-client";

const BASE =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

// Single shared instance — connect only once
const socket = io(BASE, { autoConnect: false });

export default socket;
```

---

## STEP 5 — Updated Auth Context (`src/context/AuthContext.jsx`)

```jsx
import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/useAuthStore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { setAuth, clearAuth, role } = useAuthStore();
  const navigate = useNavigate();

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { token, role, department_id } = res.data;
    setAuth(token, role, department_id);
    // Route to correct dashboard by role
    if (role === "admin") navigate("/admin");
    else if (role === "creator") navigate("/creator");
    else navigate("/feed");
  };

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## STEP 6 — Updated `App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuthStore from "./store/useAuthStore";

// Auth
import Login from "./pages/Login";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminPlaylists from "./pages/admin/AdminPlaylists";
import AdminLogs from "./pages/admin/AdminLogs";

// Creator
import CreatorDashboard from "./pages/creator/CreatorDashboard";
import CreatorPosts from "./pages/creator/CreatorPosts";
import CreatorEditor from "./pages/creator/CreatorEditor";
import CreatorSignage from "./pages/creator/CreatorSignage";

// Public
import Feed from "./pages/public/Feed";
import PostDetail from "./pages/public/PostDetail";

function RequireRole({ role, children }) {
  const { token, role: userRole } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { token, role } = useAuthStore();

  return (
    <Routes>
      {/* Public */}
      <Route path="/feed" element={<Feed />} />
      <Route path="/post/:id" element={<PostDetail />} />

      {/* Auth */}
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={role === "admin" ? "/admin" : "/creator"} />
          ) : (
            <Login />
          )
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/admin/devices"
        element={
          <RequireRole role="admin">
            <AdminDevices />
          </RequireRole>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireRole role="admin">
            <AdminUsers />
          </RequireRole>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <RequireRole role="admin">
            <AdminPosts />
          </RequireRole>
        }
      />
      <Route
        path="/admin/playlists"
        element={
          <RequireRole role="admin">
            <AdminPlaylists />
          </RequireRole>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <RequireRole role="admin">
            <AdminLogs />
          </RequireRole>
        }
      />

      {/* Creator */}
      <Route
        path="/creator"
        element={
          <RequireRole role="creator">
            <CreatorDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/creator/posts"
        element={
          <RequireRole role="creator">
            <CreatorPosts />
          </RequireRole>
        }
      />
      <Route
        path="/creator/editor"
        element={
          <RequireRole role="creator">
            <CreatorEditor />
          </RequireRole>
        }
      />
      <Route
        path="/creator/signage"
        element={
          <RequireRole role="creator">
            <CreatorSignage />
          </RequireRole>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/feed" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## STEP 7 — Shared Layout Styles (`src/styles.js`)

One file both sidebars and pages share so you don't repeat yourself:

```js
// src/styles.js
export const layout = { display: "flex", minHeight: "100vh" };
export const main = {
  marginLeft: 220,
  flex: 1,
  padding: "32px 36px",
  background: "#f4f6f9",
  minHeight: "100vh",
};
export const heading = {
  fontSize: 24,
  fontWeight: 700,
  color: "#1a1a2e",
  marginBottom: 4,
};
export const sub = { fontSize: 13, color: "#6b7280", marginBottom: 28 };
export const card = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  marginBottom: 24,
};
export const table = { width: "100%", borderCollapse: "collapse" };
export const th = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  padding: "8px 12px",
  borderBottom: "2px solid #e5e7eb",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
export const td = {
  padding: "11px 12px",
  fontSize: 14,
  color: "#374151",
  borderBottom: "1px solid #f3f4f6",
};
export const btn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
export const input = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1.5px solid #d1d5db",
  fontSize: 14,
  background: "#f9fafb",
  width: "100%",
};
export const label = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 4,
};
export const badge = (color) => ({
  padding: "3px 10px",
  borderRadius: 99,
  fontSize: 12,
  fontWeight: 600,
  ...color,
});
```

---

## STEP 8 — Admin Sidebar (`src/components/AdminSidebar.jsx`)

```jsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/admin", label: "🏠 Dashboard" },
  { to: "/admin/devices", label: "📟 Devices" },
  { to: "/admin/users", label: "👥 Users" },
  { to: "/admin/posts", label: "🖼 Posts" },
  { to: "/admin/playlists", label: "📋 Playlists" },
  { to: "/admin/logs", label: "📊 Logs" },
];

export default function AdminSidebar() {
  const { logout } = useAuth();
  return <Sidebar links={links} role="Admin" logout={logout} color="#2563eb" />;
}

export function Sidebar({ links, role, logout, color }) {
  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <span style={{ fontSize: 22 }}>📡</span>
        <div>
          <div style={s.brandName}>Smart Signage</div>
          <div style={{ ...s.roleTag, color }}>{role}</div>
        </div>
      </div>
      <nav style={s.nav}>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to.split("/").length === 2}
            style={({ isActive }) => ({
              ...s.link,
              background: isActive ? `${color}18` : "transparent",
              color: isActive ? color : "#374151",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={s.footer}>
        <button onClick={logout} style={s.logoutBtn}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: "#fff",
    borderRight: "1.5px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  brandName: { fontWeight: 700, fontSize: 15, color: "#1a1a2e" },
  roleTag: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "12px 8px",
  },
  link: {
    display: "block",
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 13,
    transition: "all 0.15s",
    textDecoration: "none",
  },
  footer: { padding: "16px", borderTop: "1px solid #e5e7eb" },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
```

---

## STEP 9 — Creator Sidebar (`src/components/CreatorSidebar.jsx`)

```jsx
import { Sidebar } from "./AdminSidebar";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/creator", label: "🏠 Dashboard" },
  { to: "/creator/posts", label: "📝 My Posts" },
  { to: "/creator/editor", label: "🎨 Designer" },
  { to: "/creator/signage", label: "🖥 Signage" },
];

export default function CreatorSidebar() {
  const { logout } = useAuth();
  return (
    <Sidebar links={links} role="Creator" logout={logout} color="#7c3aed" />
  );
}
```

---

## STEP 10 — Admin Pages

**`src/pages/admin/AdminDashboard.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

function Stat({ icon, label, value, color }) {
  return (
    <div
      style={{
        ...S.card,
        borderTop: `4px solid ${color}`,
        textAlign: "center",
        marginBottom: 0,
      }}
    >
      <div style={{ fontSize: 30 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 700, margin: "6px 0" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [devices, setDevices] = useState([]);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  const online = devices.filter((d) => d.status === "online").length;

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Admin Dashboard</h1>
        <p style={S.sub}>System overview</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 20,
            marginBottom: 28,
          }}
        >
          <Stat
            icon="📟"
            label="Total Devices"
            value={devices.length}
            color="#2563eb"
          />
          <Stat icon="🟢" label="Online" value={online} color="#16a34a" />
          <Stat
            icon="🖼"
            label="Total Posts"
            value={posts.length}
            color="#7c3aed"
          />
          <Stat icon="👥" label="Users" value={users.length} color="#f59e0b" />
        </div>

        <div style={S.card}>
          <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Recent Devices</h2>
          <table style={S.table}>
            <thead>
              <tr>
                {["Device", "IP", "Department", "Status", "Last Seen"].map(
                  (h) => (
                    <th key={h} style={S.th}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 8).map((d) => (
                <tr key={d.id}>
                  <td style={S.td}>{d.device_name}</td>
                  <td style={S.td}>{d.ip_address}</td>
                  <td style={S.td}>{d.department?.name ?? "—"}</td>
                  <td style={S.td}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          d.status === "online" ? "#dcfce7" : "#fee2e2",
                        color: d.status === "online" ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td style={S.td}>
                    {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/admin/AdminUsers.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "creator",
    department_id: "",
  });
  const [error, setError] = useState("");

  const load = () => {
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
    api
      .get("/departments")
      .then((r) => setDepts(r.data))
      .catch(() => {});
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/register", {
        ...form,
        department_id: form.department_id || null,
      });
      setForm({
        username: "",
        password: "",
        role: "creator",
        department_id: "",
      });
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed");
    }
  };

  const del = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/users/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>User Management</h1>
        <p style={S.sub}>Create and manage admin and creator accounts.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Add User</h2>
            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Username</label>
              <input
                style={S.input}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
              <label style={S.label}>Password</label>
              <input
                style={S.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <label style={S.label}>Role</label>
              <select
                style={S.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="creator">Creator</option>
                <option value="admin">Admin</option>
              </select>
              <label style={S.label}>Department</label>
              <select
                style={S.input}
                value={form.department_id}
                onChange={(e) =>
                  setForm({ ...form, department_id: e.target.value })
                }
              >
                <option value="">— None —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#2563eb",
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                Create User
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              All Users ({users.length})
            </h2>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Username", "Role", "Department", "Created", ""].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <strong>{u.username}</strong>
                    </td>
                    <td style={S.td}>{u.role}</td>
                    <td style={S.td}>{u.department?.name ?? "—"}</td>
                    <td style={S.td}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => del(u.id)}
                        style={{
                          ...S.btn,
                          background: "#fee2e2",
                          color: "#b91c1c",
                          padding: "4px 10px",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/admin/AdminDevices.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [depts, setDepts] = useState([]);
  const [sel, setSel] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [form, setForm] = useState({
    device_name: "",
    ip_address: "",
    department_id: "",
  });

  const load = () => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
    api
      .get("/departments")
      .then((r) => setDepts(r.data))
      .catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const select = async (d) => {
    setSel(d);
    const r = await api.get(`/devices/${d.id}`);
    setSensors(r.data.sensor_logs || []);
  };

  const register = async (e) => {
    e.preventDefault();
    await api.post("/devices/register", {
      ...form,
      department_id: form.department_id || null,
    });
    setForm({ device_name: "", ip_address: "", department_id: "" });
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Devices</h1>
        <p style={S.sub}>Manage and monitor Raspberry Pi displays.</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr 1fr",
            gap: 20,
          }}
        >
          {/* Register */}
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>
              Register Device
            </h2>
            <form
              onSubmit={register}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Device Name</label>
              <input
                style={S.input}
                value={form.device_name}
                onChange={(e) =>
                  setForm({ ...form, device_name: e.target.value })
                }
                required
              />
              <label style={S.label}>IP Address</label>
              <input
                style={S.input}
                value={form.ip_address}
                onChange={(e) =>
                  setForm({ ...form, ip_address: e.target.value })
                }
                required
              />
              <label style={S.label}>Department</label>
              <select
                style={S.input}
                value={form.department_id}
                onChange={(e) =>
                  setForm({ ...form, department_id: e.target.value })
                }
              >
                <option value="">— None —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Register
              </button>
            </form>
          </div>

          {/* Device list */}
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>All Devices</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {devices.map((d) => (
                <div
                  key={d.id}
                  onClick={() => select(d)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1.5px solid ${sel?.id === d.id ? "#2563eb" : "#e5e7eb"}`,
                    background: sel?.id === d.id ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{d.device_name}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {d.ip_address} · {d.department?.name ?? "—"}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 99,
                      marginTop: 4,
                      display: "inline-block",
                      background: d.status === "online" ? "#dcfce7" : "#fee2e2",
                      color: d.status === "online" ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sensor logs */}
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>
              {sel ? `Sensors — ${sel.device_name}` : "Sensor Logs"}
            </h2>
            {!sel && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 24 }}>
                Select a device
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 480,
                overflowY: "auto",
              }}
            >
              {sensors.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: "#f9fafb",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", gap: 16 }}>
                    <span>
                      👤 Motion: <strong>{s.motion ? "Yes" : "No"}</strong>
                    </span>
                    <span>
                      💡 Light: <strong>{s.brightness}</strong>
                    </span>
                    <span>
                      🌧 Rain: <strong>{s.rain ? "Yes" : "No"}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/admin/AdminPosts.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);

  const load = () =>
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
  useEffect(load, []);

  const del = async (id) => {
    if (!confirm("Delete post?")) return;
    await api.delete(`/posts/${id}`);
    load();
  };

  const toggle = async (post, field) => {
    await api.put(`/posts/${post.id}`, { ...post, [field]: !post[field] });
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>All Posts</h1>
        <p style={S.sub}>View and manage posts across all departments.</p>
        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                {[
                  "Image",
                  "Title",
                  "Department",
                  "Feed",
                  "Signage",
                  "Status",
                  "Created",
                  "",
                ].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ ...S.td, textAlign: "center", color: "#9ca3af" }}
                  >
                    No posts yet
                  </td>
                </tr>
              )}
              {posts.map((p) => (
                <tr key={p.id}>
                  <td style={S.td}>
                    {p.images?.[0] ? (
                      <img
                        src={`${BASE}${p.images[0].image_path}`}
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          background: "#f3f4f6",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        📋
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <strong>{p.title}</strong>
                  </td>
                  <td style={S.td}>{p.department?.name ?? "—"}</td>
                  <td style={S.td}>
                    <span
                      style={{ cursor: "pointer", fontSize: 18 }}
                      onClick={() => toggle(p, "publish_to_feed")}
                    >
                      {p.publish_to_feed ? "✅" : "⬜"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span
                      style={{ cursor: "pointer", fontSize: 18 }}
                      onClick={() => toggle(p, "publish_to_signage")}
                    >
                      {p.publish_to_signage ? "✅" : "⬜"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          p.status === "published" ? "#dcfce7" : "#fef9c3",
                        color: p.status === "published" ? "#16a34a" : "#92400e",
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td style={S.td}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => del(p.id)}
                      style={{
                        ...S.btn,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        padding: "4px 10px",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/admin/AdminPlaylists.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState({ name: "", department_id: "" });

  const load = () => {
    api
      .get("/playlists")
      .then((r) => setPlaylists(r.data))
      .catch(() => {});
    api
      .get("/departments")
      .then((r) => setDepts(r.data))
      .catch(() => {});
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/playlists", form);
    setForm({ name: "", department_id: "" });
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete playlist?")) return;
    await api.delete(`/playlists/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Playlists</h1>
        <p style={S.sub}>Manage signage playlists per department.</p>
        <div
          style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>New Playlist</h2>
            <form
              onSubmit={create}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Name</label>
              <input
                style={S.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <label style={S.label}>Department</label>
              <select
                style={S.input}
                value={form.department_id}
                onChange={(e) =>
                  setForm({ ...form, department_id: e.target.value })
                }
                required
              >
                <option value="">— Select —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Create
              </button>
            </form>
          </div>
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>All Playlists</h2>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{pl.name}</strong>
                    <span
                      style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}
                    >
                      {pl.department?.name}
                    </span>
                    <span
                      style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}
                    >
                      {pl.items?.length ?? 0} items
                    </span>
                  </div>
                  <button
                    onClick={() => del(pl.id)}
                    style={{
                      ...S.btn,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "4px 10px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/admin/AdminLogs.jsx`**

```jsx
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminLogs() {
  const [devices, setDevices] = useState([]);
  const [sel, setSel] = useState("");
  const [sensors, setSensors] = useState([]);
  const [tab, setTab] = useState("sensors");

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sel) return;
    api
      .get(`/sensors/${sel}`)
      .then((r) => setSensors(r.data))
      .catch(() => {});
  }, [sel]);

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Logs</h1>
        <p style={S.sub}>Sensor and error logs per device.</p>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          <select
            style={{ ...S.input, width: 240 }}
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            <option value="">— Select device —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.device_name}
              </option>
            ))}
          </select>
          {["sensors"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...S.btn,
                background: tab === t ? "#2563eb" : "#f3f4f6",
                color: tab === t ? "#fff" : "#374151",
              }}
            >
              {t === "sensors" ? "📊 Sensor Logs" : "⚠️ Error Logs"}
            </button>
          ))}
        </div>

        <div style={S.card}>
          {!sel && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
              Select a device to view logs.
            </p>
          )}
          {sel && sensors.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
              No logs found.
            </p>
          )}
          {sel && sensors.length > 0 && (
            <table style={S.table}>
              <thead>
                <tr>
                  {["#", "Motion", "Brightness", "Rain", "Logged At"].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sensors.map((s, i) => (
                  <tr key={s.id}>
                    <td style={S.td}>{i + 1}</td>
                    <td style={S.td}>{s.motion ? "✅ Yes" : "❌ No"}</td>
                    <td style={S.td}>{s.brightness}</td>
                    <td style={S.td}>{s.rain ? "🌧 Yes" : "☀️ No"}</td>
                    <td style={S.td}>
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
```

---

## STEP 11 — Creator Pages

**`src/pages/creator/CreatorDashboard.jsx`**

```jsx
import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

export default function CreatorDashboard() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  }, []);

  const feed = posts.filter((p) => p.publish_to_feed);
  const signage = posts.filter((p) => p.publish_to_signage);

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Creator Dashboard</h1>
        <p style={S.sub}>Your department content overview.</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {[
            {
              icon: "📝",
              label: "Total Posts",
              value: posts.length,
              color: "#7c3aed",
            },
            {
              icon: "📰",
              label: "On Feed",
              value: feed.length,
              color: "#2563eb",
            },
            {
              icon: "🖥",
              label: "On Signage",
              value: signage.length,
              color: "#16a34a",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                ...S.card,
                borderTop: `4px solid ${s.color}`,
                textAlign: "center",
                marginBottom: 0,
              }}
            >
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Recent Posts</h2>
          {posts.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 24 }}>
              No posts yet. Go to My Posts to create one.
            </p>
          )}
          {posts.slice(0, 5).map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontWeight: 500 }}>{p.title}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {new Date(p.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/creator/CreatorPosts.jsx`**

```jsx
import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function CreatorPosts() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description_markdown: "",
    publish_to_feed: false,
    publish_to_signage: false,
    status: "draft",
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef();

  const load = () =>
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries({ ...form, department_id }).forEach(([k, v]) =>
        fd.append(k, v),
      );
      files.forEach((f) => fd.append("images", f));
      await api.post("/posts", fd);
      setMsg("✅ Post created!");
      setForm({
        title: "",
        description_markdown: "",
        publish_to_feed: false,
        publish_to_signage: false,
        status: "draft",
      });
      setFiles([]);
      fileRef.current.value = "";
      load();
    } catch {
      setMsg("❌ Failed to create post.");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete?")) return;
    await api.delete(`/posts/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>My Posts</h1>
        <p style={S.sub}>Create and manage your department's content.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>New Post</h2>
            {msg && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
                }}
              >
                {msg}
              </div>
            )}
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Title</label>
              <input
                style={S.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label style={S.label}>Description (Markdown)</label>
              <textarea
                style={{
                  ...S.input,
                  minHeight: 100,
                  resize: "vertical",
                  fontFamily: "monospace",
                }}
                value={form.description_markdown}
                onChange={(e) =>
                  setForm({ ...form, description_markdown: e.target.value })
                }
                placeholder="## Announcement&#10;Write your **markdown** here..."
              />

              <label style={S.label}>Images</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles([...e.target.files])}
              />

              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_feed}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_feed: e.target.checked })
                    }
                  />
                  Publish to Feed
                </label>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_signage}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_signage: e.target.checked })
                    }
                  />
                  Publish to Signage
                </label>
              </div>

              <select
                style={S.input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
                disabled={loading}
              >
                {loading ? "Saving..." : "🚀 Save Post"}
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>
              Posts ({posts.length})
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 600,
                overflowY: "auto",
              }}
            >
              {posts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  {p.images?.[0] ? (
                    <img
                      src={`${BASE}${p.images[0].image_path}`}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: "#f3f4f6",
                        borderRadius: 8,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      📋
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.title}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}
                    >
                      {p.publish_to_feed ? "📰 Feed " : ""}
                      {p.publish_to_signage ? "🖥 Signage" : ""} · {p.status}
                    </div>
                  </div>
                  <button
                    onClick={() => del(p.id)}
                    style={{
                      ...S.btn,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "5px 10px",
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/creator/CreatorEditor.jsx`**

```jsx
import { useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import FabricDesigner from "../../components/FabricDesigner";
import * as S from "../../styles";

export default function CreatorEditor() {
  const [exported, setExported] = useState(null);

  const handleExport = (file, previewUrl) => setExported({ file, previewUrl });

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Poster Designer</h1>
        <p style={S.sub}>
          Design a signage poster then go to My Posts to attach and publish it.
        </p>
        {exported && (
          <div
            style={{
              ...S.card,
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
            }}
          >
            <img
              src={exported.previewUrl}
              style={{
                width: 80,
                height: 45,
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: "#166534" }}>
                ✅ Design exported — {exported.file.name}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Go to My Posts, create a new post and upload this image.
              </div>
            </div>
          </div>
        )}
        <div style={S.card}>
          <FabricDesigner onExport={handleExport} />
        </div>
      </main>
    </div>
  );
}
```

---

**`src/pages/creator/CreatorSignage.jsx`**

```jsx
import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function CreatorSignage() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    post_id: "",
    device_id: "",
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data.filter((p) => p.images?.length > 0)))
      .catch(() => {});
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, []);

  const publish = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const r = await api.post("/signage/publish", form);
      setMsg(
        r.data.pi_notified
          ? "✅ Published and Pi notified!"
          : "✅ Published (Pi offline — will sync on reconnect)",
      );
    } catch {
      setMsg("❌ Publish failed.");
    }
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Publish to Signage</h1>
        <p style={S.sub}>
          Send a post image directly to a display via Anthias.
        </p>

        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              Signage Publish
            </h2>
            {msg && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
                }}
              >
                {msg}
              </div>
            )}
            <form
              onSubmit={publish}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Post (must have an image)</label>
              <select
                style={S.input}
                value={form.post_id}
                onChange={(e) => setForm({ ...form, post_id: e.target.value })}
                required
              >
                <option value="">— Select post —</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <label style={S.label}>Target Display</label>
              <select
                style={S.input}
                value={form.device_id}
                onChange={(e) =>
                  setForm({ ...form, device_id: e.target.value })
                }
                required
              >
                <option value="">— Select device —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_name} ({d.status})
                  </option>
                ))}
              </select>

              <label style={S.label}>Duration (seconds)</label>
              <input
                style={S.input}
                type="number"
                min={1}
                max={300}
                value={form.duration_seconds}
                onChange={(e) =>
                  setForm({ ...form, duration_seconds: Number(e.target.value) })
                }
              />

              <label style={S.label}>Priority (1 = highest)</label>
              <input
                style={S.input}
                type="number"
                min={1}
                max={10}
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />

              <label style={S.label}>Start Date (optional)</label>
              <input
                style={S.input}
                type="datetime-local"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />

              <label style={S.label}>End Date (optional)</label>
              <input
                style={S.input}
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                🚀 Publish to Display
              </button>
            </form>
          </div>

          {/* Preview selected post */}
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Post Preview</h2>
            {!form.post_id && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                Select a post to preview
              </p>
            )}
            {form.post_id &&
              (() => {
                const p = posts.find(
                  (x) => String(x.id) === String(form.post_id),
                );
                if (!p) return null;
                return (
                  <div>
                    {p.images?.[0] && (
                      <img
                        src={`${BASE}${p.images[0].image_path}`}
                        style={{
                          width: "100%",
                          maxHeight: 300,
                          objectFit: "contain",
                          borderRadius: 8,
                          background: "#f3f4f6",
                        }}
                      />
                    )}
                    <h3 style={{ marginTop: 12, fontWeight: 700 }}>
                      {p.title}
                    </h3>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                      {p.images?.length} image(s) · Signage uses first image
                      only
                    </p>
                  </div>
                );
              })()}
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

## STEP 12 — Public Pages

**`src/pages/public/Feed.jsx`**

```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BASE = API.replace("/api", "");

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API}/posts?feed=true`)
      .then((r) => setPosts(r.data))
      .finally(() => setLoading(false));
    const clock = setInterval(() => setTime(new Date()), 1000);
    const refresh = setInterval(
      () => axios.get(`${API}/posts?feed=true`).then((r) => setPosts(r.data)),
      60000,
    );
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const filtered = posts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 26 }}>📡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e" }}>
              Smart Signage
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Campus Information Feed
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#2563eb",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {time.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {time.toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      <div style={s.searchBar}>
        <input
          style={s.search}
          placeholder="🔍  Search announcements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <main style={{ flex: 1, padding: "28px 36px" }}>
        {loading && <p style={s.empty}>Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p style={s.empty}>No announcements found.</p>
        )}
        <div style={s.grid}>
          {filtered.map((p) => (
            <article
              key={p.id}
              onClick={() => navigate(`/post/${p.id}`)}
              style={s.card}
            >
              {p.images?.[0] ? (
                <img
                  src={`${BASE}${p.images[0].image_path}`}
                  alt={p.title}
                  style={s.img}
                />
              ) : (
                <div style={s.imgPlaceholder}>📋</div>
              )}
              <div style={s.cardBody}>
                <h2 style={s.cardTitle}>{p.title}</h2>
                {p.images?.length > 1 && (
                  <div style={s.imgCount}>🖼 {p.images.length} images</div>
                )}
                <div style={s.cardMeta}>
                  🕒{" "}
                  {new Date(p.created_at).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: 14,
          fontSize: 12,
          color: "#9ca3af",
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        Auto-refreshes every 60 seconds · Smart Digital Signage System
      </footer>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f9",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#fff",
    borderBottom: "1.5px solid #e5e7eb",
    padding: "18px 36px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchBar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "14px 36px",
    display: "flex",
    gap: 16,
    alignItems: "center",
  },
  search: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#f9fafb",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  img: { width: "100%", height: 170, objectFit: "cover" },
  imgPlaceholder: {
    height: 170,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 40,
    background: "#f3f4f6",
  },
  cardBody: { padding: "14px 16px" },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 6,
  },
  imgCount: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  empty: { textAlign: "center", color: "#9ca3af", padding: 48, fontSize: 15 },
};
```

---

**`src/pages/public/PostDetail.jsx`**

```jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BASE = API.replace("/api", "");

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/posts/${id}`)
      .then((r) => setPost(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.center}>Loading...</div>;
  if (!post)
    return (
      <div style={s.center}>
        Post not found.{" "}
        <button
          onClick={() => navigate("/feed")}
          style={{
            color: "#2563eb",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ← Back to Feed
        </button>
      </div>
    );

  const images = post.images || [];

  return (
    <div style={s.page}>
      {/* Nav */}
      <div style={s.nav}>
        <button onClick={() => navigate("/feed")} style={s.backBtn}>
          ← Back to Feed
        </button>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          {new Date(post.created_at).toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <div style={s.container}>
        {/* Image Carousel */}
        {images.length > 0 && (
          <div style={s.carousel}>
            <img
              src={`${BASE}${images[imgIdx].image_path}`}
              alt={post.title}
              style={s.carouselImg}
            />
            {images.length > 1 && (
              <div style={s.carouselControls}>
                <button
                  onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                  style={s.arrowBtn}
                  disabled={imgIdx === 0}
                >
                  ‹
                </button>
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {imgIdx + 1} / {images.length}
                </span>
                <button
                  onClick={() =>
                    setImgIdx((i) => Math.min(images.length - 1, i + 1))
                  }
                  style={s.arrowBtn}
                  disabled={imgIdx === images.length - 1}
                >
                  ›
                </button>
              </div>
            )}
            {images.length > 1 && (
              <div style={s.dots}>
                {images.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setImgIdx(i)}
                    style={{
                      ...s.dot,
                      background: i === imgIdx ? "#2563eb" : "#d1d5db",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div style={s.content}>
          <h1 style={s.title}>{post.title}</h1>
          {post.description_markdown ? (
            <div style={s.markdown}>
              <ReactMarkdown>{post.description_markdown}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
              No description provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f4f6f9" },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    fontSize: 16,
    color: "#6b7280",
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 36px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  container: { maxWidth: 820, margin: "36px auto", padding: "0 24px" },
  carousel: {
    background: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    marginBottom: 24,
  },
  carouselImg: {
    width: "100%",
    maxHeight: 460,
    objectFit: "contain",
    background: "#1a1a2e",
    display: "block",
  },
  carouselControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: "12px",
  },
  arrowBtn: {
    background: "#f3f4f6",
    border: "none",
    borderRadius: 8,
    padding: "6px 16px",
    fontSize: 20,
    cursor: "pointer",
    fontWeight: 700,
  },
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 12,
  },
  dot: { width: 8, height: 8, borderRadius: "50%", cursor: "pointer" },
  content: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 32px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  title: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", marginBottom: 20 },
  markdown: { fontSize: 15, lineHeight: 1.7, color: "#374151" },
};
```

---

## STEP 13 — Add Users Route to Backend

You reference `/api/users` in AdminUsers but it doesn't exist yet. Add it:

```bash
touch WebServer/backend/src/routes/users.js
```

```js
// src/routes/users.js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      department_id: true,
      department: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(users);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
```

Add to `src/index.js`:

```js
app.use("/api/users", require("./routes/users"));
```

---

## STEP 14 — Seed Departments

```bash
curl -X POST http://localhost:5000/api/departments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-admin-token>" \
  -d '{"name":"Computer Science"}'

curl -X POST http://localhost:5000/api/departments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-admin-token>" \
  -d '{"name":"Library"}'
```

---

## What You Now Have

| Role    | Routes               | What They See                                            |
| ------- | -------------------- | -------------------------------------------------------- |
| Admin   | `/admin/*`           | Full system — devices, users, all posts, playlists, logs |
| Creator | `/creator/*`         | Own dept posts, designer, signage publish                |
| Viewer  | `/feed`, `/post/:id` | Public feed + full post with markdown + image carousel   |

Every page matches the updated schema — departments, multiple images, markdown, publish modes, Socket.IO signage push, and proper role isolation. Let me know if anything needs adjusting.

---

---

---

# Response

The project has been updated to follow the extensive structural and feature enhancements outlined in SETUP_GUIDE7.md. This update transforms the application into a robust, multi-role system with
dedicated workflows for Administrators and Content Creators.

Key Enhancements:

1. Frontend Architecture Refactor

- State Management: Migrated to Zustand (src/store/useAuthStore.js) for more efficient and scalable authentication state handling.
- Real-time Communication: Integrated Socket.IO-client (src/socket/socket.js) to support live signage push and device status updates.
- Role-Based Access Control (RBAC): Implemented a granular routing system in App.jsx using a RequireRole wrapper to enforce access to Admin and Creator dashboards.
- Global Styling: Created a shared styles.js to ensure visual consistency across all new dashboards and pages.

2. Administrative Suite (/admin/\*)

- System Dashboard: Centralized stats for devices, users, and posts.
- User Management: Full CRUD for system users, including role and department assignments.
- Device & Log Monitoring: Live device status tracking and centralized sensor log viewing.
- Content Moderation: Global view and management of all department posts and playlists.

3. Content Creator Suite (/creator/\*)

- Department Dashboard: Focused overview of content for the creator's specific department.
- Enhanced Post Creation: Supports multiple image uploads and Markdown descriptions for rich content formatting.
- Visual Poster Designer: Integrated the Fabric.js designer as a reusable component (FabricDesigner.jsx), allowing creators to design and export posters directly within the app.
- Signage Publication: Dedicated tool to push department-approved images directly to Raspberry Pi displays via the Anthias API.

4. Enhanced Public Experience (/feed)

- Announcement Grid: A modern, auto-refreshing public feed with a live clock and search functionality.
- Post Details: Supports Markdown rendering and an image carousel for immersive announcement viewing.
