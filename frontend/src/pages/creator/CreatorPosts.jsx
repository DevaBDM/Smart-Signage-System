import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import { mediaSrc } from "../../components/PostMedia";
import api from "../../api/axios";
import * as postsApi from "../../api/posts";
import * as devicesApi from "../../api/devices";
import * as groupsApi from "../../api/groups";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import usePersistentState, {
  userScopedKey,
} from "../../hooks/usePersistentState";
import PostForm from "../../components/PostForm";
import PostList from "../../components/PostList";
import {
  SIGNAGE_STATE_LABELS,
  creatorSignageStateOptions,
} from "../../constants/signageStates";

export default function CreatorPosts() {
  const {
    id: userId,
    group_id,
    managed_group_ids,
    role: userRole,
    can_manage_other_posts,
    max_signage_state,
  } = useAuthStore();
  const signageStateOptions = creatorSignageStateOptions(max_signage_state);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeviceIds, setBulkDeviceIds] = usePersistentState(
    userScopedKey("creator.posts.bulkDeviceIds", userId),
    [],
  );
  const [groupCreators, setGroupCreators] = useState([]);
  const emptyForm = {
    title: "",
    description_markdown: "",
    group_ids: userRole === "admin" ? [] : (group_id ? [group_id] : []),
    publish_to_feed: false,
    publish_to_signage: false,
    status: "draft",
    device_ids: [],
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
    display_group: "",
    signage_state: "NORMAL",
    is_enabled: true,
    play_order: 0,
    nocache: false,
    skip_asset_check: false,
    media_source: "upload",
    live_stream_id: null,
  };
  const [form, setForm, clearForm] = usePersistentState(
    userScopedKey("creator.posts.form", userId),
    emptyForm,
  );
  const [filters, setFilters] = usePersistentState(
    userScopedKey("creator.posts.filters", userId),
    {
      channel: "all",
      device_id: "",
      creator_id: "",
      group_id: group_id || "",
    },
  );
  const [mediaItems, setMediaItems, clearMediaItems] = usePersistentState(
    userScopedKey("creator.posts.mediaItems", userId),
    [],
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    const params = {};
    if (filters.group_id) params.group_id = Number(filters.group_id);
    if (filters.channel !== "all") params.channel = filters.channel;
    if (filters.device_id) params.device_id = filters.device_id;
    if (filters.creator_id) params.creator_id = filters.creator_id;
    return postsApi.listPosts(params)
      .then(setPosts)
      .catch(() => {});
  };

  useEffect(() => {
    load();
    devicesApi.listDevices()
      .then(setDevices)
      .catch(() => {});
    groupsApi.listGroups()
      .then(setGroups)
      .catch(() => {});
  }, [group_id, filters.group_id, filters.channel, filters.creator_id, filters.device_id]);

  useEffect(() => {
    const queryGroupId = filters.group_id || group_id;
    if (!queryGroupId) {
      setGroupCreators([]);
      return;
    }
    api
      .get(`/posts/meta/group-creators?group_id=${queryGroupId}`)
      .then((r) => setGroupCreators(r.data))
      .catch(() => setGroupCreators([]));
  }, [filters.group_id, group_id]);

  const lastGroupIds = useRef("");
  const lastDeviceIds = useRef("");
  const devicesLoaded = useRef(false);

  useEffect(() => {
    if (devices.length > 0) devicesLoaded.current = true;
  }, [devices.length]);

  // group_ids → device_ids
  useEffect(() => {
    if (editingId || !devicesLoaded.current) return;
    const currentGroups = (form.group_ids || []).join(",");
    if (currentGroups === lastGroupIds.current) return;
    const selectedGroupIds = new Set((form.group_ids || []).map(Number));
    const autoDeviceIds = selectedGroupIds.size === 0
      ? []
      : devices
      .filter((d) => {
        if (d.all_groups) return true;
        if (selectedGroupIds.has(Number(d.group_id))) return true;
        if (d.groups?.some((dg) => selectedGroupIds.has(Number(dg.group_id)))) return true;
        return false;
      })
      .map((d) => d.id);
    const next = [...new Set([...autoDeviceIds])];
    const nextDevices = next.join(",");
    if (nextDevices === (form.device_ids || []).join(",")) {
      lastGroupIds.current = currentGroups;
      return;
    }
    lastGroupIds.current = currentGroups;
    lastDeviceIds.current = nextDevices;
    setForm((current) => ({ ...current, device_ids: next }));
  }, [form.group_ids?.join(",")]);

  // device_ids → group_ids
  useEffect(() => {
    if (editingId || !devicesLoaded.current) return;
    const currentDevices = (form.device_ids || []).join(",");
    if (currentDevices === lastDeviceIds.current) return;
    const selectedDeviceIds = new Set((form.device_ids || []).map(Number));
    const availableGroupIds = [
      ...(group_id ? [group_id] : []),
      ...(managed_group_ids || []),
    ];
    const nextGroupIds = [];
    for (const gid of availableGroupIds) {
      const groupSpecificDevices = devices.filter((d) => {
        if (d.all_groups) return false;
        if (Number(d.group_id) === Number(gid)) return true;
        if (d.groups?.some((dg) => Number(dg.group_id) === Number(gid))) return true;
        return false;
      });
      if (groupSpecificDevices.length === 0) {
        // Group only has all_groups devices; keep if any all_groups device is selected
        const anyAllGroupsSelected = devices
          .filter((d) => d.all_groups)
          .some((d) => selectedDeviceIds.has(d.id));
        if (anyAllGroupsSelected) nextGroupIds.push(gid);
        continue;
      }
      const allSelected = groupSpecificDevices.every((d) => selectedDeviceIds.has(d.id));
      const noneSelected = groupSpecificDevices.every((d) => !selectedDeviceIds.has(d.id));
      if (allSelected) nextGroupIds.push(gid);
      else if (!noneSelected) {
        if ((form.group_ids || []).includes(gid)) nextGroupIds.push(gid);
      }
    }
    const nextGroups = nextGroupIds.join(",");
    if (nextGroups === (form.group_ids || []).join(",")) {
      lastDeviceIds.current = currentDevices;
      return;
    }
    lastDeviceIds.current = currentDevices;
    lastGroupIds.current = nextGroups;
    setForm((current) => ({ ...current, group_ids: nextGroupIds }));
  }, [form.device_ids?.join(",")]);

  const onChannelFilterChange = (channel) => {
    setFilters((f) => ({
      ...f,
      channel,
      ...(channel === "feed" ? { device_id: "" } : {}),
    }));
  };

  const canManagePost = (post) => {
    if (userRole === "admin") return true;
    if (post.author?.id === userId) return true;
    if (!can_manage_other_posts) return false;
    const postGroup = String(post.group_id);
    const allowedGroups = [
      String(group_id),
      ...(managed_group_ids || []).map(String),
    ];
    return allowedGroups.includes(postGroup);
  };

  const manageablePosts = posts.filter(canManagePost);

  const resetForm = () => {
    setEditingId(null);
    setMsg("");
    clearForm();
    clearMediaItems();
  };

  const startEdit = (post) => {
    if (!canManagePost(post)) return;
    setEditingId(post.id);
    const isLiveStream = post.live_stream_id != null;
    setForm({
      title: post.title,
      description_markdown: post.description_markdown || "",
      group_ids: post.group_id ? [post.group_id] : [],
      publish_to_feed: !!(post.requested_feed || post.allowed_on_feed),
      publish_to_signage: !!(post.requested_signage || post.allowed_on_signage),
      status: post.status,
      device_ids: post.signage_deployments?.map((d) => d.device_id) || [],
      duration_seconds: post.signage_metadata?.duration_seconds || 10,
      start_date: post.signage_metadata?.start_date?.split(".")[0] || "",
      end_date: post.signage_metadata?.end_date?.split(".")[0] || "",
      priority: post.signage_metadata?.priority || 1,
      display_group: post.signage_metadata?.display_group || "",
      signage_state: post.signage_state || "NORMAL",
      is_enabled: post.signage_metadata?.is_enabled ?? true,
      play_order: post.signage_metadata?.play_order || 0,
      nocache: post.signage_metadata?.nocache ?? false,
      skip_asset_check: post.signage_metadata?.skip_asset_check ?? false,
      media_source: isLiveStream ? "live_stream" : "upload",
      live_stream_id: isLiveStream ? post.live_stream_id : null,
    });
    setMediaItems(
      (post.images || []).map((img) => ({
        image_path: img.image_path,
        media_type: img.media_type || "IMAGE",
        duration_seconds: img.duration_seconds,
        previewUrl: mediaSrc(img),
      })),
    );
    setMsg(`Editing: ${post.title}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (!editingId && mediaItems.length === 0 && !form.live_stream_id) {
        setMsg("❌ Add at least one image or video.");
        setLoading(false);
        return;
      }

      const fd = new FormData();
      const payload = { ...form };
      // Ensure group_ids is an array
      const rawGroupIds = Array.isArray(payload.group_ids) ? payload.group_ids : [];
      if (rawGroupIds.length === 0 && userRole !== "admin") {
        payload.group_ids = group_id ? [group_id] : [];
      }
      if (editingId) {
        // Editing: send single group_id
        fd.append("group_id", String(rawGroupIds[0] || group_id || ""));
      } else {
        // Creating: send group_ids array
        fd.append("group_ids", JSON.stringify(Array.isArray(payload.group_ids) ? payload.group_ids : rawGroupIds));
      }
      if (mediaItems.length > 0) {
        const videoDur = mediaItems.find((m) => m.media_type === "VIDEO")?.duration_seconds;
        if (videoDur && form.publish_to_signage) {
          payload.duration_seconds = videoDur;
        }
        fd.append(
          "processed_media",
          JSON.stringify(
            mediaItems.map(({ image_path, media_type, duration_seconds }) => ({
              image_path,
              media_type,
              duration_seconds,
            })),
          ),
        );
      }
      delete payload.group_ids;
      Object.entries(payload).forEach(([k, v]) => {
        if (v == null) return;
        fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v);
      });

      const saveOpts = mediaItems.length > 0 ? { timeout: 120000 } : {};

      if (editingId) {
        await postsApi.updatePost(editingId, fd, saveOpts);
        setMsg("✅ Post updated!");
      } else {
        const res = await postsApi.createPost(fd, saveOpts);
        const count = res.count || 1;
        setMsg(`✅ Created ${count} post${count > 1 ? "s" : ""} across ${count} group${count > 1 ? "s" : ""}!`);
      }
      resetForm();
      load();
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        (err.response?.status === 404
          ? "Save failed (404) — restart the backend and try again."
          : null) ||
        err.message ||
        "Failed to save post.";
      setMsg(`❌ ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete?")) return;
    const deleteSignage = confirm("Also remove this post from signage displays?");
    await postsApi.deletePost(id, deleteSignage);
    load();
  };

  const bulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    
    if ((action === 'add-signage' || action === 'add-both') && bulkDeviceIds.length === 0) {
      alert("Please select at least one display for bulk signage distribution.");
      return;
    }

    const msgMap = {
      'delete': 'Delete selected posts?',
      'remove-signage': 'Remove from signage?',
      'remove-feed': 'Remove from feed?',
      'add-feed': 'Publish selected to Feed?',
      'add-signage': 'Publish selected to Signage?',
      'add-both': 'Publish selected to Both?',
    };
    if (!confirm(msgMap[action] || `Confirm bulk ${action}?`)) return;
    
    setLoading(true);
    try {
      await postsApi.bulkAction({ 
        ids: selectedIds, 
        action,
        device_ids: bulkDeviceIds,
      });
      setSelectedIds([]);
      setBulkDeviceIds([]);
      load();
      setMsg(`✅ Bulk action ${action} successful.`);
    } catch {
      setMsg("❌ Bulk action failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const post = posts.find((p) => p.id === id);
    if (!canManagePost(post)) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === manageablePosts.length) setSelectedIds([]);
    else setSelectedIds(manageablePosts.map(p => p.id));
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>My Posts</h1>
        <p style={S.sub}>Create and manage your group's content.</p>

        <div
          style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24 }}
        >
          <PostForm
            form={form}
            onChange={setForm}
            editingId={editingId}
            onCancelEdit={resetForm}
            onSubmit={submit}
            loading={loading}
            msg={msg}
            mediaItems={mediaItems}
            onMediaChange={setMediaItems}
            groups={groups}
            devices={devices}
            userRole={userRole}
            groupId={group_id}
            managedGroupIds={managed_group_ids}
            signageStateOptions={signageStateOptions}
            maxSignageStateLabel={SIGNAGE_STATE_LABELS[max_signage_state]}
          />

          <PostList
            posts={posts}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            manageablePosts={manageablePosts}
            canManagePost={canManagePost}
            onEdit={startEdit}
            onDelete={del}
            filters={filters}
            onFilterChange={setFilters}
            onChannelFilterChange={onChannelFilterChange}
            devices={devices}
            groups={groups}
            userRole={userRole}
            groupId={group_id}
            managedGroupIds={managed_group_ids}
            groupCreators={groupCreators}
            bulkDeviceIds={bulkDeviceIds}
            onBulkDeviceChange={setBulkDeviceIds}
            onBulkAction={bulkAction}
            userId={userId}
          />
        </div>
      </main>
    </div>
  );
}
