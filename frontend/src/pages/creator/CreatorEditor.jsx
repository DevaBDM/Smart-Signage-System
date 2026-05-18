import { useEffect, useRef, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import Designer from "../../components/Designer";
import MultiSelect from "../../components/MultiSelect";
import * as postsApi from "../../api/posts";
import * as groupsApi from "../../api/groups";
import * as devicesApi from "../../api/devices";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";
import usePersistentState, {
  userScopedKey,
} from "../../hooks/usePersistentState";
import SignagePanel from "../../components/SignagePanel";
import { messageStyle } from "../../tokens";
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
    userScopedKey("creator.editor.form", userId),
    emptyForm,
  );

  useEffect(() => {
    devicesApi.listDevices()
      .then(setDevices)
      .catch(() => {});
    groupsApi.listGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  const lastGroupIds = useRef("");
  const lastDeviceIds = useRef("");
  const devicesLoaded = useRef(false);

  useEffect(() => {
    if (devices.length > 0) devicesLoaded.current = true;
  }, [devices.length]);

  // group_ids → device_ids
  useEffect(() => {
    if (!devicesLoaded.current) return;
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
    if (!devicesLoaded.current) return;
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
      const rawGroupIds = Array.isArray(payload.group_ids) ? payload.group_ids : [];
      if (rawGroupIds.length === 0 && userRole !== "admin") {
        payload.group_ids = group_id ? [group_id] : [];
      }
      fd.append("group_ids", JSON.stringify(Array.isArray(payload.group_ids) ? payload.group_ids : rawGroupIds));
      Object.entries(payload).forEach(([key, value]) => {
        if (key === "group_ids") return;
        fd.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
      });
      fd.append("images", exported.file);
      const res = await postsApi.createPost(fd);
      const count = res.count || 1;
      setMsg(`✅ Design saved to My Posts (${count} group${count > 1 ? "s" : ""}).`);
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
          <div style={{ ...S.card, padding: "10px 14px", ...messageStyle(msg) }}>
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
                  <SignagePanel
                    form={form}
                    onChange={setForm}
                    devices={devices}
                    signageStateOptions={signageStateOptions}
                    maxSignageStateLabel={SIGNAGE_STATE_LABELS[max_signage_state]}
                  />
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
