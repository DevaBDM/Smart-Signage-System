import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

export default function CreatorSignage() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    post_id: "",
    device_id: "",
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data.filter((p) => p.images?.length > 0)))
      .catch(() => {});
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, []);

  const publish = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const r = await api.post("/signage/publish", form);
      setMsg(
        r.data.pi_notified
          ? "✅ Published and Pi notified!"
          : "✅ Published (Pi offline — will sync on reconnect)",
      );
    } catch {
      setMsg("❌ Publish failed.");
    }
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Publish to Signage</h1>
        <p style={S.sub}>
          Send a post image directly to a display via Anthias.
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              Signage Publish
            </h2>
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
              onSubmit={publish}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <label style={S.label}>Post (must have an image)</label>
              <select
                style={S.input}
                value={form.post_id}
                onChange={(e) => setForm({ ...form, post_id: e.target.value })}
                required
              >
                <option value="">— Select post —</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <label style={S.label}>Target Display</label>
              <select
                style={S.input}
                value={form.device_id}
                onChange={(e) =>
                  setForm({ ...form, device_id: e.target.value })
                }
                required
              >
                <option value="">— Select device —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_name} ({d.status})
                  </option>
                ))}
              </select>

              <label style={S.label}>Duration (seconds)</label>
              <input
                style={S.input}
                type="number"
                min={1}
                max={300}
                value={form.duration_seconds}
                onChange={(e) =>
                  setForm({ ...form, duration_seconds: Number(e.target.value) })
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
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                🚀 Publish to Display
              </button>
            </form>
          </div>

          {/* Preview selected post */}
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Post Preview</h2>
            {!form.post_id && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                Select a post to preview
              </p>
            )}
            {form.post_id &&
              (() => {
                const p = posts.find(
                  (x) => String(x.id) === String(form.post_id),
                );
                if (!p) return null;
                return (
                  <div>
                    {p.images?.[0] && (
                      <img
                        src={`${BASE}${p.images[0].image_path}`}
                        style={{
                          width: "100%",
                          maxHeight: 300,
                          objectFit: "contain",
                          borderRadius: 8,
                          background: "#f3f4f6",
                        }}
                      />
                    )}
                    <h3 style={{ marginTop: 12, fontWeight: 700 }}>
                      {p.title}
                    </h3>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                      {p.images?.length} image(s) · Signage uses first image
                      only
                    </p>
                  </div>
                );
              })()}
          </div>
        </div>
      </main>
    </div>
  );
}
