import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import MultiSelect from "../../components/MultiSelect";
import MediaUploadField from "../../components/MediaUploadField";
import PostMedia, { mediaSrc } from "../../components/PostMedia";
import * as postsApi from "../../api/posts";
import * as devicesApi from "../../api/devices";
import * as groupsApi from "../../api/groups";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import usePersistentState, {
  userScopedKey,
} from "../../hooks/usePersistentState";
import SignageStateSelect from "../../components/SignageStateSelect";
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
      if (!editingId && mediaItems.length === 0) {
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
      Object.entries(payload).forEach(([k, v]) =>
        fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v),
      );

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
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700 }}>{editingId ? "Edit Post" : "New Post"}</h2>
              {editingId && (
                <button onClick={resetForm} style={{ ...S.btn, padding: '4px 8px', fontSize: 12 }}>Cancel Edit</button>
              )}
            </div>
            {msg && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
                }}
              >
                {msg}
              </div>
            )}
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {editingId && (userRole === "admin" || group_id) ? (
                <>
                  <label style={S.label}>Group</label>
                  {(() => {
                    const current = groups.find((g) => String(g.id) === String(form.group_ids?.[0]));
                    return <input style={{ ...S.input, background: "#f3f4f6" }} value={current?.name || "—"} disabled />;
                  })()}
                </>
              ) : null}

              <label style={S.label}>Title</label>
              <input
                style={S.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label style={S.label}>Description (Markdown)</label>
              <textarea
                style={{
                  ...S.input,
                  minHeight: 100,
                  resize: "vertical",
                  fontFamily: "monospace",
                }}
                value={form.description_markdown}
                onChange={(e) =>
                  setForm({ ...form, description_markdown: e.target.value })
                }
                placeholder="## Announcement&#10;Write your **markdown** here..."
              />

              <MediaUploadField
                label={editingId ? "Media (add or replace)" : "Images & videos"}
                items={mediaItems}
                onChange={setMediaItems}
                max={10}
              />

              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_feed}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_feed: e.target.checked })
                    }
                  />
                  Publish to Feed
                </label>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.publish_to_signage}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm({
                        ...form,
                        publish_to_signage: checked,
                        ...(checked ? {} : { device_ids: [] }),
                      });
                    }}
                  />
                  Mark as Signage Ready
                </label>
              </div>
              
              {form.publish_to_signage && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                  }}
                >
                  {userRole === "admin" || group_id ? (
                    <>
                      <label style={S.label}>Groups</label>
                      {(() => {
                        const available = userRole === "admin"
                          ? groups
                          : [
                              ...(group_id ? [{ id: group_id, name: groups.find((g) => String(g.id) === String(group_id))?.name || "Primary" }] : []),
                              ...(managed_group_ids || []).map((gid) => {
                                const g = groups.find((x) => String(x.id) === String(gid));
                                return g ? { id: g.id, name: g.name } : null;
                              }).filter(Boolean),
                            ];
                        return available.length <= 1 ? (
                          <input style={{ ...S.input, background: "#f3f4f6" }} value={available[0]?.name || ""} disabled />
                        ) : (
                          <MultiSelect
                            options={available}
                            value={form.group_ids || []}
                            onChange={(ids) => setForm({ ...form, group_ids: ids })}
                            placeholder="Select groups..."
                          />
                        );
                      })()}
                    </>
                  ) : null}

                  <label style={S.label}>Target Displays</label>
                  <MultiSelect
                    options={devices}
                    value={form.device_ids}
                    onChange={(ids) => setForm((current) => ({ ...current, device_ids: ids }))}
                    placeholder="Search displays..."
                    labelKey="device_name"
                  />

                  <SignageStateSelect
                    label="Signage priority level"
                    value={form.signage_state}
                    options={signageStateOptions}
                    hint={`Your account may post up to ${SIGNAGE_STATE_LABELS[max_signage_state] || "Normal"}.`}
                    onChange={(signage_state) =>
                      setForm({ ...form, signage_state })
                    }
                  />

                  <label style={S.label}>Duration (seconds)</label>
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
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />

                  <label style={S.label}>Display Group (optional)</label>
                  <input
                    style={S.input}
                    value={form.display_group}
                    onChange={(e) =>
                      setForm({ ...form, display_group: e.target.value })
                    }
                  />

                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.is_enabled}
                      onChange={(e) =>
                        setForm({ ...form, is_enabled: e.target.checked })
                      }
                    />
                    Enabled (is_enabled)
                  </label>

                  <label style={S.label}>Play Order</label>
                  <input
                    style={S.input}
                    type="number"
                    min={0}
                    value={form.play_order}
                    onChange={(e) =>
                      setForm({ ...form, play_order: Number(e.target.value) })
                    }
                  />

                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.nocache}
                      onChange={(e) =>
                        setForm({ ...form, nocache: e.target.checked })
                      }
                    />
                    No Cache (nocache)
                  </label>

                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.skip_asset_check}
                      onChange={(e) =>
                        setForm({ ...form, skip_asset_check: e.target.checked })
                      }
                    />
                    Skip Asset Check
                  </label>
                </div>
              )}

              <label style={S.label}>Post Status</label>
              <select
                style={{...S.input, background: form.status === 'published' ? '#dcfce7' : '#fff'}}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>

              <button
                type="submit"
                style={{
                  ...S.btn,
                  background: editingId ? "#2563eb" : "#7c3aed",
                  color: "#fff",
                  marginTop: 4,
                }}
                disabled={loading}
              >
                {loading ? "Saving..." : editingId ? "Update Post" : "Save Post"}
              </button>
            </form>
          </div>

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontWeight: 700 }}>Posts ({posts.length})</h2>
              <button
                onClick={toggleAll}
                disabled={manageablePosts.length === 0}
                style={{ ...S.btn, padding: '4px 8px', fontSize: 12 }}
              >
                {selectedIds.length === manageablePosts.length && manageablePosts.length > 0 ? "Deselect All" : "Select Mine"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 14,
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <label style={{ ...S.label, marginBottom: 0 }}>
                Group
                <select
                  style={{ ...S.input, marginTop: 4 }}
                  value={filters.group_id}
                  onChange={(e) =>
                    setFilters({ ...filters, group_id: e.target.value })
                  }
                >
                  <option value="">All groups</option>
                  {userRole === "admin"
                    ? groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))
                    : [
                        ...(group_id ? [{ id: group_id, name: groups.find((g) => String(g.id) === String(group_id))?.name || "Primary" }] : []),
                        ...(managed_group_ids || []).map((gid) => {
                          const g = groups.find((x) => String(x.id) === String(gid));
                          return g ? { id: g.id, name: g.name } : null;
                        }).filter(Boolean),
                      ].map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                </select>
              </label>
              <label style={{ ...S.label, marginBottom: 0 }}>
                Type
                <select
                  style={{ ...S.input, marginTop: 4 }}
                  value={filters.channel}
                  onChange={(e) => onChannelFilterChange(e.target.value)}
                >
                  <option value="all">All posts</option>
                  <option value="feed">Feed-only posts</option>
                  <option value="signage">Signage-only posts</option>
                </select>
              </label>
              {filters.channel !== "feed" ? (
                <label style={{ ...S.label, marginBottom: 0 }}>
                  Signage system
                  <select
                    style={{ ...S.input, marginTop: 4 }}
                    value={filters.device_id}
                    onChange={(e) =>
                      setFilters({ ...filters, device_id: e.target.value })
                    }
                  >
                    <option value="">All displays</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.device_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div />
              )}
              <label style={{ ...S.label, marginBottom: 0 }}>
                Creator
                <select
                  style={{ ...S.input, marginTop: 4 }}
                  value={filters.creator_id}
                  onChange={(e) =>
                    setFilters({ ...filters, creator_id: e.target.value })
                  }
                >
                  <option value="">All creators in group</option>
                  {groupCreators.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.username}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedIds.length > 0 && (
              <div style={{ padding: 12, background: '#f3f4f6', borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{selectedIds.length} items selected:</div>
                
                <div style={{ marginBottom: 10, borderBottom: '1px solid #d1d5db', paddingBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6 }}>Target Displays (for Add/Remove Signage):</div>
                  <MultiSelect
                    options={devices}
                    value={bulkDeviceIds}
                    onChange={setBulkDeviceIds}
                    placeholder="Search displays..."
                    labelKey="device_name"
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button onClick={() => bulkAction('add-feed')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Feed</button>
                  <button onClick={() => bulkAction('add-signage')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Signage</button>
                  <button onClick={() => bulkAction('add-both')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Both</button>
                  <div style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 4px' }} />
                  <button onClick={() => bulkAction('remove-signage')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>- Signage</button>
                  <button onClick={() => bulkAction('remove-feed')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>- Feed</button>
                  <button onClick={() => bulkAction('delete')} style={{ ...S.btn, background: '#fee2e2', color: '#b91c1c', fontSize: 11, padding: '4px 8px' }}>🗑 Delete</button>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 600,
                overflowY: "auto",
              }}
            >
              {posts.map((p) => (
                (() => {
                  const isOwnPost = p.author?.id === userId;
                  const canManage = canManagePost(p);
                  return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    disabled={!canManage}
                    style={{ width: 16, height: 16 }}
                    title={canManage ? "Select post" : "Admin approval is required to manage this post"}
                  />
                  {p.images?.[0] ? (
                    <PostMedia
                      item={p.images[0]}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                      videoProps={{ style: { width: 56, height: 56 } }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: "#f3f4f6",
                        borderRadius: 8,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      📋
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.title}
                    </div>
                    {p.author && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        By: {p.author.username}
                        {!canManage ? " · view only" : !isOwnPost ? " · approved to manage" : ""}
                      </div>
                    )}
                    <div
                      style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}
                    >
                      {p.group?.name ? `🏢 ${p.group.name} · ` : ""}
                      {p.allowed_on_feed ? "📰 Feed " : ""}
                      {p.allowed_on_signage ? `🖥 Signage (${p.signage_deployments?.length || 0})` : ""}
                      {p.signage_state ? ` · ${SIGNAGE_STATE_LABELS[p.signage_state] || p.signage_state}` : ""}
                      {" · "}
                      {p.status}
                      {p.status === 'published' && (
                        <>
                          {(!p.allowed_on_feed && p.requested_feed) && " · ⏳ Feed Pending"}
                          {(!p.allowed_on_signage && p.requested_signage) && " · ⏳ Signage Pending"}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => startEdit(p)}
                      disabled={!canManage}
                      style={{
                        ...S.btn,
                        opacity: canManage ? 1 : 0.45,
                        padding: "5px 10px",
                        flexShrink: 0,
                      }}
                      title={canManage ? "Edit post" : "Admin approval is required to edit this post"}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => del(p.id)}
                      disabled={!canManage}
                      style={{
                        ...S.btn,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        opacity: canManage ? 1 : 0.45,
                        padding: "5px 10px",
                        flexShrink: 0,
                      }}
                      title={canManage ? "Delete post" : "Admin approval is required to delete this post"}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
