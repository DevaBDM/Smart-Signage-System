/** API prefix for axios (ends with `/api`). In dev, Vite proxies `/api` to the backend. */
export function apiBaseUrl() {
  if (import.meta.env.DEV) return "/api";
  const v = import.meta.env.VITE_API_URL?.trim();
  if (v) {
    const u = v.replace(/\/+$/, "");
    return u.endsWith("/api") ? u : `${u}/api`;
  }
  const port = import.meta.env.VITE_API_PORT || "5000";
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
  }
  return `http://localhost:${port}/api`;
}

/** Origin for `/uploads/...` in production; empty in dev (same origin as the dev server). */
export function assetOrigin() {
  if (import.meta.env.DEV) return "";
  const v = import.meta.env.VITE_API_URL?.trim();
  if (v) return v.replace(/\/+$/, "").replace(/\/api\/?$/, "");
  const port = import.meta.env.VITE_API_PORT || "5000";
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://localhost:${port}`;
}
