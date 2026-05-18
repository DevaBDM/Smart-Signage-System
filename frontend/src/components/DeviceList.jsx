import * as S from "../styles";
import { statusBadge } from "../tokens";

export default function DeviceList({
  devices,
  selectedId,
  onSelect,
  sort,
  onSortChange,
}) {
  return (
    <div style={S.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontWeight: 700 }}>All Devices</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <select
            style={{ ...S.input, width: "auto", padding: "4px 8px" }}
            value={sort.by}
            onChange={(e) => onSortChange({ ...sort, by: e.target.value })}
          >
            <option value="id">Sort by ID</option>
            <option value="last_seen">Sort by Active</option>
            <option value="device_name">Sort by Name</option>
            <option value="status">Sort by Status</option>
          </select>
          <button
            style={{ ...S.btn, padding: "4px 8px" }}
            onClick={() =>
              onSortChange({
                ...sort,
                order: sort.order === "asc" ? "desc" : "asc",
              })
            }
          >
            {sort.order === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {devices.map((d) => (
          <div
            key={d.id}
            onClick={() => onSelect(d)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: `1.5px solid ${selectedId === d.id ? "#2563eb" : "#e5e7eb"}`,
              background: selectedId === d.id ? "#eff6ff" : "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{d.device_name}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {d.ip_address} ·{" "}
              {d.all_groups
                ? "All groups"
                : (() => {
                    const names = [];
                    if (d.group?.name) names.push(d.group.name);
                    (d.groups || []).forEach((g) => {
                      const n = g.group?.name;
                      if (n && !names.includes(n)) names.push(n);
                    });
                    return names.length ? names.join(", ") : "—";
                  })()}
            </div>
            {d.location && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {d.location}
              </div>
            )}
            <span style={statusBadge(d.status)}>
              {d.status}
            </span>
            {!d.is_approved && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 99,
                  marginLeft: 6,
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fcd34d",
                }}
              >
                NEW
              </span>
            )}
            {(d.pending_name || d.pending_ip || d.pending_location) && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 99,
                  marginLeft: 6,
                  background: "#dbeafe",
                  color: "#1e40af",
                  border: "1px solid #93c5fd",
                }}
              >
                CHANGED
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
