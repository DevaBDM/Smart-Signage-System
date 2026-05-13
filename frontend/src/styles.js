// src/styles.js
export const layout = { display: "flex", minHeight: "100vh" };
export const main = {
  marginLeft: 220,
  flex: 1,
  padding: "32px 36px",
  background: "#f4f6f9",
  minHeight: "100vh",
};
export const heading = {
  fontSize: 24,
  fontWeight: 700,
  color: "#1a1a2e",
  marginBottom: 4,
};
export const sub = { fontSize: 13, color: "#6b7280", marginBottom: 28 };
export const card = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  marginBottom: 24,
};
export const table = { width: "100%", borderCollapse: "collapse" };
export const th = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  padding: "8px 12px",
  borderBottom: "2px solid #e5e7eb",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
export const td = {
  padding: "11px 12px",
  fontSize: 14,
  color: "#374151",
  borderBottom: "1px solid #f3f4f6",
};
export const btn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
export const input = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1.5px solid #d1d5db",
  fontSize: 14,
  background: "#f9fafb",
  width: "100%",
};
export const label = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 4,
};
export const badge = (color) => ({
  padding: "3px 10px",
  borderRadius: 99,
  fontSize: 12,
  fontWeight: 600,
  ...color,
});
