import { useState, useEffect } from "react";
import { Card, Message, Button } from "./ui";
import * as S from "../styles";

const STREAM_TYPES = [
  { value: "HLS", label: "HLS (.m3u8)" },
  { value: "RTSP", label: "RTSP (IP Camera)" },
  { value: "YOUTUBE", label: "YouTube Live" },
  { value: "RTMP", label: "RTMP (OBS Ingest)" },
];

export default function LiveStreamForm({
  onSubmit,
  onThumbnailUpload,
  loading,
  groups,
  initial = {},
}) {
  const [form, setForm] = useState({
    title: initial.title || "",
    stream_type: initial.stream_type || "HLS",
    source_url: initial.source_url || "",
    group_id: initial.group_id ? String(initial.group_id) : "",
  });
  const [msg, setMsg] = useState("");
  const [thumbPreview, setThumbPreview] = useState(initial.thumbnail_path || null);
  const [thumbUploading, setThumbUploading] = useState(false);

  useEffect(() => {
    setForm({
      title: initial.title || "",
      stream_type: initial.stream_type || "HLS",
      source_url: initial.source_url || "",
      group_id: initial.group_id ? String(initial.group_id) : "",
    });
    setThumbPreview(initial.thumbnail_path || null);
    setMsg("");
  }, [initial.id]);

  const setField = (patch) => setForm({ ...form, ...patch });

  const handleThumbChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onThumbnailUpload || !initial.id) return;
    setThumbUploading(true);
    try {
      const data = await onThumbnailUpload(initial.id, file);
      setThumbPreview(data.thumbnail_path);
    } catch (err) {
      setMsg(err.response?.data?.error || "Thumbnail upload failed");
    } finally {
      setThumbUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setMsg("Title is required");
    if (!form.group_id) return setMsg("Group is required");
    if (form.stream_type !== "RTMP" && !form.source_url.trim()) {
      return setMsg("Source URL is required");
    }
    setMsg("");
    onSubmit({
      ...form,
      group_id: Number(form.group_id),
      source_url: form.source_url.trim() || null,
    });
  };

  return (
    <Card>
      <h2 style={{ fontWeight: 700, marginBottom: 12 }}>
        {initial.id ? "Edit Live Stream" : "New Live Stream"}
      </h2>
      {msg && <Message text={msg} />}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={S.label}>Title</label>
        <input
          style={S.input}
          value={form.title}
          onChange={(e) => setField({ title: e.target.value })}
          required
        />

        <label style={S.label}>Type</label>
        <select
          style={S.input}
          value={form.stream_type}
          onChange={(e) => setField({ stream_type: e.target.value })}
        >
          {STREAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {form.stream_type !== "RTMP" && (
          <>
            <label style={S.label}>Source URL</label>
            <input
              style={S.input}
              value={form.source_url}
              onChange={(e) => setField({ source_url: e.target.value })}
              placeholder={
                form.stream_type === "HLS"
                  ? "https://example.com/stream.m3u8"
                  : form.stream_type === "RTSP"
                  ? "rtsp://192.168.1.50/live"
                  : "https://youtube.com/live/..."
              }
              required
            />
          </>
        )}

        <label style={S.label}>Group</label>
        <select
          style={S.input}
          value={form.group_id}
          onChange={(e) => setField({ group_id: e.target.value })}
          required
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={String(g.id)}>{g.name}</option>
          ))}
        </select>

        {/* Thumbnail */}
        <div style={{ marginTop: 6 }}>
          <label style={S.label}>Thumbnail</label>
          {thumbPreview && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={thumbPreview}
                alt="Thumbnail"
                style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
            </div>
          )}
          {initial.id && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleThumbChange}
              />
              <span
                style={{
                  ...S.btn,
                  padding: "6px 12px",
                  fontSize: 13,
                  opacity: thumbUploading ? 0.6 : 1,
                }}
              >
                {thumbUploading ? "Uploading…" : thumbPreview ? "Change Thumbnail" : "Add Thumbnail"}
              </span>
            </label>
          )}
          {!initial.id && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Save stream first to upload thumbnail
            </span>
          )}
        </div>

        <div style={{ marginTop: 8 }}>
          <Button type="submit" loading={loading}>
            {initial.id ? "Update Stream" : "Create Stream"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
