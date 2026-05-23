import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import SignageStateSelect from "../../components/SignageStateSelect";
import * as groupsApi from "../../api/groups";
import {
  SIGNAGE_STATE_LABELS,
  SIGNAGE_STATES,
  groupStateVisibilityHint,
} from "../../constants/signageStates";
import * as S from "../../styles";

const groupStateOptions = SIGNAGE_STATES.map((value) => ({
  value,
  label: SIGNAGE_STATE_LABELS[value],
}));

export default function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    signage_state: "NORMAL",
  });

  const load = () =>
    groupsApi.listGroups()
      .then(setGroups)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    await groupsApi.createGroup(form);
    setForm({ name: "", description: "", signage_state: "NORMAL" });
    load();
  };

  const update = async (group, changes) => {
    await groupsApi.updateGroup(group.id, changes);
    load();
  };

  const setEmergency = async (group) => {
    if (!window.confirm(`Set group "${group.name}" to EMERGENCY mode?\n\nThis will interrupt normal signage playback.`)) return;
    await groupsApi.updateGroup(group.id, { signage_state: "EMERGENCY" });
    load();
  };

  const clearEmergency = async (group) => {
    if (!window.confirm(`Clear emergency mode for "${group.name}" and return to NORMAL?`)) return;
    await groupsApi.updateGroup(group.id, { signage_state: "NORMAL" });
    load();
  };

  const clearAllEmergencies = async () => {
    const emergencyGroups = groups.filter((g) => g.signage_state === "EMERGENCY");
    if (emergencyGroups.length === 0) {
      alert("No groups are currently in emergency mode.");
      return;
    }
    if (!window.confirm(`Clear emergency mode for ${emergencyGroups.length} group(s) and return all to NORMAL?`)) return;
    for (const g of emergencyGroups) {
      await groupsApi.updateGroup(g.id, { signage_state: "NORMAL" });
    }
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete group?")) return;
    await groupsApi.deleteGroup(id);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Groups</h1>
        <p style={S.sub}>
          Manage organizational groups and the active signage display mode for each
          group.
        </p>

        <div
          style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Add Group</h2>
            <form
              onSubmit={create}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Name</label>
              <input
                style={S.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <label style={S.label}>Description</label>
              <textarea
                style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <SignageStateSelect
                label="Display mode (what plays on signage)"
                value={form.signage_state}
                options={groupStateOptions}
                hint={groupStateVisibilityHint(form.signage_state)}
                onChange={(signage_state) => setForm({ ...form, signage_state })}
              />
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Create
              </button>
            </form>
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700 }}>All Groups</h2>
              <button
                onClick={clearAllEmergencies}
                style={{
                  ...S.btn,
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
              >
                ✅ Clear All Emergencies
              </button>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Name", "Display mode", "Members", "Displays", "Posts", "Actions"].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td style={S.td}>
                      <strong>{g.name}</strong>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {g.description || "No description"}
                      </div>
                    </td>
                    <td style={S.td}>
                      <select
                        style={{ ...S.input, minWidth: 190 }}
                        value={g.signage_state || "NORMAL"}
                        onChange={(e) =>
                          update(g, { signage_state: e.target.value })
                        }
                      >
                        {groupStateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        {groupStateVisibilityHint(g.signage_state || "NORMAL")}
                      </div>
                    </td>
                    <td style={S.td}>{g._count.users}</td>
                    <td style={S.td}>
                      {g._count.devices + g._count.device_memberships}
                    </td>
                    <td style={S.td}>{g._count.posts}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.signage_state !== "EMERGENCY" ? (
                          <button
                            onClick={() => setEmergency(g)}
                            style={{
                              ...S.btn,
                              background: "#dc2626",
                              color: "#fff",
                              border: "none",
                              padding: "4px 10px",
                              fontSize: 12,
                            }}
                          >
                            🚨 Emergency
                          </button>
                        ) : (
                          <button
                            onClick={() => clearEmergency(g)}
                            style={{
                              ...S.btn,
                              background: "#16a34a",
                              color: "#fff",
                              border: "none",
                              padding: "4px 10px",
                              fontSize: 12,
                            }}
                          >
                            ✅ Clear
                          </button>
                        )}
                        <button
                          onClick={() => del(g.id)}
                          style={{
                            ...S.btn,
                            background: "#fee2e2",
                            color: "#b91c1c",
                            padding: "4px 10px",
                            fontSize: 12,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
