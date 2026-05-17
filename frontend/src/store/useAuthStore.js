import { create } from "zustand";

const decodeToken = (token) => {
  if (!token) return {};
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
};

const storedToken = localStorage.getItem("token") || null;
const storedUser = decodeToken(storedToken);

const managedGroupIds = (user) => {
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
  } catch {}
  return managedGroupIds(storedUser);
};

const useAuthStore = create((set) => ({
  token: storedToken,
  id: storedUser.id || null,
  can_manage_other_posts: Boolean(storedUser.can_manage_other_posts),
  creator_priority: storedUser.creator_priority || 1,
  control_lock_minutes: storedUser.control_lock_minutes || 120,
  max_signage_state:
    localStorage.getItem("max_signage_state") ||
    storedUser.max_signage_state ||
    "NORMAL",
  role: localStorage.getItem("role") || null,
  group_id: localStorage.getItem("group_id") || null,
  managed_group_ids: readManagedGroups(),

  setAuth: (token, role, group_id, profile = {}) => {
    const user = decodeToken(token);
    const max_signage_state =
      profile.max_signage_state || user.max_signage_state || "NORMAL";
    const mgIds = managedGroupIds({ managed_group_ids: profile.managed_group_ids ?? user.managed_group_ids });
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("group_id", group_id ?? "");
    localStorage.setItem("max_signage_state", max_signage_state);
    localStorage.setItem("managed_group_ids", JSON.stringify(mgIds));
    set({
      token,
      id: user.id || null,
      can_manage_other_posts: Boolean(user.can_manage_other_posts),
      creator_priority: user.creator_priority || 1,
      control_lock_minutes: user.control_lock_minutes || 120,
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
      max_signage_state: "NORMAL",
      role: null,
      group_id: null,
      managed_group_ids: [],
    });
  },
}));

export default useAuthStore;
