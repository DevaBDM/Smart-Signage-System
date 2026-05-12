## STEP 1 — Create the New Page Files

```bash
cd WebServer/frontend/src/pages
touch SensorLogs.jsx PublicFeed.jsx
```

---

## STEP 2 — Add Routes in `App.jsx`

Add imports:

```jsx
import SensorLogs from "./pages/SensorLogs";
import PublicFeed from "./pages/PublicFeed";
```

Update the `<Routes>` block:

```jsx
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
  <Route
    path="/content"
    element={
      <ProtectedRoute>
        <ContentManager />
      </ProtectedRoute>
    }
  />
  <Route
    path="/devices"
    element={
      <ProtectedRoute>
        <DeviceMonitor />
      </ProtectedRoute>
    }
  />
  <Route
    path="/sensors"
    element={
      <ProtectedRoute>
        <SensorLogs />
      </ProtectedRoute>
    }
  />
  <Route path="/feed" element={<PublicFeed />} /> {/* ← No login required */}
  <Route path="*" element={<Navigate to="/dashboard" />} />
</Routes>
```

---

## STEP 3 — Sensor Logs Page (`src/pages/SensorLogs.jsx`)

```jsx
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

const SENSOR_COLORS = {
  proximity: { bg: "#dbeafe", color: "#1d4ed8" },
  light: { bg: "#fef9c3", color: "#92400e" },
  rain: { bg: "#e0f2fe", color: "#0369a1" },
};

export default function SensorLogs() {
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filterDevice, setFilterDevice] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filterDevice) return;
    setLoading(true);
    api
      .get(`/sensors/${filterDevice}`)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [filterDevice]);

  const filtered = logs.filter((l) =>
    filterType ? l.sensor_type === filterType : true,
  );

  const sensorTypes = [...new Set(logs.map((l) => l.sensor_type))];

  // Simple stats from current logs
  const stats = sensorTypes.map((type) => {
    const entries = logs.filter((l) => l.sensor_type === type);
    return { type, count: entries.length, latest: entries[0]?.value };
  });

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <h1 style={styles.heading}>Sensor Logs</h1>
        <p style={styles.sub}>
          View and filter all sensor data reported by devices.
        </p>

        {/* Filters */}
        <div style={styles.filterRow}>
          <select
            style={styles.select}
            value={filterDevice}
            onChange={(e) => {
              setFilterDevice(e.target.value);
              setFilterType("");
            }}
          >
            <option value="">— Select a device —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.location})
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            disabled={!filterDevice}
          >
            <option value="">All Sensor Types</option>
            {sensorTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={styles.countBadge}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Stats Cards */}
        {stats.length > 0 && (
          <div style={styles.statsRow}>
            {stats.map((s) => {
              const c = SENSOR_COLORS[s.type] || {
                bg: "#f3f4f6",
                color: "#374151",
              };
              return (
                <div
                  key={s.type}
                  style={{ ...styles.statCard, background: c.bg }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.color,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {s.type}
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: c.color,
                      margin: "6px 0",
                    }}
                  >
                    {s.count}
                  </div>
                  <div style={{ fontSize: 12, color: c.color, opacity: 0.8 }}>
                    Latest: <strong>{s.latest ?? "—"}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Logs Table */}
        <section style={styles.card}>
          {!filterDevice && (
            <p style={styles.empty}>
              ← Select a device above to load its sensor logs.
            </p>
          )}
          {filterDevice && loading && (
            <p style={styles.empty}>Loading logs...</p>
          )}
          {filterDevice && !loading && filtered.length === 0 && (
            <p style={styles.empty}>No logs found for this selection.</p>
          )}
          {filterDevice && !loading && filtered.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  {["#", "Sensor Type", "Value", "Logged At"].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => {
                  const c = SENSOR_COLORS[l.sensor_type] || {
                    bg: "#f3f4f6",
                    color: "#374151",
                  };
                  return (
                    <tr key={l.id} style={styles.tr}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.typeBadge,
                            background: c.bg,
                            color: c.color,
                          }}
                        >
                          {l.sensor_type}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        {l.value}
                      </td>
                      <td style={styles.td}>
                        {new Date(l.logged_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
  },
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e" },
  sub: { fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 24 },
  filterRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  select: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
    minWidth: 200,
  },
  countBadge: {
    marginLeft: "auto",
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    padding: "8px 16px",
  },
  statsRow: { display: "flex", gap: 16, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 10, padding: "16px 20px" },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
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
  typeBadge: {
    padding: "3px 12px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  empty: { color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 32 },
};
```

