import { SIGNAGE_STATE_LABELS } from "../constants/signageStates";
import * as S from "../styles";

export default function SignageStateSelect({
  value,
  onChange,
  options,
  label = "Signage priority level",
  hint,
  disabled = false,
}) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <select
        style={S.input}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label ?? SIGNAGE_STATE_LABELS[opt.value] ?? opt.value}
          </option>
        ))}
      </select>
      {hint ? (
        <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{hint}</p>
      ) : null}
    </div>
  );
}
