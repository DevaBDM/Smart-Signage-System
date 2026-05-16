import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import { assetOrigin } from "../../config/apiBase";
import usePersistentState from "../../hooks/usePersistentState";

const BASE = assetOrigin();

export default function CreatorPosts() {
  const { id: userId, department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeviceIds, setBulkDeviceIds] = usePersistentState("creator.posts.bulkDeviceIds", []);
  const emptyForm = {
    title: "",
    description_markdown: "",
    publish_to_feed: false,
    publish_to_signage: false,
    status: "draft",
    device_ids: [],
    duration_seconds: 10,
    start_date: "",
    end_date: "",
    priority: 1,
    display_group: "",
  };
  const [form, setForm, clearForm] = usePersistentState("creator.posts.form", emptyForm);
  const [filters, setFilters] = usePersistentState("creator.posts.filters", {
    channel: "all",
    device_id: "",
    creator_id: "",
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef();

  const load = () => {
    const params = new URLSearchParams();
    if (department_id) params.set("department_id", department_id);
    if (filters.channel !== "all") params.set("channel", filters.channel);
    if (filters.device_id) params.set("device_id", filters.device_id);
    if (filters.creator_id) params.set("creator_id", filters.creator_id);
    return api
      .get(`/posts?${params.toString()}`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
  }, [department_id, filters.channel, filters.creator_id, filters.device_id]);

  const sameDepartmentCreators = Array.from(
    new Map(
      posts
        .filter((p) => p.author)
        .map((p) => [p.author.id, p.author]),
    ).values(),
  );

  const manageablePosts = posts.filter((p) => p.author?.id === userId);

  const resetForm = () => {
    setEditingId(null);
    setMsg("");
    clearForm();
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (post) => {
    if (post.author?.id !== userId) return;
    setEditingId(post.id);
    setForm({
      title: post.title,
      description_markdown: post.description_markdown || "",
      publish_to_feed: !!(post.requested_feed || post.allowed_on_feed),
      publish_to_signage: !!(post.requested_signage || post.allowed_on_signage),
      status: post.status,
      device_ids: post.signage_deployments?.map((d) => d.device_id) || [],
      duration_seconds: post.signage_metadata?.duration_seconds || 10,
      start_date: post.signage_metadata?.start_date?.split(".")[0] || "",
      end_date: post.signage_metadata?.end_date?.split(".")[0] || "",
      priority: post.signage_metadata?.priority || 1,
      display_group: post.signage_metadata?.display_group || "",
    });
    setMsg(`Editing: ${post.title}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries({ ...form, department_id }).forEach(([k, v]) =>
        fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v),
      );
      files.forEach((f) => fd.append("images", f));

      if (editingId) {
        await api.put(`/posts/${editingId}`, fd);
        setMsg("✅ Post updated!");
      } else {
        await api.post("/posts", fd);
        setMsg("✅ Post created!");
      }
      resetForm();
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Failed to save post.");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete?")) return;
    const deleteSignage = confirm("Also remove this post from signage displays?");
    await api.delete(`/posts/${id}`, {
      params: { delete_signage: deleteSignage },
    });
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
      await api.post("/posts/bulk-action", { 
        ids: selectedIds, 
        action,
        device_ids: bulkDeviceIds 
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
    if (post?.author?.id !== userId) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === manageablePosts.length) setSelectedIds([]);
    else setSelectedIds(manageablePosts.map(p => p.id));
  };

  const toggleDevice = (id) => {
    const deviceId = Number(id);
    setForm((current) => ({
      ...current,
      device_ids: current.device_ids.includes(deviceId)
        ? current.device_ids.filter((x) => x !== deviceId)
        : [...current.device_ids, deviceId],
    }));
  };

  const toggleBulkDevice = (id) => {
    const deviceId = Number(id);
    setBulkDeviceIds(prev => prev.includes(deviceId) ? prev.filter(x => x !== deviceId) : [...prev, deviceId]);
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>My Posts</h1>
        <p style={S.sub}>Create and manage your department's content.</p>

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

              <label style={S.label}>{editingId ? "Replace Image (optional)" : "Images"}</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles([...e.target.files])}
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
                  <label style={S.label}>Target Displays</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {devices.map((d) => (
                      <label
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.device_ids.includes(d.id)}
                          onChange={() => toggleDevice(d.id)}
                        />
                        {d.device_name} ({d.status})
                      </label>
                    ))}
                  </div>

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
                Type
                <select
                  style={{ ...S.input, marginTop: 4 }}
                  value={filters.channel}
                  onChange={(e) =>
                    setFilters({ ...filters, channel: e.target.value })
                  }
                >
                  <option value="all">All posts</option>
                  <option value="feed">Feed-only posts</option>
                  <option value="signage">Signage-only posts</option>
                </select>
              </label>
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
              <label style={{ ...S.label, marginBottom: 0 }}>
                Creator
                <select
                  style={{ ...S.input, marginTop: 4 }}
                  value={filters.creator_id}
                  onChange={(e) =>
                    setFilters({ ...filters, creator_id: e.target.value })
                  }
                >
                  <option value="">All same-department creators</option>
                  {sameDepartmentCreators.map((creator) => (
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {devices.map(d => (
                      <label key={d.id} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={bulkDeviceIds.includes(d.id)} onChange={() => toggleBulkDevice(d.id)} />
                        {d.device_name}
                      </label>
                    ))}
                  </div>
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
                    disabled={!isOwnPost}
                    style={{ width: 16, height: 16 }}
                    title={isOwnPost ? "Select post" : "Only the creator can manage this post"}
                  />
                  {p.images?.[0] ? (
                    <img
                      src={`${BASE}${p.images[0].image_path}`}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
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
                        {!isOwnPost ? " · view only" : ""}
                      </div>
                    )}
                    <div
                      style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}
                    >
                      {p.allowed_on_feed ? "📰 Feed " : ""}
                      {p.allowed_on_signage ? `🖥 Signage (${p.signage_deployments?.length || 0})` : ""} · {p.status}
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
                      disabled={!isOwnPost}
                      style={{
                        ...S.btn,
                        opacity: isOwnPost ? 1 : 0.45,
                        padding: "5px 10px",
                        flexShrink: 0,
                      }}
                      title={isOwnPost ? "Edit post" : "Only the creator can edit this post"}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => del(p.id)}
                      disabled={!isOwnPost}
                      style={{
                        ...S.btn,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        opacity: isOwnPost ? 1 : 0.45,
                        padding: "5px 10px",
                        flexShrink: 0,
                      }}
                      title={isOwnPost ? "Delete post" : "Only the creator can delete this post"}
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
