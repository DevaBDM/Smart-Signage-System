import MultiSelect from "./MultiSelect";
import SignageStateSelect from "./SignageStateSelect";
import { SIGNAGE_STATE_LABELS } from "../constants/signageStates";
import * as S from "../styles";

export default function SignagePanel({
  form,
  onChange,
  devices,
  groups = [],
  userRole,
  groupId,
  managedGroupIds = [],
  signageStateOptions,
  maxSignageStateLabel,
  showGroups = false,
}) {
  const setField = (patch) => onChange({ ...form, ...patch });

  return (
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
      {showGroups && (userRole === "admin" || groupId) ? (
        <>
          <label style={S.label}>Groups</label>
          {(() => {
            const available =
              userRole === "admin"
                ? groups
                : [
                    ...(groupId
                      ? [
                          {
                            id: groupId,
                            name:
                              groups.find((g) => String(g.id) === String(groupId))?.name ||
                              "Primary",
                          },
                        ]
                      : []),
                    ...(managedGroupIds || [])
                      .map((gid) => {
                        const g = groups.find((x) => String(x.id) === String(gid));
                        return g ? { id: g.id, name: g.name } : null;
                      })
                      .filter(Boolean),
                  ];
            return available.length <= 1 ? (
              <input
                style={{ ...S.input, background: "#f3f4f6" }}
                value={available[0]?.name || ""}
                disabled
              />
            ) : (
              <MultiSelect
                options={available}
                value={form.group_ids || []}
                onChange={(ids) => setField({ group_ids: ids })}
                placeholder="Select groups..."
              />
            );
          })()}
        </>
      ) : null}

      <label style={S.label}>Target Displays</label>
      <MultiSelect
        options={devices}
        value={form.device_ids || []}
        onChange={(ids) => setField({ device_ids: ids })}
        placeholder="Search displays..."
        labelKey="device_name"
      />

      <SignageStateSelect
        label="Signage priority level"
        value={form.signage_state}
        options={signageStateOptions}
        hint={`Your account may post up to ${maxSignageStateLabel || "Normal"}.`}
        onChange={(signage_state) => setField({ signage_state })}
      />

      <label style={S.label}>Duration (seconds)</label>
      <input
        style={S.input}
        type="number"
        min={1}
        max={300}
        value={form.duration_seconds}
        onChange={(e) => setField({ duration_seconds: Number(e.target.value) })}
      />

      <label style={S.label}>Priority (1 = highest)</label>
      <input
        style={S.input}
        type="number"
        min={1}
        max={10}
        value={form.priority}
        onChange={(e) => setField({ priority: Number(e.target.value) })}
      />

      <label style={S.label}>Start Date (optional)</label>
      <input
        style={S.input}
        type="datetime-local"
        value={form.start_date}
        onChange={(e) => setField({ start_date: e.target.value })}
      />

      <label style={S.label}>End Date (optional)</label>
      <input
        style={S.input}
        type="datetime-local"
        value={form.end_date}
        onChange={(e) => setField({ end_date: e.target.value })}
      />

      <label style={S.label}>Display Group (optional)</label>
      <input
        style={S.input}
        value={form.display_group}
        onChange={(e) => setField({ display_group: e.target.value })}
      />

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
          checked={form.is_enabled}
          onChange={(e) => setField({ is_enabled: e.target.checked })}
        />
        Enabled (is_enabled)
      </label>

      <label style={S.label}>Play Order</label>
      <input
        style={S.input}
        type="number"
        min={0}
        value={form.play_order}
        onChange={(e) => setField({ play_order: Number(e.target.value) })}
      />

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
          checked={form.nocache}
          onChange={(e) => setField({ nocache: e.target.checked })}
        />
        No Cache (nocache)
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
          checked={form.skip_asset_check}
          onChange={(e) => setField({ skip_asset_check: e.target.checked })}
        />
        Skip Asset Check
      </label>
    </div>
  );
}
