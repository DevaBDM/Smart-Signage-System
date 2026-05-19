// Design tokens — single source of truth for colors, spacing, radii, typography

export const colors = {
  primary: "#2563eb",
  purple: "#7c3aed",
  success: { bg: "#dcfce7", text: "#166534", strong: "#16a34a" },
  error: { bg: "#fee2e2", text: "#b91c1c", strong: "#dc2626" },
  warning: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  info: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },

  border: { light: "#e5e7eb", medium: "#d1d5db", strong: "#93c5fd", warning: "#fcd34d" },
  bg: {
    page: "#f4f6f9",
    card: "#fff",
    subtle: "#f9fafb",
    disabled: "#f3f4f6",
    highlight: "#eff6ff",
  },
  text: {
    heading: "#1a1a2e",
    body: "#374151",
    secondary: "#6b7280",
    muted: "#9ca3af",
    dark: "#4b5563",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  page: { h: "32px 36px" },
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 99,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 14,
  xl: 24,
};

export const shadows = {
  card: "0 1px 6px rgba(0,0,0,0.07)",
};
