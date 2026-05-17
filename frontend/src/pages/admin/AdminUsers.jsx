import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import SignageStateSelect from "../../components/SignageStateSelect";
import MultiSelect from "../../components/MultiSelect";
import api from "../../api/axios";
import { SIGNAGE_STATE_LABELS, SIGNAGE_STATES } from "../../constants/signageStates";
import * as S from "../../styles";

const maxStateOptions = SIGNAGE_STATES.map((value) => ({
  value,
  label: SIGNAGE_STATE_LABELS[value],
}));

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "creator",
    group_id: "",
    auto_approve: true,
    can_manage_other_posts: false,
    control_lock_minutes: 120,
    max_signage_state: "NORMAL",
    managed_group_ids: [],
  });
  const [error, setError] = useState("");

  const load = () => {
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
    api
      .get("/groups")
      .then((r) => setGroups(r.data))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/register", {
        ...form,
        group_id: form.group_id || null,
      });
      setForm({
        username: "",
        password: "",
        role: "creator",
        group_id: "",
        auto_approve: true,
        can_manage_other_posts: false,
        control_lock_minutes: 120,
        max_signage_state: "NORMAL",
        managed_group_ids: [],
      });
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed");
    }
  };

  const creatorPriorities = users
    .filter((u) => u.role === "creator")
    .map((u) => u.creator_priority ?? 0);
  const minCreatorPriority = creatorPriorities.length
    ? Math.min(...creatorPriorities)
    : 1;
  const maxCreatorPriority = creatorPriorities.length
    ? Math.max(...creatorPriorities)
    : 1;

  const updateUser = async (id, changes) => {
    setError("");
    try {
      await api.put(`/users/${id}`, changes);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to update user");
    }
  };

  const del = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/users/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>User Management</h1>
        <p style={S.sub}>Create and manage admin and creator accounts.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Add User</h2>
            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Username</label>
              <input
                style={S.input}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
              <label style={S.label}>Password</label>
              <input
                style={S.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <label style={S.label}>Role</label>
              <select
                style={S.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="creator">Creator</option>
                <option value="admin">Admin</option>
              </select>
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
              <label style={S.label}>Additional Groups (can post to)</label>
              <MultiSelect
                options={groups.filter((g) => String(g.id) !== String(form.group_id))}
                value={form.managed_group_ids.filter((id) => String(id) !== String(form.group_id))}
                onChange={(ids) => setForm({ ...form, managed_group_ids: ids })}
                placeholder="Search departments..."
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  checked={form.auto_approve} 
                  onChange={(e) => setForm({ ...form, auto_approve: e.target.checked })}
                />
                Auto-approve Posts
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.can_manage_other_posts}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      can_manage_other_posts: e.target.checked,
                    })
                  }
                />
                Can edit/delete other creators' posts
              </label>
              <SignageStateSelect
                label="Max signage level (creator can post up to)"
                value={form.max_signage_state}
                options={maxStateOptions}
                onChange={(max_signage_state) =>
                  setForm({ ...form, max_signage_state })
                }
              />
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0" }}>
                Creators get the next available priority automatically; you can
                reorder them in the table on the right.
              </p>
              <label style={S.label}>Dead-block Minutes</label>
              <input
                style={S.input}
                type="number"
                min={1}
                value={form.control_lock_minutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    control_lock_minutes: Number(e.target.value),
                  })
                }
              />
              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#2563eb",
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                Create User
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              All Users ({users.length})
            </h2>
            <table style={S.table}>
              <thead>
                <tr>
                  {[
                    "Username",
                    "Role",
                    "Group",
                    "Managed Groups",
                    "Auto-Approve",
                    "Other Posts",
                    "Priority",
                    "Signage level",
                    "Block",
                    "Created",
                    "",
                  ].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <strong>{u.username}</strong>
                    </td>
                    <td style={S.td}>
                      <select
                        style={{ ...S.input, minWidth: 110 }}
                        value={u.role}
                        onChange={(e) =>
                          updateUser(u.id, {
                            role: e.target.value,
                            group_id: u.group_id,
                          })
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="creator">Creator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <select
                        style={{ ...S.input, minWidth: 150 }}
                        value={u.group_id ?? ""}
                        onChange={(e) =>
                          updateUser(u.id, {
                            role: u.role,
                            group_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">— None —</option>
                        {groups.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={S.td}>
                      <MultiSelect
                        options={groups.filter((g) => String(g.id) !== String(u.group_id))}
                        value={(u.managed_groups || [])
                          .map((mg) => mg.group_id)
                          .filter((id) => String(id) !== String(u.group_id))}
                        onChange={(ids) => updateUser(u.id, { managed_group_ids: ids })}
                        placeholder="Search..."
                      />
                    </td>
                    <td style={S.td}>
                      <input 
                        type="checkbox" 
                        checked={u.auto_approve} 
                        onChange={(e) => updateUser(u.id, { auto_approve: e.target.checked })}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="checkbox"
                        checked={!!u.can_manage_other_posts}
                        onChange={(e) =>
                          updateUser(u.id, {
                            can_manage_other_posts: e.target.checked,
                          })
                        }
                      />
                    </td>
                    <td style={S.td}>
                      {u.role === "creator" ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button
                            type="button"
                            title="Move up (swap with higher-priority creator)"
                            disabled={(u.creator_priority ?? 1) <= minCreatorPriority}
                            onClick={() =>
                              updateUser(u.id, {
                                creator_priority: (u.creator_priority ?? 1) - 1,
                              })
                            }
                            style={prioBtn}
                          >
                            ↑
                          </button>
                          <input
                            style={{ ...S.input, width: 64, textAlign: "center" }}
                            type="number"
                            min={1}
                            value={u.creator_priority ?? 1}
                            onChange={(e) =>
                              updateUser(u.id, {
                                creator_priority: Number(e.target.value),
                              })
                            }
                          />
                          <button
                            type="button"
                            title="Move down (swap with lower-priority creator)"
                            disabled={(u.creator_priority ?? 1) >= maxCreatorPriority}
                            onClick={() =>
                              updateUser(u.id, {
                                creator_priority: (u.creator_priority ?? 1) + 1,
                              })
                            }
                            style={prioBtn}
                          >
                            ↓
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={S.td}>
                      <select
                        style={{ ...S.input, minWidth: 150 }}
                        value={u.max_signage_state || "NORMAL"}
                        onChange={(e) =>
                          updateUser(u.id, { max_signage_state: e.target.value })
                        }
                      >
                        {maxStateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={S.td}>
                      <input
                        style={{ ...S.input, width: 96 }}
                        type="number"
                        min={1}
                        value={u.control_lock_minutes ?? 120}
                        onChange={(e) =>
                          updateUser(u.id, {
                            control_lock_minutes: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td style={S.td}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => del(u.id)}
                        style={{
                          ...S.btn,
                          background: "#fee2e2",
                          color: "#b91c1c",
                          padding: "4px 10px",
                        }}
                      >
                        Delete
                      </button>
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

const prioBtn = {
  width: 26,
  height: 26,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#f9fafb",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  padding: 0,
};
