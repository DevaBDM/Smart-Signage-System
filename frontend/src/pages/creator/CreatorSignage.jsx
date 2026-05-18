import { useEffect, useMemo, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import { assetOrigin } from "../../config/apiBase";
import usePersistentState, {
  userScopedKey,
} from "../../hooks/usePersistentState";

const BASE = assetOrigin();

const messageStyle = (msg) => ({
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
  background: msg.startsWith("✅")
    ? "#dcfce7"
    : msg.startsWith("⚠️")
      ? "#fffbeb"
      : "#fee2e2",
  color: msg.startsWith("✅")
    ? "#166534"
    : msg.startsWith("⚠️")
      ? "#92400e"
      : "#b91c1c",
});

function postMediaMeta(post) {
  const media = post?.images?.[0];
  if (!media) return { isVideo: false, label: "", duration: 10 };
  const isVideo = media.media_type === "VIDEO";
  return {
    isVideo,
    label: isVideo ? "Video" : "Image",
    duration: media.duration_seconds || 10,
  };
}

export default function CreatorSignage() {
  const { group_id, managed_group_ids, id: userId, can_manage_other_posts, role } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [form, setForm] = usePersistentState(
    userScopedKey("creator.signage.form", userId),
    {
      post_id: "",
      device_id: "",
      duration_seconds: 10,
      start_date: "",
      end_date: "",
      priority: 1,
    },
  );
  const [msg, setMsg] = useState("");

  const selectedDeviceId = form.device_id;
  const selectedPost = useMemo(
    () => posts.find((p) => String(p.id) === String(form.post_id)),
    [posts, form.post_id],
  );
  const selectedMeta = useMemo(
    () => postMediaMeta(selectedPost),
    [selectedPost],
  );

  // Fetch posts from all allowed groups
  useEffect(() => {
    const allowedGroupIds = [group_id, ...(managed_group_ids || [])].filter(Boolean);
    const loadAll = async () => {
      const allPosts = [];
      for (const gid of allowedGroupIds) {
        try {
          const r = await api.get(`/posts?group_id=${gid}`);
          allPosts.push(...(r.data || []));
        } catch {}
      }
      // Deduplicate by post id
      const unique = [];
      const seen = new Set();
      for (const p of allPosts) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          unique.push(p);
        }
      }
      setPosts(unique.filter((p) => p.images?.length > 0));
    };
    loadAll();
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, [group_id, managed_group_ids?.join(",")]);

  const loadAssets = async (deviceId = selectedDeviceId) => {
    if (!deviceId) {
      setAssets([]);
      return;
    }
    setAssetLoading(true);
    try {
      const r = await api.get(`/signage/devices/${deviceId}/assets`);
      const tracked = r.data.tracked_assets || [];
      const merged = (r.data.assets || []).map((piAsset) => {
        const t = tracked.find((ta) => ta.asset_id === piAsset.asset_id);
        const serverPath = t?.image_url;
        const isVideo =
          t?.media_type === "VIDEO" ||
          piAsset.mimetype === "video" ||
          String(piAsset.mimetype || "").startsWith("video") ||
          String(serverPath || "").includes("/videos/");
        const allowedGroups = [String(group_id), ...(managed_group_ids || []).map(String)];
        const assetGroup = t?.group_id ? String(t.group_id) : null;
        const isOwnPost = t?.created_by === userId;
        const isManagedGroup = assetGroup && allowedGroups.includes(assetGroup);
        const canManage =
          role === "admin" ||
          isOwnPost ||
          (Boolean(can_manage_other_posts) && isManagedGroup);
        return {
          ...piAsset,
          is_video: isVideo,
          can_manage: canManage,
          clip_duration: t?.clip_duration_seconds ?? null,
          preview_url: serverPath
            ? `${BASE}${serverPath}`
            : piAsset.uri?.startsWith("http")
              ? piAsset.uri
              : null,
        };
      });
      setAssets(merged);
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not load display assets.");
    } finally {
      setAssetLoading(false);
    }
  };

  useEffect(() => {
    loadAssets(selectedDeviceId);
  }, [selectedDeviceId]);

  const onPostChange = (postId) => {
    const post = posts.find((p) => String(p.id) === String(postId));
    const meta = postMediaMeta(post);
    setForm((f) => ({
      ...f,
      post_id: postId,
      duration_seconds: meta.duration,
    }));
  };

  const publish = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const r = await api.post("/signage/publish", form);
      if (r.data.pi_notified) {
        setMsg("✅ Published — display updated.");
      } else if (r.data.error || r.data.pi_result?.error) {
        setMsg(
          `⚠️ Saved on server; display sync failed: ${r.data.error || r.data.pi_result?.error}`,
        );
      } else {
        setMsg("✅ Published (awaiting admin approval or offline sync).");
      }
      await loadAssets(form.device_id);
    } catch (err) {
      const data = err.response?.data;
      setMsg(
        `❌ ${data?.error || data?.pi_result?.error || "Publish failed."}`,
      );
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
      setMsg(is_enabled ? "✅ Asset shown." : "✅ Asset hidden.");
      await loadAssets();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not update asset.");
    }
  };

  const deleteAsset = async (asset) => {
    if (!confirm(`Delete "${asset.name}" from this display?`)) return;
    try {
      await api.delete(
        `/signage/devices/${selectedDeviceId}/assets/${asset.asset_id}`,
      );
      setMsg("✅ Asset removed from display.");
      await loadAssets();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not delete asset.");
    }
  };

  const formatAssetDuration = (asset) => {
    if (asset.is_video) {
      const clip = asset.clip_duration;
      return clip ? `${clip}s clip` : "full video";
    }
    return `${asset.duration || 10}s`;
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Publish to Signage</h1>
        <p style={S.sub}>
          Send images or videos to a display and manage Anthias playback.
        </p>
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
              <label style={S.label}>Post</label>
              <select
                style={S.input}
                value={form.post_id}
                onChange={(e) => onPostChange(e.target.value)}
                required
              >
                <option value="">— Select post —</option>
                {posts.map((p) => {
                  const meta = postMediaMeta(p);
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
                      setForm({
                        ...form,
                        duration_seconds: Number(e.target.value),
                      })
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
                Publish to Display
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
              <h2 style={{ fontWeight: 700 }}>Display Assets</h2>
              <button
                type="button"
                onClick={() => loadAssets()}
                disabled={!selectedDeviceId || assetLoading}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                {assetLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => runControl("previous")}
                disabled={!selectedDeviceId}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => runControl("next")}
                disabled={!selectedDeviceId}
                style={{ ...S.btn, padding: "6px 10px" }}
              >
                Next
              </button>
            </div>

            {!selectedDeviceId && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                Select a display to see its assets.
              </p>
            )}

            {selectedDeviceId && assets.length === 0 && !assetLoading && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
                No assets on this display yet.
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
                  {asset.preview_url && asset.is_video ? (
                    <video
                      src={asset.preview_url}
                      muted
                      playsInline
                      preload="metadata"
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 6,
                        background: "#111",
                      }}
                    />
                  ) : asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt=""
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
                      {asset.name || "Untitled asset"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                      {asset.is_video ? "Video" : "Image"} ·{" "}
                      {asset.is_enabled ? "Visible" : "Hidden"} ·{" "}
                      {formatAssetDuration(asset)}
                      {!asset.can_manage ? " · view only" : ""}
                    </div>
                    {asset.can_manage ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => runControl("start", asset.asset_id)}
                          style={{ ...S.btn, padding: "5px 9px" }}
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAssetEnabled(asset, !asset.is_enabled)
                          }
                          style={{ ...S.btn, padding: "5px 9px" }}
                        >
                          {asset.is_enabled ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
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
                    ) : null}
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
