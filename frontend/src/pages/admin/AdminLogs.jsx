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
