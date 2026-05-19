/** 16:9 canvases tuned for wall TVs; export matches preview pixel size. */
export const TV_PRESETS = [
  { id: "hd", label: "HD 1280 × 720", w: 1280, h: 720 },
  { id: "fhd", label: "TV Full HD 1920 × 1080", w: 1920, h: 1080 },
];

export const FONTS = [
  "Impact",
  "Arial Black",
  "Arial",
  "Georgia",
  "Segoe UI",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
];

export const COLORS = [
  "#ffffff",
  "#000000",
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
];

export const BG_SWATCH = [...COLORS, "#0f172a", "#1e3a5f", "#064e3b", "#7f1d1d"];

export const MAX_PREVIEW_CSS_W = 920;

export function isTextLike(o) {
  return o && (o.type === "textbox" || o.type === "i-text" || o.type === "text");
}

export function getSelectionTargets(canvas) {
  if (!canvas) return [];
  const o = canvas.getActiveObject();
  if (!o) return [];
  if (o.type === "activeSelection" && typeof o.getObjects === "function") {
    return o.getObjects();
  }
  return [o];
}

export function canSetFill(o) {
  if (!o || o.type === "image" || o.type === "group") return false;
  return typeof o.set === "function";
}

export function canSetStroke(o) {
  if (!o || o.type === "image" || o.type === "group") return false;
  return typeof o.set === "function" && "stroke" in o;
}

/** HTML color inputs need #rrggbb (no alpha). */
export function colorPickerHex(c, fallback = "#ffffff") {
  if (typeof c !== "string" || !c.startsWith("#")) return fallback;
  const m = c.match(/^#([0-9a-fA-F]{6})/);
  return m ? `#${m[1]}` : fallback;
}
