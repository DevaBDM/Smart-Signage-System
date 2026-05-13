import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "creator",
    department_id: "",
  });
  const [error, setError] = useState("");

  const load = () => {
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
    api
      .get("/departments")
      .then((r) => setDepts(r.data))
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
        department_id: form.department_id || null,
      });
      setForm({
        username: "",
        password: "",
        role: "creator",
        department_id: "",
      });
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed");
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
                  {["Username", "Role", "Department", "Created", ""].map(
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
                    <td style={S.td}>{u.role}</td>
                    <td style={S.td}>{u.department?.name ?? "—"}</td>
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
