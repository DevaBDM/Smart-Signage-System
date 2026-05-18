import MultiSelect from "./MultiSelect";
import * as S from "../styles";
import { messageStyle } from "../tokens";

export default function DeviceRegisterForm({
  form,
  onChange,
  onSubmit,
  groups,
  regMsg,
}) {
  const setField = (patch) => onChange({ ...form, ...patch });

  return (
    <div style={S.card}>
      <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Register Device</h2>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {regMsg && <div style={messageStyle(regMsg)}>{regMsg}</div>}
        <label style={S.label}>Device ID (from config.py)</label>
        <input
          style={S.input}
          type="number"
          value={form.id}
          onChange={(e) => setField({ id: e.target.value })}
          placeholder="e.g. 1, 2, 3"
        />
        <label style={S.label}>Device Name</label>
        <input
          style={S.input}
          value={form.device_name}
          onChange={(e) => setField({ device_name: e.target.value })}
          required
        />
        <label style={S.label}>IP Address</label>
        <input
          style={S.input}
          value={form.ip_address}
          onChange={(e) => setField({ ip_address: e.target.value })}
          required
        />
        <label style={S.label}>Location</label>
        <input
          style={S.input}
          value={form.location}
          onChange={(e) => setField({ location: e.target.value })}
        />
        <label style={S.label}>Primary Group</label>
        <select
          style={S.input}
          value={form.group_id}
          onChange={(e) => setField({ group_id: e.target.value })}
        >
          <option value="">— None —</option>
          {groups.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.all_groups}
            onChange={(e) => setField({ all_groups: e.target.checked })}
          />
          Belongs to all groups
        </label>
        {!form.all_groups && (
          <div>
            <label style={S.label}>Additional Groups</label>
            <MultiSelect
              options={groups.filter((g) => String(g.id) !== String(form.group_id))}
              value={form.group_ids.filter((id) => String(id) !== String(form.group_id))}
              onChange={(ids) => setField({ group_ids: ids })}
              placeholder="Search departments..."
            />
          </div>
        )}
        <button
          type="submit"
          style={{ ...S.btn, background: "#2563eb", color: "#fff" }}
        >
          Register
        </button>
      </form>
    </div>
  );
}
