import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ name: "", group_id: "" });

  const load = () => {
    api
      .get("/playlists")
      .then((r) => setPlaylists(r.data))
      .catch(() => {});
    api
      .get("/groups")
      .then((r) => setGroups(r.data))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/playlists", form);
    setForm({ name: "", group_id: "" });
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete playlist?")) return;
    await api.delete(`/playlists/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Playlists</h1>
        <p style={S.sub}>Manage signage playlists per Group.</p>
        <div
          style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>New Playlist</h2>
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
              <label style={S.label}>Group</label>
              <select
                style={S.input}
                value={form.group_id}
                onChange={(e) =>
                  setForm({ ...form, group_id: e.target.value })
                }
                required
              >
                <option value="">— Select —</option>
                {groups.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Create
              </button>
            </form>
          </div>
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>All Playlists</h2>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{pl.name}</strong>
                    <span
                      style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}
                    >
                      {pl.group?.name}
                    </span>
                    <span
                      style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}
                    >
                      {pl.items?.length ?? 0} items
                    </span>
                  </div>
                  <button
                    onClick={() => del(pl.id)}
                    style={{
                      ...S.btn,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "4px 10px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
