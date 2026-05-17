import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import MultiSelect from "../../components/MultiSelect";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [form, setForm] = useState({
    id: "",
    device_name: "",
    ip_address: "",
    location: "",
    group_id: "",
    group_ids: [],
    all_groups: false,
  });
  const [editForm, setEditForm] = useState({
    device_name: "",
    ip_address: "",
    location: "",
    group_id: "",
    group_ids: [],
    all_groups: false,
  });
  const [msg, setMsg] = useState("");
  const [regMsg, setRegMsg] = useState("");
  const [sort, setSort] = useState({ by: "id", order: "asc" });

  const load = () => {
    api
      .get(`/devices?sortBy=${sort.by}&sortOrder=${sort.order}`)
      .then((r) => setDevices(r.data))
      .catch(() => {});
    api
      .get("/groups")
      .then((r) => setGroups(r.data))
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
      group_id: d.group_id ? String(d.group_id) : "",
      group_ids: d.groups?.map((g) => g.group_id) || [],
      all_groups: !!d.all_groups,
    });
    loadSensors(d);
    setMsg("");
  };

  const register = async (e) => {
    e.preventDefault();
    setRegMsg("");
    try {
      await api.post("/devices/register", {
        ...form,
        group_id: form.group_id || null,
        group_ids: form.group_ids,
        all_groups: form.all_groups,
      });
      setRegMsg("✅ Device registered successfully.");
      setForm({
        id: "",
        device_name: "",
        ip_address: "",
        location: "",
        group_id: "",
        group_ids: [],
        all_groups: false,
      });
      load();
    } catch (e) {
      setRegMsg(e.response?.data?.error || "❌ Registration failed.");
    }
  };

  const updateDevice = async (e) => {
    e.preventDefault();
    if (!sel) return;
    setMsg("");
    try {
      const r = await api.put(`/devices/${sel.id}`, {
        ...editForm,
        group_id: editForm.group_id || null,
        group_ids: editForm.group_ids,
        all_groups: editForm.all_groups,
      });
      setSel(r.data);
      setMsg("✅ Device updated.");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Device update failed.");
    }
  };

  const resetToDefaults = async () => {
    if (!sel || !window.confirm("Are you sure you want to reset this device to its agent defaults?")) return;
    setMsg("");
    try {
      await api.put(`/devices/${sel.id}/reset`);
      setMsg("✅ Reset successful. Waiting for next heartbeat.");
      load();
      setSel(null);
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Reset failed.");
    }
  };

  const removeDevice = async () => {
    if (!sel || !window.confirm("CRITICAL: This will wipe all images from the TV and remove the device from the system. Continue?")) return;
    setMsg("");
    try {
      await api.delete(`/devices/${sel.id}`);
      setMsg("✅ Device and signage data erased.");
      load();
      setSel(null);
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Removal failed.");
    }
  };

  const approve = async () => {
    if (!sel) return;
    setMsg("");
    try {
      const r = await api.post(`/devices/${sel.id}/approve`, {
        group_id: editForm.group_id || null,
        group_ids: editForm.group_ids,
        all_groups: editForm.all_groups,
      });
      setSel(r.data);
      setEditForm({
        device_name: r.data.device_name || "",
        ip_address: r.data.ip_address || "",
        location: r.data.location || "",
        group_id: r.data.group_id ? String(r.data.group_id) : "",
        group_ids: r.data.groups?.map((g) => g.group_id) || [],
        all_groups: !!r.data.all_groups,
      });
      setMsg("✅ Device / changes approved.");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Approval failed.");
    }
  };

  const reject = async () => {
    if (!sel || !window.confirm("Reject this registration / these changes?")) return;
    setMsg("");
    try {
      await api.post(`/devices/${sel.id}/reject`);
      setMsg("✅ Rejected.");
      load();
      setSel(null);
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Rejection failed.");
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
              {regMsg && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    background: regMsg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                    color: regMsg.startsWith("✅") ? "#166534" : "#b91c1c",
                  }}
                >
                  {regMsg}
                </div>
              )}
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
              <label style={S.label}>Primary Group</label>
              <select
                style={S.input}
                value={form.group_id}
                onChange={(e) =>
                  setForm({ ...form, group_id: e.target.value })
                }
              >
                <option value="">— None —</option>
                {groups.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.all_groups}
                  onChange={(e) =>
                    setForm({ ...form, all_groups: e.target.checked })
                  }
                />
                Belongs to all groups
              </label>
              {!form.all_groups && (
                <div>
                  <label style={S.label}>Additional Groups</label>
                  <MultiSelect
                    options={groups.filter((g) => String(g.id) !== String(form.group_id))}
                    value={form.group_ids.filter((id) => String(id) !== String(form.group_id))}
                    onChange={(ids) => setForm({ ...form, group_ids: ids })}
                    placeholder="Search departments..."
                  />
                </div>
              )}
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
                    {d.ip_address} ·{" "}
                    {d.all_groups
                      ? "All groups"
                      : d.groups?.length
                        ? d.groups.map((g) => g.group?.name).join(", ")
                        : d.group?.name ?? "—"}
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
                  {!d.is_approved && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 99,
                        marginLeft: 6,
                        background: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fcd34d",
                      }}
                    >
                      NEW
                    </span>
                  )}
                  {(d.pending_name || d.pending_ip || d.pending_location) && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 99,
                        marginLeft: 6,
                        background: "#dbeafe",
                        color: "#1e40af",
                        border: "1px solid #93c5fd",
                      }}
                    >
                      CHANGED
                    </span>
                  )}
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
              <div style={{ marginBottom: 20 }}>
                {/* Approval Banner */}
                {(!sel.is_approved || sel.pending_name || sel.pending_ip || sel.pending_location) && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: !sel.is_approved ? "#fffbeb" : "#eff6ff",
                      border: `1.5px solid ${!sel.is_approved ? "#fcd34d" : "#93c5fd"}`,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: !sel.is_approved ? "#92400e" : "#1e40af" }}>
                      {!sel.is_approved ? "🛡 Registration Pending" : "📡 Remote Identity Changed"}
                    </div>
                    <p style={{ fontSize: 13, margin: "4px 0 10px", color: "#4b5563" }}>
                      {!sel.is_approved 
                        ? "This device has connected but is not yet approved."
                        : "The device is reporting new configuration values."}
                    </p>
                    
                    {sel.pending_name && (
                      <div style={{ fontSize: 12, marginBottom: 2 }}>
                        New Name: <strong>{sel.pending_name}</strong>
                      </div>
                    )}
                    {sel.pending_ip && (
                      <div style={{ fontSize: 12, marginBottom: 2 }}>
                        New IP: <strong>{sel.pending_ip}</strong>
                      </div>
                    )}
                    {sel.pending_location && (
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        New Location: <strong>{sel.pending_location}</strong>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={approve}
                        style={{ ...S.btn, background: "#16a34a", color: "#fff", padding: "6px 12px", border: "none" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={reject}
                        style={{ ...S.btn, background: "#dc2626", color: "#fff", padding: "6px 12px", border: "none" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={updateDevice}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
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
                <label style={S.label}>Primary Group</label>
                <select
                  style={S.input}
                  value={editForm.group_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, group_id: e.target.value })
                  }
                >
                  <option value="">— None —</option>
                  {groups.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                    ))}
                  </select>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={editForm.all_groups}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        all_groups: e.target.checked,
                      })
                    }
                  />
                  Belongs to all groups
                </label>
                {!editForm.all_groups && (
                  <div>
                    <label style={S.label}>Additional Groups</label>
                    <MultiSelect
                      options={groups.filter((g) => String(g.id) !== String(editForm.group_id))}
                      value={editForm.group_ids.filter((id) => String(id) !== String(editForm.group_id))}
                      onChange={(ids) => setEditForm({ ...editForm, group_ids: ids })}
                      placeholder="Search departments..."
                    />
                  </div>
                )}
                <button
                  type="submit"
                  style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
                >
                  Save Device
                </button>
                <button
                  type="button"
                  onClick={resetToDefaults}
                  style={{ ...S.btn, marginTop: 4, background: "#fff", border: "1.5px solid #d1d5db" }}
                >
                  🔄 Reset to Agent Defaults
                </button>
                <button
                  type="button"
                  onClick={removeDevice}
                  style={{ ...S.btn, marginTop: 12, background: "#fee2e2", color: "#b91c1c", border: "none" }}
                >
                  🗑️ Erase & Remove Device
                </button>
              </form>
            </div>
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
