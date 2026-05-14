import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace("/api", "");

const messageStyle = (msg) => ({
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
  color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
});

export default function CreatorSignage() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [form, setForm] = useState({
    post_id: "",
    device_id: "",
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
  });
  const [msg, setMsg] = useState("");

  const selectedDeviceId = form.device_id;

  useEffect(() => {
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data.filter((p) => p.images?.length > 0)))
      .catch(() => {});
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, [department_id]);

  const loadAssets = async (deviceId = selectedDeviceId) => {
    if (!deviceId) {
      setAssets([]);
      return;
    }
    setAssetLoading(true);
    try {
      const r = await api.get(`/signage/devices/${deviceId}/assets`);
      // Merge the Pi's real-time asset list with our database's server-side image URLs
      const merged = (r.data.assets || []).map(piAsset => {
        const tracked = (r.data.tracked_assets || []).find(ta => ta.asset_id === piAsset.asset_id);
        return {
          ...piAsset,
          // If we have a tracked record with a server image, use it for the preview
          preview_url: tracked?.image_url ? `${BASE}${tracked.image_url}` : piAsset.uri
        };
      });
      setAssets(merged);
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not load display images.");
    } finally {
      setAssetLoading(false);
    }
  };

  useEffect(() => {
    loadAssets(selectedDeviceId);
  }, [selectedDeviceId]);

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
      await loadAssets(form.device_id);
    } catch {
      setMsg("❌ Publish failed.");
    }
  };

  const runControl = async (command, asset_id) => {
    if (!selectedDeviceId) return;
    setMsg("");
    try {
      await api.post(`/signage/devices/${selectedDeviceId}/control`, {
        command,
        asset_id,
      });
      setMsg("✅ Display command sent.");
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Display command failed.");
    }
  };

  const setAssetEnabled = async (asset, is_enabled) => {
    try {
      await api.patch(
        `/signage/devices/${selectedDeviceId}/assets/${asset.asset_id}`,
        { is_enabled },
      );
      setMsg(is_enabled ? "✅ Image shown." : "✅ Image hidden.");
      await loadAssets();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not update image.");
    }
  };

  const deleteAsset = async (asset) => {
    if (!confirm(`Delete "${asset.name}" from this display?`)) return;
    try {
      await api.delete(
        `/signage/devices/${selectedDeviceId}/assets/${asset.asset_id}`,
      );
      setMsg("✅ Image deleted from display.");
      await loadAssets();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not delete image.");
    }
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Publish to Signage</h1>
        <p style={S.sub}>Send images to a display and manage Anthias playback.</p>
        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>
              Signage Publish
            </h2>
            {msg && <div style={messageStyle(msg)}>{msg}</div>}
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

          <div style={S.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontWeight: 700 }}>Display Images</h2>
              <button
                onClick={() => loadAssets()}
                disabled={!selectedDeviceId || assetLoading}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                {assetLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => runControl("previous")}
                disabled={!selectedDeviceId}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                Previous
              </button>
              <button
                onClick={() => runControl("next")}
                disabled={!selectedDeviceId}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                Next
              </button>
            </div>

            {!selectedDeviceId && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                Select a display to see its images.
              </p>
            )}

            {selectedDeviceId && assets.length === 0 && !assetLoading && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                No images found on this display.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {assets.map((asset) => (
                <div
                  key={asset.asset_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr",
                    gap: 12,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  {asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 6,
                        background: "#f3f4f6",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 6,
                        background: "#f3f4f6",
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {asset.name || "Untitled image"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                      {asset.is_enabled ? "Visible" : "Hidden"} ·{" "}
                      {asset.duration || 10}s
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <button
                        onClick={() => runControl("start", asset.asset_id)}
                        style={{ ...S.btn, padding: "5px 9px" }}
                      >
                        Start
                      </button>
                      <button
                        onClick={() =>
                          setAssetEnabled(asset, !asset.is_enabled)
                        }
                        style={{ ...S.btn, padding: "5px 9px" }}
                      >
                        {asset.is_enabled ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => deleteAsset(asset)}
                        style={{
                          ...S.btn,
                          background: "#fee2e2",
                          color: "#b91c1c",
                          padding: "5px 9px",
                        }}
                      >
                        Delete
                      </button>
                    </div>
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
