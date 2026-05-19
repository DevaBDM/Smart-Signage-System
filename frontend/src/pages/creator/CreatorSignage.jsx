import { useEffect, useMemo, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import * as signageApi from "../../api/signage";
import * as postsApi from "../../api/posts";
import * as devicesApi from "../../api/devices";
import SignagePublishForm from "../../components/SignagePublishForm";
import SignageAssetList from "../../components/SignageAssetList";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import { assetOrigin } from "../../config/apiBase";
import { messageStyle } from "../../tokens";
import usePersistentState, {
  userScopedKey,
} from "../../hooks/usePersistentState";

const BASE = assetOrigin();

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
  const selectedPostMeta = useMemo(
    () => postMediaMeta(selectedPost),
    [selectedPost],
  );

  // Fetch posts from all allowed groups
  useEffect(() => {
    const allowedGroupIds = [group_id, ...(managed_group_ids || [])].filter(Boolean);
    const loadAll = async () => {
      const allPosts = await postsApi.listPostsForGroups(allowedGroupIds);
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
    devicesApi.listDevices()
      .then(setDevices)
      .catch(() => {});
  }, [group_id, managed_group_ids?.join(",")]);

  const loadAssets = async (deviceId = selectedDeviceId) => {
    if (!deviceId) {
      setAssets([]);
      return;
    }
    setAssetLoading(true);
    try {
      const data = await signageApi.getDeviceAssets(deviceId);
      const tracked = data.tracked_assets || [];
      const merged = (data.assets || []).map((piAsset) => {
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
      const r = await signageApi.publish(form);
      if (r.pi_notified) {
        setMsg("✅ Published — display updated.");
      } else if (r.error || r.pi_result?.error) {
        setMsg(
          `⚠️ Saved on server; display sync failed: ${r.error || r.pi_result?.error}`,
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
      await signageApi.controlDevice(selectedDeviceId, { command, asset_id });
      setMsg("✅ Display command sent.");
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Display command failed.");
    }
  };

  const setAssetEnabled = async (asset, is_enabled) => {
    try {
      await signageApi.patchAsset(selectedDeviceId, asset.asset_id, { is_enabled });
      setMsg(is_enabled ? "✅ Asset shown." : "✅ Asset hidden.");
      await loadAssets();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not update asset.");
    }
  };

  const deleteAsset = async (asset) => {
    if (!confirm(`Delete "${asset.name}" from this display?`)) return;
    try {
      await signageApi.deleteAsset(selectedDeviceId, asset.asset_id);
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
          <SignagePublishForm
            form={form}
            onChange={setForm}
            onPostChange={onPostChange}
            onSubmit={publish}
            posts={posts}
            devices={devices}
            selectedMeta={selectedPostMeta}
            postMediaMeta={postMediaMeta}
            msg={msg}
            messageStyle={messageStyle}
          />

          <SignageAssetList
            assets={assets}
            selectedDeviceId={selectedDeviceId}
            assetLoading={assetLoading}
            onRefresh={() => loadAssets()}
            onControl={runControl}
            onToggleEnabled={setAssetEnabled}
            onDelete={deleteAsset}
            formatDuration={formatAssetDuration}
          />
        </div>
      </main>
    </div>
  );
}
