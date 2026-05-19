import { create } from "zustand";

const decodeToken = (token) => {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes));
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const storedToken = localStorage.getItem("token") || null;
const storedUser = decodeToken(storedToken);

// If token is expired/invalid on boot, purge stale localStorage
if (!storedUser && storedToken) {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("group_id");
  localStorage.removeItem("max_signage_state");
  localStorage.removeItem("managed_group_ids");
}

const managedGroupIds = (user) => {
  if (!user) return [];
  if (Array.isArray(user.managed_group_ids)) return user.managed_group_ids;
  try {
    return JSON.parse(user.managed_group_ids || "[]");
  } catch {
    return [];
  }
};

const readManagedGroups = () => {
  try {
    const raw = localStorage.getItem("managed_group_ids");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore malformed localStorage */
  }
  return managedGroupIds(storedUser);
};

const useAuthStore = create((set) => ({
  token: storedUser ? storedToken : null,
  id: storedUser?.id || null,
  can_manage_other_posts: Boolean(storedUser?.can_manage_other_posts),
  creator_priority: storedUser?.creator_priority || 1,
  control_lock_minutes: storedUser?.control_lock_minutes || 120,
  auto_approve: Boolean(storedUser?.auto_approve),
  max_signage_state:
    localStorage.getItem("max_signage_state") ||
    storedUser?.max_signage_state ||
    "NORMAL",
  role: localStorage.getItem("role") || null,
  group_id: localStorage.getItem("group_id") || null,
  managed_group_ids: readManagedGroups(),

  setAuth: (token, role, group_id, profile = {}) => {
    const user = decodeToken(token);
    const max_signage_state =
      profile.max_signage_state || user.max_signage_state || "NORMAL";
    const mgIds = managedGroupIds({ managed_group_ids: profile.managed_group_ids ?? user.managed_group_ids });
    // Prefer fresh profile fields (from /auth/me or /auth/login) over the
    // potentially stale values baked into the JWT at login time.
    const can_manage_other_posts = Boolean(
      profile.can_manage_other_posts ?? user.can_manage_other_posts,
    );
    const creator_priority =
      profile.creator_priority ?? user.creator_priority ?? 1;
    const control_lock_minutes =
      profile.control_lock_minutes ?? user.control_lock_minutes ?? 120;
    const auto_approve =
      profile.auto_approve ?? user.auto_approve ?? false;
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("group_id", group_id ?? "");
    localStorage.setItem("max_signage_state", max_signage_state);
    localStorage.setItem("managed_group_ids", JSON.stringify(mgIds));
    set({
      token,
      id: user.id || null,
      can_manage_other_posts,
      creator_priority,
      control_lock_minutes,
      auto_approve,
      max_signage_state,
      role,
      group_id,
      managed_group_ids: mgIds,
    });
  },

  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("group_id");
    localStorage.removeItem("max_signage_state");
    localStorage.removeItem("managed_group_ids");
    set({
      token: null,
      id: null,
      can_manage_other_posts: false,
      creator_priority: 1,
      control_lock_minutes: 120,
      auto_approve: false,
      max_signage_state: "NORMAL",
      role: null,
      group_id: null,
      managed_group_ids: [],
    });
  },
}));

export default useAuthStore;
