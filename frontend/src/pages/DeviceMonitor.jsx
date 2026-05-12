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
