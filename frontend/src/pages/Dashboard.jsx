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
