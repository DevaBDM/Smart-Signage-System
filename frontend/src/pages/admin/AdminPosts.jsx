import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);

  const load = () =>
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const del = async (id) => {
    if (!confirm("Delete post?")) return;
    const deleteSignage = confirm("Also remove this post from signage displays?");
    await api.delete(`/posts/${id}`, {
      params: { delete_signage: deleteSignage },
    });
    load();
  };

  const toggle = async (post, field) => {
    await api.put(`/posts/${post.id}`, { ...post, [field]: !post[field] });
    load();
  };

  return (
    <div style={S.layout}>
      <AdminSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>All Posts</h1>
        <p style={S.sub}>View and manage posts across all departments.</p>
        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                {[
                  "Image",
                  "Title",
                  "Department",
                  "Feed",
                  "Signage",
                  "Status",
                  "Created",
                  "",
                ].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ ...S.td, textAlign: "center", color: "#9ca3af" }}
                  >
                    No posts yet
                  </td>
                </tr>
              )}
              {posts.map((p) => (
                <tr key={p.id}>
                  <td style={S.td}>
                    {p.images?.[0] ? (
                      <img
                        src={`${BASE}${p.images[0].image_path}`}
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          background: "#f3f4f6",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        📋
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <strong>{p.title}</strong>
                  </td>
                  <td style={S.td}>{p.department?.name ?? "—"}</td>
                  <td style={S.td}>
                    <span
                      style={{ cursor: "pointer", fontSize: 18 }}
                      onClick={() => toggle(p, "publish_to_feed")}
                    >
                      {p.publish_to_feed ? "✅" : "⬜"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span
                      style={{ cursor: "pointer", fontSize: 18 }}
                      onClick={() => toggle(p, "publish_to_signage")}
                    >
                      {p.publish_to_signage ? "✅" : "⬜"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          p.status === "published" ? "#dcfce7" : "#fef9c3",
                        color: p.status === "published" ? "#16a34a" : "#92400e",
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td style={S.td}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => del(p.id)}
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
      </main>
    </div>
  );
}
