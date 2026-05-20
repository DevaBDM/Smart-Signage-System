import { useState, useEffect } from "react";
import { listLiveStreams } from "../api/liveStreams";

export default function LiveStreamPicker({ value, onChange, groupId }) {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listLiveStreams()
      .then((data) => {
        const filtered = groupId
          ? data.filter((s) => String(s.group_id) === String(groupId))
          : data;
        setStreams(filtered);
      })
      .catch(() => setStreams([]))
      .finally(() => setLoading(false));
  }, [groupId]);

  return (
    <div>
      <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
        Live Stream
      </label>
      <select
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          fontSize: 14,
        }}
        value={value ? String(value) : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{loading ? "Loading…" : "Select a live stream…"}</option>
        {streams.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.title} ({s.stream_type}) {s.status === "online" ? "●" : "○"}
          </option>
        ))}
      </select>
      {streams.length === 0 && !loading && (
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          No live streams found for this group.
        </p>
      )}
    </div>
  );
}
