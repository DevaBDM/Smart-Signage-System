import { useEffect, useState } from "react";
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
} from "../../api/liveStreams";
import * as S from "../../styles";

export default function CreatorLiveStreams() {
  const { group_id, role: userRole } = useAuthStore();
  const [streams, setStreams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);

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
                {streams.map((s) => (
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
                        <span
                          style={{
                            fontSize: 12,
                            marginLeft: 8,
                            color:
                              s.status === "online"
                                ? "#059669"
                                : s.status === "error"
                                ? "#dc2626"
                                : "#6b7280",
                          }}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
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
                      </div>
                    </div>
                    {s.source_url && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {s.source_url}
                      </div>
                    )}
                    {s.stream_key && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        Key: {s.stream_key}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
