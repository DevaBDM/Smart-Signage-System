import MultiSelect from "./MultiSelect";
import PostMedia from "./PostMedia";
import { SIGNAGE_STATE_LABELS } from "../constants/signageStates";
import * as S from "../styles";

export default function PostList({
  posts,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  manageablePosts,
  canManagePost,
  onEdit,
  onDelete,
  filters,
  onFilterChange,
  onChannelFilterChange,
  devices,
  groups,
  userRole,
  groupId,
  managedGroupIds,
  groupCreators,
  bulkDeviceIds,
  onBulkDeviceChange,
  onBulkAction,
  userId,
}) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontWeight: 700 }}>Posts ({posts.length})</h2>
        <button
          onClick={onToggleAll}
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
            onChange={(e) => onFilterChange({ ...filters, group_id: e.target.value })}
          >
            <option value="">All groups</option>
            {userRole === "admin"
              ? groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              : [
                  ...(groupId ? [{ id: groupId, name: groups.find((g) => String(g.id) === String(groupId))?.name || "Primary" }] : []),
                  ...(managedGroupIds || []).map((gid) => {
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
              onChange={(e) => onFilterChange({ ...filters, device_id: e.target.value })}
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
            onChange={(e) => onFilterChange({ ...filters, creator_id: e.target.value })}
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
              onChange={onBulkDeviceChange}
              placeholder="Search displays..."
              labelKey="device_name"
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => onBulkAction('add-feed')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Feed</button>
            <button onClick={() => onBulkAction('add-signage')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Signage</button>
            <button onClick={() => onBulkAction('add-both')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>+ Both</button>
            <div style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 4px' }} />
            <button onClick={() => onBulkAction('remove-signage')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>- Signage</button>
            <button onClick={() => onBulkAction('remove-feed')} style={{ ...S.btn, background: '#fff', fontSize: 11, padding: '4px 8px' }}>- Feed</button>
            <button onClick={() => onBulkAction('delete')} style={{ ...S.btn, background: '#fee2e2', color: '#b91c1c', fontSize: 11, padding: '4px 8px' }}>🗑 Delete</button>
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
        {posts.map((p) => {
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
                onChange={() => onToggleSelect(p.id)}
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
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
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
                  onClick={() => onEdit(p)}
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
                  onClick={() => onDelete(p.id)}
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
        })}
      </div>
    </div>
  );
}
