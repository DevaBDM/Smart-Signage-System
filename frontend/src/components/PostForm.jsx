import { useRef, useState } from "react";
import { FileUp, X, FileText, Trash2 } from "lucide-react";
import MediaUploadField from "./MediaUploadField";
import LiveStreamPicker from "./LiveStreamPicker";
import SignagePanel from "./SignagePanel";
import { Card, Message } from "./ui";
import * as S from "../styles";

const fmtBytes = (b) => {
  if (!b || b < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

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
  attachments = [],
  attachmentLoading = false,
  onAttachmentUpload,
  onAttachmentDelete,
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

        {/* Attachments */}
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 10, padding: 14, background: "#f9fafb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <FileUp size={18} color="#6b7280" />
            <span style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>
              Attachments
            </span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {editingId ? "PDF, Word, Excel, etc. (max 5)" : "Save post first to add attachments"}
            </span>
          </div>

          {editingId && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 10 }}>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length && onAttachmentUpload) onAttachmentUpload(files);
                  e.target.value = "";
                }}
              />
              <span style={{ ...S.btn, padding: "6px 12px", fontSize: 13 }}>
                {attachmentLoading ? "Uploading..." : "Add Files"}
              </span>
            </label>
          )}

          {attachments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                    <FileText size={18} color="#2563eb" />
                    <span
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 220,
                      }}
                      title={att.file_name}
                    >
                      {att.file_name}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                      {fmtBytes(att.file_size)}
                    </span>
                  </div>
                  {editingId && onAttachmentDelete && (
                    <button
                      onClick={() => onAttachmentDelete(att.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                      title="Remove"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
          <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="media_source"
              checked={form.media_source !== "live_stream"}
              onChange={() => setField({ media_source: "upload", live_stream_id: null })}
            />
            Upload media
          </label>
          <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="media_source"
              checked={form.media_source === "live_stream"}
              onChange={() => setField({ media_source: "live_stream" })}
            />
            Use live stream
          </label>
        </div>

        {form.media_source === "live_stream" ? (
          <LiveStreamPicker
            value={form.live_stream_id}
            onChange={(val) => setField({ live_stream_id: val })}
            groupId={form.group_ids?.[0]}
          />
        ) : (
          <MediaUploadField
            label={editingId ? "Media (add or replace)" : "Images & videos"}
            items={mediaItems}
            onChange={onMediaChange}
            max={10}
          />
        )}

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
