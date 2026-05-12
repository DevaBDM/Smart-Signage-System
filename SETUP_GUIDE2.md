## STEP 1 — Create the New Page Files

```bash
cd WebServer/frontend/src/pages
touch ContentManager.jsx DeviceMonitor.jsx
```

---

## STEP 2 — Add Routes in `App.jsx`

Add the two new imports and routes:

```jsx
import ContentManager from "./pages/ContentManager";
import DeviceMonitor from "./pages/DeviceMonitor";
```

Replace the `<Routes>` block:

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
  <Route path="*" element={<Navigate to="/dashboard" />} />
</Routes>
```

---

## STEP 3 — Content Manager (`src/pages/ContentManager.jsx`)

```jsx
import { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

export default function ContentManager() {
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ title: "", target_device_id: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef();

  const fetchAll = () => {
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please select an image.");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("target_device_id", form.target_device_id);
      fd.append("image", file);
      await api.post("/posts", fd);
      setSuccess("Post published successfully!");
      setForm({ title: "", target_device_id: "" });
      setFile(null);
      setPreview(null);
      fileRef.current.value = "";
      fetchAll();
    } catch {
      setError("Failed to publish. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id) => {
    if (!confirm("Delete this post?")) return;
    await api.delete(`/posts/${id}`);
    fetchAll();
  };

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <h1 style={styles.heading}>Content Manager</h1>
        <p style={styles.sub}>
          Upload signage images and publish them to displays.
        </p>

        <div style={styles.grid}>
          {/* Upload Form */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>📤 Publish New Post</h2>

            {success && <div style={styles.success}>{success}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Title</label>
              <input
                style={styles.input}
                placeholder="Announcement title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label style={styles.label}>Target Display</label>
              <select
                style={styles.input}
                value={form.target_device_id}
                onChange={(e) =>
                  setForm({ ...form, target_device_id: e.target.value })
                }
                required
              >
                <option value="">— Select a device —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.location})
                  </option>
                ))}
              </select>

              <label style={styles.label}>Signage Image</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                style={styles.fileInput}
              />

              {preview && (
                <img
                  src={preview}
                  alt="preview"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    marginTop: 8,
                    maxHeight: 200,
                    objectFit: "cover",
                  }}
                />
              )}

              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? "Publishing..." : "🚀 Publish to Display"}
              </button>
            </form>
          </section>

          {/* Posts List */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>
              🖼 Published Posts ({posts.length})
            </h2>
            <div style={styles.postList}>
              {posts.length === 0 && <p style={styles.empty}>No posts yet.</p>}
              {posts.map((p) => (
                <div key={p.id} style={styles.postItem}>
                  {p.image_url && (
                    <img
                      src={`http://localhost:5000${p.image_url}`}
                      alt={p.title}
                      style={styles.thumb}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={styles.postTitle}>{p.title}</div>
                    <div style={styles.postMeta}>
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deletePost(p.id)}
                    style={styles.deleteBtn}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
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
  sub: { fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 20,
    color: "#1a1a2e",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#f9fafb",
  },
  fileInput: { fontSize: 13, color: "#374151" },
  btn: {
    marginTop: 8,
    padding: "11px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 8,
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 8,
  },
  postList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: 500,
    overflowY: "auto",
  },
  postItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  thumb: {
    width: 60,
    height: 60,
    objectFit: "cover",
    borderRadius: 6,
    flexShrink: 0,
  },
  postTitle: { fontWeight: 600, fontSize: 14, color: "#1a1a2e" },
  postMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  deleteBtn: {
    background: "#fee2e2",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
  },
  empty: { color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 },
};
```

---

## STEP 4 — Device Monitor (`src/pages/DeviceMonitor.jsx`)

```jsx
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

function StatusBadge({ status }) {
  const on = status === "online";
  return (
    <span
      style={{
        padding: "3px 12px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        background: on ? "#dcfce7" : "#fee2e2",
        color: on ? "#16a34a" : "#dc2626",
      }}
    >
      {on ? "● Online" : "● Offline"}
    </span>
  );
}

export default function DeviceMonitor() {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loadingSensors, setLS] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchDevices = () => {
    api
      .get("/devices")
      .then((r) => {
        setDevices(r.data);
        setLastRefresh(new Date());
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const selectDevice = async (device) => {
    setSelected(device);
    setLS(true);
    try {
      const r = await api.get(`/sensors/${device.id}`);
      setSensors(r.data);
    } catch {
      setSensors([]);
    } finally {
      setLS(false);
    }
  };

  const online = devices.filter((d) => d.status === "online").length;
  const offline = devices.length - online;

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.heading}>Device Monitor</h1>
            <p style={styles.sub}>
              Last refreshed: {lastRefresh.toLocaleTimeString()} · auto-updates
              every 15s
            </p>
          </div>
          <button onClick={fetchDevices} style={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>

        {/* Summary */}
        <div style={styles.summaryRow}>
          {[
            { label: "Total Devices", value: devices.length, color: "#2563eb" },
            { label: "Online", value: online, color: "#16a34a" },
            { label: "Offline", value: offline, color: "#dc2626" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                ...styles.summaryCard,
                borderLeft: `4px solid ${s.color}`,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.grid}>
          {/* Device List */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>📟 All Devices</h2>
            {devices.length === 0 && (
              <p style={styles.empty}>No devices have connected yet.</p>
            )}
            <div style={styles.deviceList}>
              {devices.map((d) => (
                <div
                  key={d.id}
                  onClick={() => selectDevice(d)}
                  style={{
                    ...styles.deviceItem,
                    background: selected?.id === d.id ? "#eff6ff" : "#fff",
                    borderColor: selected?.id === d.id ? "#2563eb" : "#e5e7eb",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={styles.deviceName}>
                      {d.name || "Unnamed Device"}
                    </div>
                    <div style={styles.deviceMeta}>
                      {d.ip_address} · {d.location || "No location"}
                    </div>
                    <div style={styles.deviceMeta}>
                      Last seen:{" "}
                      {d.last_seen
                        ? new Date(d.last_seen).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </section>

          {/* Device Detail */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>📊 Sensor Logs</h2>
            {!selected && (
              <p style={styles.empty}>
                ← Select a device to view its sensor logs.
              </p>
            )}
            {selected && (
              <>
                <div style={styles.selectedInfo}>
                  <strong>{selected.name}</strong> · {selected.ip_address}
                  <StatusBadge status={selected.status} />
                </div>
                {loadingSensors && <p style={styles.empty}>Loading...</p>}
                {!loadingSensors && sensors.length === 0 && (
                  <p style={styles.empty}>
                    No sensor logs for this device yet.
                  </p>
                )}
                {!loadingSensors && sensors.length > 0 && (
                  <div style={styles.sensorList}>
                    {sensors.map((s) => (
                      <div key={s.id} style={styles.sensorRow}>
                        <span
                          style={{
                            ...styles.sensorType,
                            background:
                              s.sensor_type === "proximity"
                                ? "#dbeafe"
                                : s.sensor_type === "light"
                                  ? "#fef9c3"
                                  : s.sensor_type === "rain"
                                    ? "#e0f2fe"
                                    : "#f3f4f6",
                            color:
                              s.sensor_type === "proximity"
                                ? "#1d4ed8"
                                : s.sensor_type === "light"
                                  ? "#92400e"
                                  : s.sensor_type === "rain"
                                    ? "#0369a1"
                                    : "#374151",
                          }}
                        >
                          {s.sensor_type}
                        </span>
                        <span style={styles.sensorValue}>{s.value}</span>
                        <span style={styles.sensorTime}>
                          {new Date(s.logged_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e" },
  sub: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  refreshBtn: {
    padding: "9px 18px",
    background: "#fff",
    border: "1.5px solid #d1d5db",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 16,
    marginBottom: 28,
  },
  summaryCard: {
    background: "#fff",
    borderRadius: 10,
    padding: "16px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    color: "#1a1a2e",
  },
  deviceList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 480,
    overflowY: "auto",
  },
  deviceItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px",
    borderRadius: 10,
    border: "1.5px solid",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  deviceName: { fontWeight: 600, fontSize: 14, color: "#1a1a2e" },
  deviceMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  selectedInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    fontSize: 14,
    color: "#374151",
  },
  sensorList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 400,
    overflowY: "auto",
  },
  sensorRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    background: "#f9fafb",
  },
  sensorType: {
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "capitalize",
  },
  sensorValue: { flex: 1, fontSize: 13, color: "#374151", fontWeight: 500 },
  sensorTime: { fontSize: 11, color: "#9ca3af" },
  empty: { color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 },
};
```

---

## STEP 5 — Fix CORS for Image Serving

In `backend/src/index.js`, make sure the uploads folder is accessible from the frontend. Update the static line:

```js
// Replace existing uploads static line with:
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);
```

---

## STEP 6 — Test It

```bash
# Both servers should already be running, if not:
cd WebServer/backend  && npm run dev
cd WebServer/frontend && npm run dev
```

| URL        | What you see                                           |
| ---------- | ------------------------------------------------------ |
| `/content` | Upload form + published posts with thumbnails + delete |
| `/devices` | All devices with status, click any → sensor logs panel |

---

## What You Have Now

| Feature                                | Done |
| -------------------------------------- | ---- |
| Login + JWT auth                       | ✅   |
| Dashboard with stats                   | ✅   |
| Content upload & publish to device     | ✅   |
| Post delete                            | ✅   |
| Device list with online/offline status | ✅   |
| Per-device sensor log viewer           | ✅   |
| Auto-refresh every 15s                 | ✅   |

---

---

---
