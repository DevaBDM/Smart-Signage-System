import MediaUploadField from "./MediaUploadField";
import SignagePanel from "./SignagePanel";
import { Card, Message } from "./ui";
import * as S from "../styles";

export default function PostForm({
  form,
  onChange,
  editingId,
  onCancelEdit,
  onSubmit,
  loading,
  msg,
  mediaItems,
  onMediaChange,
  groups,
  devices,
  userRole,
  groupId,
  managedGroupIds,
  signageStateOptions,
  maxSignageStateLabel,
}) {
  const setField = (patch) => onChange({ ...form, ...patch });

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 700 }}>{editingId ? "Edit Post" : "New Post"}</h2>
        {editingId && (
          <button onClick={onCancelEdit} style={{ ...S.btn, padding: '4px 8px', fontSize: 12 }}>Cancel Edit</button>
        )}
      </div>
      {msg && <Message text={msg} />}
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {editingId && (userRole === "admin" || groupId) ? (
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
          onChange={(e) => setField({ title: e.target.value })}
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
          onChange={(e) => setField({ description_markdown: e.target.value })}
          placeholder="## Announcement&#10;Write your **markdown** here..."
        />

        <MediaUploadField
          label={editingId ? "Media (add or replace)" : "Images & videos"}
          items={mediaItems}
          onChange={onMediaChange}
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
              onChange={(e) => setField({ publish_to_feed: e.target.checked })}
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
                setField({
                  publish_to_signage: checked,
                  ...(checked ? {} : { device_ids: [] }),
                });
              }}
            />
            Mark as Signage Ready
          </label>
        </div>

        {form.publish_to_signage && (
          <SignagePanel
            form={form}
            onChange={onChange}
            devices={devices}
            groups={groups}
            userRole={userRole}
            groupId={groupId}
            managedGroupIds={managedGroupIds}
            signageStateOptions={signageStateOptions}
            maxSignageStateLabel={maxSignageStateLabel}
            showGroups
          />
        )}

        <label style={S.label}>Post Status</label>
        <select
          style={{ ...S.input, background: form.status === 'published' ? '#dcfce7' : '#fff' }}
          value={form.status}
          onChange={(e) => setField({ status: e.target.value })}
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
    </Card>
  );
}
