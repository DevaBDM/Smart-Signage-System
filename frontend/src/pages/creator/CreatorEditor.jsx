import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import Designer from "../../components/Designer";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

export default function CreatorEditor() {
  const { department_id } = useAuthStore();
  const [devices, setDevices] = useState([]);
  const [exported, setExported] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
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

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, []);

  const handleExport = (file, previewUrl) => {
    setExported({ file, previewUrl });
    setForm((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
    }));
    setMsg("");
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

  const savePost = async (e) => {
    e.preventDefault();
    if (!exported?.file) {
      setMsg("❌ Export a design first.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries({ ...form, department_id }).forEach(([key, value]) => {
        fd.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
      });
      fd.append("images", exported.file);
      await api.post("/posts", fd);
      setMsg("✅ Design saved to My Posts.");
      setExported(null);
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
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not save design.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Poster Designer</h1>
        <p style={S.sub}>Design a poster and save it directly to My Posts.</p>

        {msg && (
          <div
            style={{
              ...S.card,
              padding: "10px 14px",
              background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
              border: `1.5px solid ${msg.startsWith("✅") ? "#86efac" : "#fecaca"}`,
              color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
            }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 360px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={S.card}>
            <Designer onExport={handleExport} />
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Save Design</h2>
            {!exported && (
              <p style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.5 }}>
                Click Use This Design after editing the canvas, then save it as
                a post.
              </p>
            )}
            {exported && (
              <form
                onSubmit={savePost}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <img
                  src={exported.previewUrl}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    borderRadius: 8,
                    background: "#f3f4f6",
                  }}
                />

                <label style={S.label}>Title</label>
                <input
                  style={S.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />

                <label style={S.label}>Description</label>
                <textarea
                  style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                  value={form.description_markdown}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description_markdown: e.target.value,
                    })
                  }
                />

                <label style={S.label}>Status</label>
                <select
                  style={S.input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>

                <label style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.publish_to_feed}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_feed: e.target.checked })
                    }
                  />
                  Publish to Feed
                </label>

                <label style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.publish_to_signage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        publish_to_signage: e.target.checked,
                      })
                    }
                  />
                  Mark as Signage Ready
                </label>

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
                    {devices.map((d) => (
                      <label
                        key={d.id}
                        style={{ display: "flex", gap: 8, fontSize: 13 }}
                      >
                        <input
                          type="checkbox"
                          checked={form.device_ids.includes(d.id)}
                          onChange={() => toggleDevice(d.id)}
                        />
                        {d.device_name} ({d.status})
                      </label>
                    ))}

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

                    <label style={S.label}>Priority</label>
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

                    <label style={S.label}>Start Date</label>
                    <input
                      style={S.input}
                      type="datetime-local"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />

                    <label style={S.label}>End Date</label>
                    <input
                      style={S.input}
                      type="datetime-local"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />

                    <label style={S.label}>Display Group</label>
                    <input
                      style={S.input}
                      value={form.display_group}
                      onChange={(e) =>
                        setForm({ ...form, display_group: e.target.value })
                      }
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{ ...S.btn, background: "#7c3aed", color: "#fff" }}
                >
                  {saving ? "Saving..." : "Save to My Posts"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
