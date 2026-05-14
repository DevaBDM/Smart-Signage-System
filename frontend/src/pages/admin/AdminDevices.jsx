import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [depts, setDepts] = useState([]);
  const [sel, setSel] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [form, setForm] = useState({
    id: "",
    device_name: "",
    ip_address: "",
    location: "",
    department_id: "",
  });
  const [editForm, setEditForm] = useState({
    device_name: "",
    ip_address: "",
    location: "",
    department_id: "",
  });
  const [msg, setMsg] = useState("");
  const [sort, setSort] = useState({ by: "id", order: "asc" });

  const load = () => {
    api
      .get(`/devices?sortBy=${sort.by}&sortOrder=${sort.order}`)
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
  }, [sort]);

  const loadSensors = async (device) => {
    if (!device) return;
    setSensorLoading(true);
    try {
      const r = await api.get(`/devices/${device.id}`);
      setSensors(r.data.sensor_logs || []);
    } finally {
      setSensorLoading(false);
    }
  };

  const select = async (d) => {
    setSel(d);
    setEditForm({
      device_name: d.device_name || "",
      ip_address: d.ip_address || "",
      location: d.location || "",
      department_id: d.department_id ? String(d.department_id) : "",
    });
    loadSensors(d);
  };

  const register = async (e) => {
    e.preventDefault();
    await api.post("/devices/register", {
      ...form,
      department_id: form.department_id || null,
    });
    setForm({ id: "", device_name: "", ip_address: "", location: "", department_id: "" });
    load();
  };

  const updateDevice = async (e) => {
    e.preventDefault();
    if (!sel) return;
    setMsg("");
    try {
      const r = await api.put(`/devices/${sel.id}`, {
        ...editForm,
        department_id: editForm.department_id || null,
      });
      setSel(r.data);
      setMsg("✅ Device updated.");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Device update failed.");
    }
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
              <label style={S.label}>Device ID (from config.py)</label>
              <input
                style={S.input}
                type="number"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. 1, 2, 3"
              />
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
              <label style={S.label}>Location</label>
              <input
                style={S.input}
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontWeight: 700 }}>All Devices</h2>
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  style={{ ...S.input, width: "auto", padding: "4px 8px" }}
                  value={sort.by}
                  onChange={(e) => setSort({ ...sort, by: e.target.value })}
                >
                  <option value="id">Sort by ID</option>
                  <option value="last_seen">Sort by Active</option>
                  <option value="device_name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                </select>
                <button
                  style={{ ...S.btn, padding: "4px 8px" }}
                  onClick={() =>
                    setSort({
                      ...sort,
                      order: sort.order === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  {sort.order === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>
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
                  {d.location && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {d.location}
                    </div>
                  )}
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
              {sel ? `Settings — ${sel.device_name}` : "Device Settings"}
            </h2>
            {!sel && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 24 }}>
                Select a device
              </p>
            )}
            {sel && (
              <form
                onSubmit={updateDevice}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {msg && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                      color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
                    }}
                  >
                    {msg}
                  </div>
                )}
                <label style={S.label}>Device Name</label>
                <input
                  style={S.input}
                  value={editForm.device_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, device_name: e.target.value })
                  }
                  required
                />
                <label style={S.label}>IP Address</label>
                <input
                  style={S.input}
                  value={editForm.ip_address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, ip_address: e.target.value })
                  }
                  required
                />
                <label style={S.label}>Location</label>
                <input
                  style={S.input}
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm({ ...editForm, location: e.target.value })
                  }
                />
                <label style={S.label}>Department</label>
                <select
                  style={S.input}
                  value={editForm.department_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, department_id: e.target.value })
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
                  Save Device
                </button>
              </form>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h3 style={{ fontWeight: 700 }}>Sensor Logs</h3>
              <button
                onClick={() => loadSensors(sel)}
                disabled={!sel || sensorLoading}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                {sensorLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
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
