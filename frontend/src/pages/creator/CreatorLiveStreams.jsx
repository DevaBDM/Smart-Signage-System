import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import LiveStreamForm from "../../components/LiveStreamForm";
import useAuthStore from "../../store/useAuthStore";
import * as groupsApi from "../../api/groups";
import {
  listLiveStreams,
  createLiveStream,
  updateLiveStream,
  deleteLiveStream,
  startLiveStream,
  stopLiveStream,
  getLiveStreamLogs,
  uploadLiveStreamThumbnail,
} from "../../api/liveStreams";
import * as S from "../../styles";

function extractPort(url) {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return u.port || { rtsp: 554, rtmp: 1935, http: 80, https: 443 }[u.protocol.replace(":", "")] || "—";
  } catch {
    return "—";
  }
}

function DetailRow({ label, value, onCopy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#6b7280", minWidth: 110, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          flex: 1,
          fontFamily: onCopy ? "monospace" : "inherit",
          background: onCopy ? "#eef2ff" : "transparent",
          padding: onCopy ? "2px 6px" : 0,
          borderRadius: 4,
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
      {onCopy && (
        <button
          style={{
            padding: "2px 8px",
            fontSize: 11,
            borderRadius: 4,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
            color: "#374151",
          }}
          onClick={() => onCopy(value)}
          title="Copy to clipboard"
        >
          Copy
        </button>
      )}
    </div>
  );
}