---

## STEP 4 — Public Feed Page (`src/pages/PublicFeed.jsx`)

This page requires **no login** — it's for students and staff on the LAN.

```jsx
import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BASE = API.replace("/api", "");

export default function PublicFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    axios
      .get(`${API}/posts`)
      .then((r) => setPosts(r.data))
      .finally(() => setLoading(false));

    // Live clock
    const clock = setInterval(() => setTime(new Date()), 1000);
    // Auto-refresh posts every 60s
    const refresh = setInterval(() => {
      axios.get(`${API}/posts`).then((r) => setPosts(r.data));
    }, 60000);

    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const filtered = posts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 28 }}>📡</span>
          <div>
            <div style={styles.brandName}>Smart Signage</div>
            <div style={styles.brandSub}>Campus Information Feed</div>
          </div>
        </div>
        <div style={styles.clock}>
          <div style={styles.clockTime}>
            {time.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div style={styles.clockDate}>
            {time.toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      {/* Search */}
      <div style={styles.searchRow}>
        <input
          style={styles.search}
          placeholder="🔍  Search announcements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={styles.postCount}>
          {filtered.length} announcement{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Posts Grid */}
      <main style={styles.main}>
        {loading && <p style={styles.empty}>Loading announcements...</p>}

        {!loading && filtered.length === 0 && (
          <p style={styles.empty}>No announcements found.</p>
        )}

        <div style={styles.grid}>
          {filtered.map((p) => (
            <article key={p.id} style={styles.card}>
              {p.image_url ? (
                <img
                  src={`${BASE}${p.image_url}`}
                  alt={p.title}
                  style={styles.cardImg}
                />
              ) : (
                <div style={styles.cardImgPlaceholder}>📋</div>
              )}
              <div style={styles.cardBody}>
                <h2 style={styles.cardTitle}>{p.title}</h2>
                <div style={styles.cardMeta}>
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

      <footer style={styles.footer}>
        Auto-refreshes every 60 seconds · Smart Digital Signage System
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f9",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#fff",
    borderBottom: "1.5px solid #e5e7eb",
    padding: "20px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { display: "flex", gap: 14, alignItems: "center" },
  brandName: { fontSize: 20, fontWeight: 700, color: "#1a1a2e" },
  brandSub: { fontSize: 13, color: "#6b7280" },
  clock: { textAlign: "right" },
  clockTime: {
    fontSize: 28,
    fontWeight: 700,
    color: "#2563eb",
    fontVariantNumeric: "tabular-nums",
  },
  clockDate: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  searchRow: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    padding: "20px 40px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  search: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    background: "#f9fafb",
  },
  postCount: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    whiteSpace: "nowrap",
  },
  main: { flex: 1, padding: "32px 40px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
    transition: "transform 0.15s",
    cursor: "default",
  },
  cardImg: { width: "100%", height: 180, objectFit: "cover" },
  cardImgPlaceholder: {
    height: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 48,
    background: "#f3f4f6",
  },
  cardBody: { padding: "16px 18px" },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 8,
  },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  footer: {
    textAlign: "center",
    padding: "16px",
    fontSize: 12,
    color: "#9ca3af",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
  },
  empty: { textAlign: "center", color: "#9ca3af", fontSize: 15, padding: 48 },
};
```

---

## STEP 5 — Share the Public Feed URL on LAN

Students and staff don't need an account. They just open a browser and go to:

```
http://<your-server-ip>:5173/feed
```

Find your server IP:

```bash
ip addr show eth0 | grep inet
```

Pin that URL on notice boards, share it via email, or set it as the default home page on lab computers.

---

## What You Have Now — Full Frontend Complete

| Page            | URL          | Auth Required |
| --------------- | ------------ | ------------- |
| Login           | `/login`     | No            |
| Dashboard       | `/dashboard` | Yes           |
| Content Manager | `/content`   | Yes           |
| Device Monitor  | `/devices`   | Yes           |
| Sensor Logs     | `/sensors`   | Yes           |
| Public Feed     | `/feed`      | **No**        |

---

## What's Left — Raspberry Pi Side

Now that the full frontend and backend are done, the last piece is writing the **Python scripts on the Raspberry Pi** that:

1. Send a **heartbeat** to register the device
2. Forward **sensor data** from Arduino to the server
3. Pull **published content** and push it to Anthias

Say the word and I'll give you the full Pi-side Python scripts.
