// src/styles.js — composed from design tokens
import { colors, spacing, radii, fontSize, shadows } from "./tokens";

export const layout = { display: "flex", minHeight: "100vh" };
export const main = {
  marginLeft: 220,
  flex: 1,
  padding: spacing.page.h,
  background: colors.bg.page,
  minHeight: "100vh",
};
export const heading = {
  fontSize: fontSize.xl,
  fontWeight: 700,
  color: colors.text.heading,
  marginBottom: spacing.xs,
};
export const sub = {
  fontSize: fontSize.md,
  color: colors.text.secondary,
  marginBottom: spacing.xxxl,
};
export const card = {
  background: colors.bg.card,
  borderRadius: radii.xl,
  padding: spacing.xxl,
  boxShadow: shadows.card,
  marginBottom: spacing.xxl,
};
export const table = { width: "100%", borderCollapse: "collapse" };
export const th = {
  textAlign: "left",
  fontSize: fontSize.xs,
  fontWeight: 700,
  color: colors.text.secondary,
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderBottom: `2px solid ${colors.border.light}`,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
export const td = {
  padding: "11px 12px",
  fontSize: fontSize.lg,
  color: colors.text.body,
  borderBottom: `1px solid ${colors.bg.disabled}`,
};
export const btn = {
  padding: "8px 16px",
  borderRadius: radii.md,
  border: "none",
  fontSize: fontSize.md,
  fontWeight: 600,
  cursor: "pointer",
};
export const input = {
  padding: "9px 12px",
  borderRadius: radii.md,
  border: `1.5px solid ${colors.border.medium}`,
  fontSize: fontSize.lg,
  background: colors.bg.subtle,
  width: "100%",
};
export const label = {
  fontSize: fontSize.md,
  fontWeight: 600,
  color: colors.text.body,
  display: "block",
  marginBottom: spacing.xs,
};
export const badge = (color) => ({
  padding: "3px 10px",
  borderRadius: radii.pill,
  fontSize: fontSize.sm,
  fontWeight: 600,
  ...color,
});

export const messageStyle = (msg) => ({
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radii.md,
  marginBottom: spacing.md,
  fontSize: fontSize.md,
  background: msg.startsWith("✅")
    ? colors.success.bg
    : msg.startsWith("⚠️")
      ? colors.warning.bg
      : colors.error.bg,
  color: msg.startsWith("✅")
    ? colors.success.text
    : msg.startsWith("⚠️")
      ? colors.warning.text
      : colors.error.text,
});

export const statusBadge = (status) => ({
  fontSize: fontSize.sm,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: radii.pill,
  marginTop: spacing.xs,
  display: "inline-block",
  background: status === "online" ? colors.success.bg : colors.error.bg,
  color: status === "online" ? colors.success.strong : colors.error.strong,
});
