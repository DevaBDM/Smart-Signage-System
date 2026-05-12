Let's build the Login Page and Admin Dashboard with a clean light theme. Here's the full step-by-step:

---

## STEP 1 — Install UI Dependencies

```bash
cd WebServer/frontend
npm install react-router-dom axios
```

---

## STEP 2 — Folder Structure

Create this inside `frontend/src/`:

```
src/
├── api/
│   └── axios.js          ← configured axios instance
├── context/
│   └── AuthContext.jsx   ← global auth state
├── pages/
│   ├── Login.jsx
│   └── Dashboard.jsx
├── components/
│   └── Sidebar.jsx
├── App.jsx
├── main.jsx
└── index.css
```

```bash
mkdir -p src/api src/context src/pages src/components
touch src/api/axios.js src/context/AuthContext.jsx src/pages/Login.jsx src/pages/Dashboard.jsx src/components/Sidebar.jsx
```

---

## STEP 3 — Global Styles (`src/index.css`)

Replace the entire file with:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Segoe UI", sans-serif;
  background: #f4f6f9;
  color: #1a1a2e;
  min-height: 100vh;
}

a {
  text-decoration: none;
  color: inherit;
}
button {
  cursor: pointer;
}
```

---

## STEP 4 — Axios Instance (`src/api/axios.js`)

```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

---

## STEP 5 — Auth Context (`src/context/AuthContext.jsx`)

```jsx
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    return token ? { token, role } : null;
  });
  const navigate = useNavigate();

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("role", res.data.role);
    setUser({ token: res.data.token, role: res.data.role });
    navigate("/dashboard");
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## STEP 6 — Login Page (`src/pages/Login.jsx`)

```jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Title */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>📡</div>
          <h1 style={styles.title}>Smart Signage</h1>
          <p style={styles.subtitle}>Admin Portal</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handle}
            required
            style={styles.input}
            placeholder="Enter username"
          />

          <label style={styles.label}>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handle}
            required
            style={styles.input}
            placeholder="Enter password"
          />

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #e8f0fe 0%, #f4f6f9 100%)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
  },
  logoArea: { textAlign: "center", marginBottom: 32 },
  logoIcon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a2e" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    outline: "none",
    transition: "border 0.2s",
    background: "#f9fafb",
  },
  btn: {
    marginTop: 8,
    padding: "12px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    transition: "background 0.2s",
  },
};
```

---

## STEP 7 — Sidebar (`src/components/Sidebar.jsx`)

```jsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "🏠 Dashboard" },
  { to: "/content", label: "🖼 Content Manager" },
  { to: "/devices", label: "📟 Devices" },
  { to: "/sensors", label: "📊 Sensor Logs" },
  { to: "/feed", label: "📰 Public Feed" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <span style={styles.brandIcon}>📡</span>
        <span style={styles.brandText}>Smart Signage</span>
      </div>

      <nav style={styles.nav}>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.link,
              background: isActive ? "#dbeafe" : "transparent",
              color: isActive ? "#1d4ed8" : "#374151",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.roleTag}>{user?.role?.replace("_", " ")}</div>
        <button onClick={logout} style={styles.logoutBtn}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 240,
    minHeight: "100vh",
    background: "#fff",
    borderRight: "1.5px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    position: "fixed",
    top: 0,
    left: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  brandIcon: { fontSize: 24 },
  brandText: { fontWeight: 700, fontSize: 16, color: "#1a1a2e" },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "16px 12px",
    flex: 1,
  },
  link: {
    display: "block",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 14,
    transition: "all 0.15s",
  },
  footer: { padding: "16px 20px", borderTop: "1px solid #e5e7eb" },
  roleTag: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "capitalize",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
};
```

---

## STEP 8 — Dashboard Page (`src/pages/Dashboard.jsx`)

```jsx
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={styles.cardIcon}>{icon}</div>
      <div style={styles.cardValue}>{value ?? "—"}</div>
      <div style={styles.cardLabel}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
  }, []);

  const online = devices.filter((d) => d.status === "online").length;

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.heading}>Dashboard</h1>
            <p style={styles.subheading}>
              Welcome back, <strong>{user?.role}</strong>
            </p>
          </div>
        </header>

        {/* Stat Cards */}
        <section style={styles.statsRow}>
          <StatCard
            icon="📟"
            label="Total Devices"
            value={devices.length}
            color="#2563eb"
          />
          <StatCard
            icon="🟢"
            label="Online Now"
            value={online}
            color="#16a34a"
          />
          <StatCard
            icon="🔴"
            label="Offline"
            value={devices.length - online}
            color="#dc2626"
          />
          <StatCard
            icon="🖼"
            label="Published Posts"
            value={posts.length}
            color="#7c3aed"
          />
        </section>

        {/* Recent Devices */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent Devices</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Name", "IP Address", "Location", "Status", "Last Seen"].map(
                  (h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.empty}>
                    No devices registered yet
                  </td>
                </tr>
              )}
              {devices.map((d) => (
                <tr key={d.id} style={styles.tr}>
                  <td style={styles.td}>{d.name}</td>
                  <td style={styles.td}>{d.ip_address}</td>
                  <td style={styles.td}>{d.location}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background:
                          d.status === "online" ? "#dcfce7" : "#fee2e2",
                        color: d.status === "online" ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Recent Posts */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent Posts</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Title", "Created At"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && (
                <tr>
                  <td colSpan={2} style={styles.empty}>
                    No posts yet
                  </td>
                </tr>
              )}
              {posts.slice(0, 5).map((p) => (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>{p.title}</td>
                  <td style={styles.td}>
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: {
    marginLeft: 240,
    flex: 1,
    padding: "32px 36px",
    background: "#f4f6f9",
    minHeight: "100vh",
  },
  header: { marginBottom: 32 },
  heading: { fontSize: 28, fontWeight: 700, color: "#1a1a2e" },
  subheading: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 20,
    marginBottom: 36,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px 20px",
    textAlign: "center",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardValue: { fontSize: 32, fontWeight: 700, color: "#1a1a2e" },
  cardLabel: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  section: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 28,
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    color: "#1a1a2e",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
    padding: "8px 12px",
    borderBottom: "2px solid #e5e7eb",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px", fontSize: 14, color: "#374151" },
  badge: {
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
  },
  empty: { textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 14 },
};
```

---

## STEP 9 — Wire Everything in `App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" />} />
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

## STEP 10 — Create First Admin User

Since there's no UI for registration yet, do it via curl:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"admin"}'
```

---

## STEP 11 — Run Both Servers

Terminal 1 — backend:

```bash
cd WebServer/backend && npm run dev
```

Terminal 2 — frontend:

```bash
cd WebServer/frontend && npm run dev
```

Open `http://localhost:5173` → you'll see the login page → sign in with `admin / admin123` → lands on the dashboard.

---

## What You Have Now

| Page         | What It Does                                                      |
| ------------ | ----------------------------------------------------------------- |
| `/login`     | JWT login, redirects to dashboard, shows error on bad credentials |
| `/dashboard` | Live device count, online/offline stats, recent posts table       |
| Sidebar      | Navigation + role display + logout                                |
| Auth flow    | Token stored, auto-attached to all API calls, protected routes    |

---

---

---
