import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function CreatorPosts() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description_markdown: "",
    publish_to_feed: false,
    publish_to_signage: false,
    status: "draft",
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef();

  const load = () =>
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  useEffect(() => {
    load();
  }, [department_id]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries({ ...form, department_id }).forEach(([k, v]) =>
        fd.append(k, v),
      );
      files.forEach((f) => fd.append("images", f));
      await api.post("/posts", fd);
      setMsg("✅ Post created!");
      setForm({
        title: "",
        description_markdown: "",
        publish_to_feed: false,
        publish_to_signage: false,
        status: "draft",
      });
      setFiles([]);
      fileRef.current.value = "";
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Failed to create post.");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete?")) return;
    await api.delete(`/posts/${id}`);
    load();
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>My Posts</h1>
        <p style={S.sub}>Create and manage your department's content.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>New Post</h2>
            {msg && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
                }}
              >
                {msg}
              </div>
            )}
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Title</label>
              <input
                style={S.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label style={S.label}>Description (Markdown)</label>
              <textarea
                style={{
                  ...S.input,
                  minHeight: 100,
                  resize: "vertical",
                  fontFamily: "monospace",
                }}
                value={form.description_markdown}
                onChange={(e) =>
                  setForm({ ...form, description_markdown: e.target.value })
                }
                placeholder="## Announcement&#10;Write your **markdown** here..."
              />

              <label style={S.label}>Images</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles([...e.target.files])}
              />

              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_feed}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_feed: e.target.checked })
                    }
                  />
                  Publish to Feed
                </label>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_signage}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_signage: e.target.checked })
                    }
                  />
                  Publish to Signage
                </label>
              </div>

              <select
                style={S.input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
                disabled={loading}
              >
                {loading ? "Saving..." : "🚀 Save Post"}
              </button>
            </form>
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>
              Posts ({posts.length})
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 600,
                overflowY: "auto",
              }}
            >
              {posts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  {p.images?.[0] ? (
                    <img
                      src={`${BASE}${p.images[0].image_path}`}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: "#f3f4f6",
                        borderRadius: 8,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      📋
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.title}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}
                    >
                      {p.publish_to_feed ? "📰 Feed " : ""}
                      {p.publish_to_signage ? "🖥 Signage" : ""} · {p.status}
                    </div>
                  </div>
                  <button
                    onClick={() => del(p.id)}
                    style={{
                      ...S.btn,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "5px 10px",
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