export default function CreatorLiveStreams() {
  const { group_id, role: userRole } = useAuthStore();
  const [streams, setStreams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [logsMap, setLogsMap] = useState({}); // streamId -> { logs, loading }
  const logsContainerRefs = useRef({}); // streamId -> DOM element

  const load = () => {
    setLoading(true);
    Promise.all([listLiveStreams(), groupsApi.listGroups()])
      .then(([s, g]) => {
        setStreams(s);
        setGroups(g);
      })
      .catch((e) => setMsg(e.response?.data?.error || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-scroll to bottom whenever logs finish loading for expanded stream
  useEffect(() => {
    if (!expandedId) return;
    const entry = logsMap[expandedId];
    if (entry && !entry.loading && entry.logs?.length > 0) {
      const el = logsContainerRefs.current[expandedId];
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [logsMap, expandedId]);

  const handleCreate = async (data) => {
    setLoading(true);
    try {
      await createLiveStream(data);
      setMsg("Live stream created");
      setEditingId(null);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Create failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data) => {
    setLoading(true);
    try {
      await updateLiveStream(editingId, data);
      setMsg("Live stream updated");
      setEditingId(null);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this stream?")) return;
    setLoading(true);
    try {
      await deleteLiveStream(id);
      setMsg("Live stream deleted");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id) => {
    setLoading(true);
    try {
      await startLiveStream(id);
      setMsg("Relay started");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Start failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (id) => {
    setLoading(true);
    try {
      await stopLiveStream(id);
      setMsg("Relay stopped");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Stop failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const loadLogs = async (id) => {
    setLogsMap((prev) => ({ ...prev, [id]: { ...prev[id], loading: true } }));
    try {
      const data = await getLiveStreamLogs(id, 100);
      setLogsMap((prev) => ({ ...prev, [id]: { logs: data.logs || [], loading: false } }));
    } catch (e) {
      setLogsMap((prev) => ({ ...prev, [id]: { logs: ["Failed to load logs."], loading: false } }));
    }
    // Scroll to bottom so latest logs are visible
    setTimeout(() => {
      const el = logsContainerRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const editingStream = streams.find((s) => s.id === editingId);

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Live Streams</h1>
        {msg && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: msg.includes("failed") || msg.includes("error")
                ? "#fee2e2"
                : "#d1fae5",
              color: msg.includes("failed") || msg.includes("error")
                ? "#991b1b"
                : "#065f46",
            }}
          >
            {msg}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
          <LiveStreamForm
            onSubmit={editingId ? handleUpdate : handleCreate}
            onThumbnailUpload={uploadLiveStreamThumbnail}
            loading={loading}
            groups={groups}
            initial={editingStream || {}}
          />

          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Your Streams</h3>
            {streams.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No live streams yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {streams.map((s) => {
                  const isExpanded = expandedId === s.id;
                  const relayBase = window.location.origin;
                  const relayUrl = s.relay_url?.startsWith("http")
                    ? s.relay_url
                    : s.relay_url
                      ? `${relayBase}${s.relay_url}`
                      : `${relayBase}/streams/${s.id}/index.m3u8`;
                  const port = extractPort(s.source_url);
                  const statusColor =
                    s.status === "online"
                      ? "#059669"
                      : s.status === "error"
                      ? "#dc2626"
                      : s.status === "starting"
                      ? "#d97706"
                      : "#6b7280";
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{s.title}</strong>
                          <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                            {s.stream_type}
                          </span>
                          <span style={{ fontSize: 12, marginLeft: 8, color: statusColor, fontWeight: 600 }}>
                            {s.status}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {s.stream_type !== "HLS" && (
                            <>
                              <button
                                style={{ ...S.btn, padding: "4px 8px", fontSize: 12, background: "#16a34a", color: "#fff" }}
                                onClick={() => handleStart(s.id)}
                              >
                                Start
                              </button>
                              <button
                                style={{ ...S.btn, padding: "4px 8px", fontSize: 12, background: "#dc2626", color: "#fff" }}
                                onClick={() => handleStop(s.id)}
                              >
                                Stop
                              </button>
                            </>
                          )}
                          <button
                            style={{ ...S.btn, padding: "4px 8px", fontSize: 12, background: "#2563eb", color: "#fff" }}
                            onClick={() => setEditingId(s.id)}
                          >
                            Edit
                          </button>
                          <button
                            style={{
                              ...S.btn,
                              padding: "4px 8px",
                              fontSize: 12,
                              background: "#fee2e2",
                              color: "#991b1b",
                            }}
                            onClick={() => handleDelete(s.id)}
                          >
                            Delete
                          </button>
                          <button
                            style={{ ...S.btn, padding: "4px 8px", fontSize: 12, background: "#f3f4f6", color: "#374151" }}
                            onClick={() => toggleExpand(s.id)}
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible detail panel */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 6,
                            background: "#f9fafb",
                            fontSize: 13,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <DetailRow label="Source URL" value={s.source_url || "—"} onCopy={copyToClipboard} />
                          <DetailRow label="Relay URL (HLS)" value={relayUrl} onCopy={copyToClipboard} />
                          <DetailRow label="Port" value={port} />
                          {s.stream_key && <DetailRow label="Stream Key" value={s.stream_key} onCopy={copyToClipboard} />}
                          <DetailRow
                            label="Last Seen"
                            value={s.last_seen ? new Date(s.last_seen).toLocaleString() : "Never"}
                          />
                          {s.last_error && (
                            <div style={{ color: "#dc2626", marginTop: 4 }}>
                              <strong>Error:</strong> {s.last_error}
                            </div>
                          )}

                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button
                              style={{ ...S.btn, padding: "4px 10px", fontSize: 12, background: "#4b5563", color: "#fff" }}
                              onClick={() => loadLogs(s.id)}
                            >
                              {logsMap[s.id]?.loading ? "Loading logs…" : "View Relay Logs"}
                            </button>
                            {logsMap[s.id] && !logsMap[s.id].loading && (
                              <button
                                style={{
                                  ...S.btn,
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  background: "#e5e7eb",
                                  color: "#374151",
                                }}
                                onClick={() => loadLogs(s.id)}
                              >
                                Refresh
                              </button>
                            )}
                          </div>

                          {logsMap[s.id] && !logsMap[s.id].loading && (
                            <div
                              ref={(el) => {
                                if (el) logsContainerRefs.current[s.id] = el;
                              }}
                              style={{
                                marginTop: 6,
                                padding: 8,
                                background: "#111827",
                                color: "#e5e7eb",
                                borderRadius: 4,
                                fontFamily: "monospace",
                                fontSize: 11,
                                maxHeight: 240,
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {logsMap[s.id].logs.length === 0
                                ? "No logs available."
                                : logsMap[s.id].logs.join("\n")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
