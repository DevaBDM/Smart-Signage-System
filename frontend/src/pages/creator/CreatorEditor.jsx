import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import Designer from "../../components/Designer";
import MultiSelect from "../../components/MultiSelect";
import api from "../../api/axios";
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

export default function CreatorEditor() {
  const { id: userId, group_id, managed_group_ids, role: userRole, max_signage_state } = useAuthStore();
  const signageStateOptions = creatorSignageStateOptions(max_signage_state);
  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [exported, setExported] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const emptyForm = {
    title: "",
    description_markdown: "",
    group_id: userRole === "admin" ? "" : (group_id || ""),
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
    userScopedKey("creator.editor.form", userId),
    emptyForm,
  );

  useEffect(() => {
    api
      .get("/devices")
      .then((r) => setDevices(r.data))
      .catch(() => {});
    api
      .get("/groups")
      .then((r) => setGroups(r.data))
      .catch(() => {});
  }, []);

  const handleExport = (file, previewUrl) => {
    setExported({ file, previewUrl });
    setForm((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
    }));
    setMsg("");
  };

  const savePost = async (e) => {
    e.preventDefault();
    if (!exported?.file) {
      setMsg("❌ Export a design first.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      const payload = { ...form };
      if (!payload.group_id && userRole !== "admin") {
        payload.group_id = group_id;
      }
      Object.entries(payload).forEach(([key, value]) => {
        fd.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
      });
      fd.append("images", exported.file);
      await api.post("/posts", fd);
      setMsg("✅ Design saved to My Posts.");
      setExported(null);
      clearForm();
    } catch (e) {
      setMsg(e.response?.data?.error || "❌ Could not save design.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Signage slide designer</h1>
        <p style={S.sub}>
          Lay out slides in HD or full HD for wall TVs, then export and save them to My Posts for feed or
          signage playback.
        </p>

        {msg && (
          <div
            style={{
              ...S.card,
              padding: "10px 14px",
              background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
              border: `1.5px solid ${msg.startsWith("✅") ? "#86efac" : "#fecaca"}`,
              color: msg.startsWith("✅") ? "#166534" : "#b91c1c",
            }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 360px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={S.card}>
            <Designer onExport={handleExport} />
          </div>

          <div style={S.card}>
            <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Save Design</h2>
            {!exported && (
              <p style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.5 }}>
                Click &quot;Use this slide&quot; after editing, then fill in title and save as a post.
              </p>
            )}
            {exported && (
              <form
                onSubmit={savePost}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {userRole === "admin" || (managed_group_ids || []).length > 0 ? (
                  <>
                    <label style={S.label}>Group</label>
                    <select
                      style={S.input}
                      value={form.group_id}
                      onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    >
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
                  </>
                ) : null}
                <img
                  src={exported.previewUrl}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    borderRadius: 8,
                    background: "#f3f4f6",
                  }}
                />

                <label style={S.label}>Title</label>
                <input
                  style={S.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />

                <label style={S.label}>Description</label>
                <textarea
                  style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                  value={form.description_markdown}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description_markdown: e.target.value,
                    })
                  }
                />

                <label style={S.label}>Status</label>
                <select
                  style={S.input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>

                <label style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.publish_to_feed}
                    onChange={(e) =>
                      setForm({ ...form, publish_to_feed: e.target.checked })
                    }
                  />
                  Publish to Feed
                </label>

                <label style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.publish_to_signage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        publish_to_signage: e.target.checked,
                      })
                    }
                  />
                  Mark as Signage Ready
                </label>

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

                    <label style={S.label}>Priority</label>
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

                    <label style={S.label}>Start Date</label>
                    <input
                      style={S.input}
                      type="datetime-local"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />

                    <label style={S.label}>End Date</label>
                    <input
                      style={S.input}
                      type="datetime-local"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />

                    <label style={S.label}>Display Group</label>
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

                <button
                  type="submit"
                  disabled={saving}
                  style={{ ...S.btn, background: "#7c3aed", color: "#fff" }}
                >
                  {saving ? "Saving..." : "Save to My Posts"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
