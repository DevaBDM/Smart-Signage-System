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
