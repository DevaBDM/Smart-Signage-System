import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import MultiSelect from "../../components/MultiSelect";
import DeviceRegisterForm from "../../components/DeviceRegisterForm";
import DeviceList from "../../components/DeviceList";
import * as devicesApi from "../../api/devices";
import * as groupsApi from "../../api/groups";
import * as S from "../../styles";
import { messageStyle } from "../../tokens";

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
    devicesApi.listDevices(sort.by, sort.order)
      .then(setDevices)
      .catch(() => {});
    groupsApi.listGroups()
      .then(setGroups)
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
      const data = await devicesApi.getDevice(device.id);
      setSensors(data.sensor_logs || []);
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
      await devicesApi.registerDevice({
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
      const r = await devicesApi.updateDevice(sel.id, {
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
      await devicesApi.resetDevice(sel.id);
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
      await devicesApi.removeDevice(sel.id);
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
      const r = await devicesApi.approveDevice(sel.id, {
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
      await devicesApi.rejectDevice(sel.id);
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
          <DeviceRegisterForm
            form={form}
            onChange={setForm}
            onSubmit={register}
            groups={groups}
            regMsg={regMsg}
          />

          <DeviceList
            devices={devices}
            selectedId={sel?.id}
            onSelect={select}
            sort={sort}
            onSortChange={setSort}
          />

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
                  <div style={messageStyle(msg)}>
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
