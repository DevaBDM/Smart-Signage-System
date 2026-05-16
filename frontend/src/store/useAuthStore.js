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

const useAuthStore = create((set) => ({
  token: storedToken,
  id: storedUser.id || null,
  can_manage_other_posts: Boolean(storedUser.can_manage_other_posts),
  creator_priority: storedUser.creator_priority || 1,
  control_lock_minutes: storedUser.control_lock_minutes || 120,
  role: localStorage.getItem("role") || null,
  group_id: localStorage.getItem("group_id") || null,

  setAuth: (token, role, group_id) => {
    const user = decodeToken(token);
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("group_id", group_id ?? "");
    set({
      token,
      id: user.id || null,
      can_manage_other_posts: Boolean(user.can_manage_other_posts),
      creator_priority: user.creator_priority || 1,
      control_lock_minutes: user.control_lock_minutes || 120,
      role,
      group_id,
    });
  },

  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("group_id");
    set({
      token: null,
      id: null,
      can_manage_other_posts: false,
      creator_priority: 1,
      control_lock_minutes: 120,
      role: null,
      group_id: null,
    });
  },
}));

export default useAuthStore;
