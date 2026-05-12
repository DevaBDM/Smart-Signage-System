import { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

export default function ContentManager() {
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ title: "", target_device_id: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef();

  const fetchAll = () => {
    api
      .get("/posts")
      .then((r) => setPosts(r.data))
      .catch(() => {});
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please select an image.");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("target_device_id", form.target_device_id);
      fd.append("image", file);
      await api.post("/posts", fd);
      setSuccess("Post published successfully!");
      setForm({ title: "", target_device_id: "" });
      setFile(null);
      setPreview(null);
      fileRef.current.value = "";
      fetchAll();
    } catch {
      setError("Failed to publish. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id) => {
    if (!confirm("Delete this post?")) return;
    await api.delete(`/posts/${id}`);
    fetchAll();
  };

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <h1 style={styles.heading}>Content Manager</h1>
        <p style={styles.sub}>
          Upload signage images and publish them to displays.
        </p>

        <div style={styles.grid}>
          {/* Upload Form */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>📤 Publish New Post</h2>

            {success && <div style={styles.success}>{success}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Title</label>
              <input
                style={styles.input}
                placeholder="Announcement title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label style={styles.label}>Target Display</label>
              <select
                style={styles.input}
                value={form.target_device_id}
                onChange={(e) =>
                  setForm({ ...form, target_device_id: e.target.value })
                }
                required
              >
                <option value="">— Select a device —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.location})
                  </option>
                ))}
              </select>

              <label style={styles.label}>Signage Image</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                style={styles.fileInput}
              />

              {preview && (
                <img
                  src={preview}
                  alt="preview"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    marginTop: 8,
                    maxHeight: 200,
                    objectFit: "cover",
                  }}
                />
              )}

              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? "Publishing..." : "🚀 Publish to Display"}
              </button>
            </form>
          </section>

          {/* Posts List */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>
              🖼 Published Posts ({posts.length})
            </h2>
            <div style={styles.postList}>
              {posts.length === 0 && <p style={styles.empty}>No posts yet.</p>}
              {posts.map((p) => (
                <div key={p.id} style={styles.postItem}>
                  {p.image_url && (
                    <img
                      src={`http://localhost:5000${p.image_url}`}
                      alt={p.title}
                      style={styles.thumb}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={styles.postTitle}>{p.title}</div>
                    <div style={styles.postMeta}>
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deletePost(p.id)}
                    style={styles.deleteBtn}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: {
    marginLeft: 240,
    flex: 1,
    padding: "32px 36px",
    background: "#f4f6f9",
  },
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e" },
  sub: { fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 20,
    color: "#1a1a2e",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#f9fafb",
  },
  fileInput: { fontSize: 13, color: "#374151" },
  btn: {
    marginTop: 8,
    padding: "11px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 8,
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 8,
  },
  postList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: 500,
    overflowY: "auto",
  },
  postItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  thumb: {
    width: 60,
    height: 60,
    objectFit: "cover",
    borderRadius: 6,
    flexShrink: 0,
  },
  postTitle: { fontWeight: 600, fontSize: 14, color: "#1a1a2e" },
  postMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  deleteBtn: {
    background: "#fee2e2",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
  },
  empty: { color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 },
};
