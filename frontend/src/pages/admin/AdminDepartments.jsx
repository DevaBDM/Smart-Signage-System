import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    api
      .get("/departments")
      .then((r) => setDepartments(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      await api.post("/departments", { name });
      setName("");
      load();
    } catch (e) {
      setMessage(e.response?.data?.error || "Failed to create department");
    }
  };

  const del = async (department) => {
    if (!confirm(`Delete department "${department.name}"?`)) return;
    setMessage("");
    try {
      await api.delete(`/departments/${department.id}`);
      load();
    } catch (e) {
      setMessage(e.response?.data?.error || "Failed to delete department");
    }
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Department Management</h1>
        <p style={S.sub}>Create departments and review where they are used.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              Add Department
            </h2>
            {message && (
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
                {message}
              </div>
            )}
            <form
              onSubmit={create}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Department Name</label>
              <input
                style={S.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button
                type="submit"
                style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
              >
                Create Department
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              All Departments ({departments.length})
            </h2>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Name", "Users", "Devices", "Posts", "Playlists", ""].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        ...S.td,
                        textAlign: "center",
                        color: "#9ca3af",
                      }}
                    >
                      No departments yet
                    </td>
                  </tr>
                )}
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td style={S.td}>
                      <strong>{d.name}</strong>
                    </td>
                    <td style={S.td}>{d._count?.users ?? 0}</td>
                    <td style={S.td}>{d._count?.devices ?? 0}</td>
                    <td style={S.td}>{d._count?.posts ?? 0}</td>
                    <td style={S.td}>{d._count?.playlists ?? 0}</td>
                    <td style={S.td}>
                      <button
                        onClick={() => del(d)}
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
