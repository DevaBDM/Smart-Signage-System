import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });

  const load = () =>
    api
      .get("/groups")
      .then((r) => setGroups(r.data))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/groups", form);
    setForm({ name: "", description: "" });
    load();
  };

  const update = async (group, changes) => {
    await api.put(`/groups/${group.id}`, changes);
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete group?")) return;
    await api.delete(`/groups/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Groups</h1>
        <p style={S.sub}>Manage organizational groups.</p>

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
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Create
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>All Groups</h2>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Name", "Members", "Displays", "Posts", ""].map((h) => (
                    <th key={h} style={S.th}>
                      {h}
                    </th>
                  ))}
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
                    <td style={S.td}>{g._count.users}</td>
                    <td style={S.td}>
                      {g._count.devices + g._count.device_memberships}
                    </td>
                    <td style={S.td}>{g._count.posts}</td>
                    <td style={S.td}>
                      <button
                        onClick={() => del(g.id)}
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
