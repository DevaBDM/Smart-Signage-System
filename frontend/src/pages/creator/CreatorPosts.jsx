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
  const [devices, setDevices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description_markdown: "",
    publish_to_feed: false,
    publish_to_signage: false,
    status: "draft",
    device_ids: [],
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
    display_group: "",
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
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, [department_id]);

  const resetForm = () => {
    setEditingId(null);
    setMsg(""); // Fix: clear message on cancel/reset
    setForm({
      title: "",
      description_markdown: "",
      publish_to_feed: false,
      publish_to_signage: false,
      status: "draft",
      device_ids: [],
      duration_seconds: 10,
      start_date: "",
      end_date: "",
      priority: 1,
      display_group: "",
    });
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      description_markdown: post.description_markdown || "",
      publish_to_feed: post.publish_to_feed,
      publish_to_signage: post.publish_to_signage,
      status: post.status,
      // For existing posts, we need to map deployments correctly
      device_ids: post.signage_deployments?.map(d => d.device_id) || [],
      duration_seconds: post.signage_metadata?.duration_seconds || 10,
      start_date: post.signage_metadata?.start_date?.split('.')[0] || "",
      end_date: post.signage_metadata?.end_date?.split('.')[0] || "",
      priority: post.signage_metadata?.priority || 1,
      display_group: post.signage_metadata?.display_group || "",
    });
    setMsg(`Editing: ${post.title}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries({ ...form, department_id }).forEach(([k, v]) =>
        fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v),
      );
      files.forEach((f) => fd.append("images", f));

      if (editingId) {
        // Use FormData even for PUT to support image replacement
        await api.put(`/posts/${editingId}`, fd);
        setMsg("✅ Post updated!");
      } else {
        await api.post("/posts", fd);
        setMsg("✅ Post created!");
      }
      resetForm();
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Failed to save post.");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete?")) return;
    const deleteSignage = confirm("Also remove this post from signage displays?");
    await api.delete(`/posts/${id}`, {
      params: { delete_signage: deleteSignage },
    });
    load();
  };

  const toggleDevice = (id) => {
    const deviceId = Number(id);
    setForm((current) => ({
      ...current,
      device_ids: current.device_ids.includes(deviceId)
        ? current.device_ids.filter((x) => x !== deviceId)
        : [...current.device_ids, deviceId],
    }));
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700 }}>{editingId ? "Edit Post" : "New Post"}</h2>
              {editingId && (
                <button onClick={resetForm} style={{ ...S.btn, padding: '4px 8px', fontSize: 12 }}>Cancel Edit</button>
              )}
            </div>
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

              <label style={S.label}>{editingId ? "Replace Image (optional)" : "Images"}</label>
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
                  Mark as Signage Ready
                </label>
              </div>
              
              {form.publish_to_signage && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                  }}
                >
                  <label style={S.label}>Target Displays</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {devices.length === 0 && (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        No displays are assigned to your department yet.
                      </span>
                    )}
                    {devices.map((d) => (
                      <label
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.device_ids.includes(d.id)}
                          onChange={() => toggleDevice(d.id)}
                        />
                        {d.device_name} ({d.status})
                      </label>
                    ))}
                  </div>

                  <label style={S.label}>Duration (seconds)</label>
                  <input
                    style={S.input}
                    type="number"
                    min={1}
                    max={300}
                    value={form.duration_seconds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        duration_seconds: Number(e.target.value),
                      })
                    }
                  />

                  <label style={S.label}>Priority (1 = highest)</label>
                  <input
                    style={S.input}
                    type="number"
                    min={1}
                    max={10}
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: Number(e.target.value) })
                    }
                  />

                  <label style={S.label}>Start Date (optional)</label>
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />

                  <label style={S.label}>End Date (optional)</label>
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />

                  <label style={S.label}>Display Group (optional)</label>
                  <input
                    style={S.input}
                    value={form.display_group}
                    onChange={(e) =>
                      setForm({ ...form, display_group: e.target.value })
                    }
                  />
                </div>
              )}

              <label style={S.label}>Post Status</label>
              <select
                style={{...S.input, background: form.status === 'published' ? '#dcfce7' : '#fff'}}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft (Private)</option>
                <option value="published">Published (Visible)</option>
              </select>

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: editingId ? "#2563eb" : "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
                disabled={loading}
              >
                {loading ? "Saving..." : editingId ? "💾 Update Post" : "🚀 Create Post"}
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
                maxHeight: 800,
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
                    background: editingId === p.id ? "#f0f9ff" : "#fff",
                    borderLeft: `5px solid ${p.status === 'published' ? '#16a34a' : '#d1d5db'}`
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
                      {p.publish_to_signage ? "🖥 Signage" : ""} · 
                      <strong style={{ color: p.status === 'published' ? '#166534' : '#6b7280' }}>
                        {" "}{p.status.toUpperCase()}
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => startEdit(p)}
                      style={{
                        ...S.btn,
                        padding: "5px 10px",
                        flexShrink: 0,
                        fontSize: 12
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => del(p.id)}
                      style={{
                        ...S.btn,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        padding: "5px 10px",
                        flexShrink: 0,
                        fontSize: 12
                      }}
                    >
                      🗑
                    </button>
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
