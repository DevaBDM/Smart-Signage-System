import * as S from "../styles";

export default function SignagePublishForm({
  form,
  onChange,
  onPostChange,
  onSubmit,
  posts,
  devices,
  selectedMeta,
  msg,
  messageStyle,
}) {
  const setField = (patch) => onChange({ ...form, ...patch });

  return (
    <div style={S.card}>
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Signage Publish</h2>
      {msg && <div style={messageStyle(msg)}>{msg}</div>}
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <label style={S.label}>Post</label>
        <select
          style={S.input}
          value={form.post_id}
          onChange={(e) => onPostChange(e.target.value)}
          required
        >
          <option value="">— Select post —</option>
          {posts.map((p) => {
            const meta = selectedMeta(p);
            return (
              <option key={p.id} value={p.id}>
                {p.title} — {p.group?.name || "—"} ({meta.label}
                {meta.isVideo ? `, ${meta.duration}s` : ""})
              </option>
            );
          })}
        </select>

        <label style={S.label}>Target Display</label>
        <select
          style={S.input}
          value={form.device_id}
          onChange={(e) => setField({ device_id: e.target.value })}
          required
        >
          <option value="">— Select device —</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.device_name} ({d.status})
            </option>
          ))}
        </select>

        {selectedMeta.isVideo ? (
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Video length is set by the trimmed file (
            {selectedMeta.duration}s). Anthias plays the full clip.
          </p>
        ) : (
          <>
            <label style={S.label}>Slide duration (seconds)</label>
            <input
              style={S.input}
              type="number"
              min={1}
              max={300}
              value={form.duration_seconds}
              onChange={(e) =>
                setField({ duration_seconds: Number(e.target.value) })
              }
            />
          </>
        )}

        <label style={S.label}>Priority (1 = highest)</label>
        <input
          style={S.input}
          type="number"
          min={1}
          max={10}
          value={form.priority}
          onChange={(e) => setField({ priority: Number(e.target.value) })}
        />

        <label style={S.label}>Start Date (optional)</label>
        <input
          style={S.input}
          type="datetime-local"
          value={form.start_date}
          onChange={(e) => setField({ start_date: e.target.value })}
        />

        <label style={S.label}>End Date (optional)</label>
        <input
          style={S.input}
          type="datetime-local"
          value={form.end_date}
          onChange={(e) => setField({ end_date: e.target.value })}
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
          Publish to Display
        </button>
      </form>
    </div>
  );
}
