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
