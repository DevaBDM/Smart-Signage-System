import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../api/axios";
import * as S from "../../styles";
import { assetOrigin } from "../../config/apiBase";

const BASE = assetOrigin();

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
    await api.put(`/posts/${post.id}`, { [field]: !post[field] });
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
                    {p.author && (
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        By: {p.author.username} {!p.author.auto_approve && '(Manual Approval)'}
                      </div>
                    )}
                  </td>
                  <td style={S.td}>{p.department?.name ?? "—"}</td>
                  <td 
                    style={{ 
                      ...S.td, 
                      background: (!p.allowed_on_feed && p.requested_feed) ? '#fffbeb' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    onClick={() => toggle(p, "allowed_on_feed")}
                  >
                    <span
                      style={{ fontSize: 18 }}
                      title={p.allowed_on_feed ? "Live on Feed" : (p.requested_feed ? "Requested - Click to Allow" : "Not Allowed")}
                    >
                      {p.allowed_on_feed ? "✅" : (p.requested_feed ? "⏳" : "⬜")}
                    </span>
                  </td>
                  <td 
                    style={{ 
                      ...S.td, 
                      background: (!p.allowed_on_signage && p.requested_signage) ? '#fffbeb' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    onClick={() => toggle(p, "allowed_on_signage")}
                  >
                    <span
                      style={{ fontSize: 18 }}
                      title={p.allowed_on_signage ? "Live on Signage" : (p.requested_signage ? "Requested - Click to Allow" : "Not Allowed")}
                    >
                      {p.allowed_on_signage ? "✅" : (p.requested_signage ? "⏳" : "⬜")}
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
