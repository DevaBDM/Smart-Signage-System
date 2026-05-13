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
