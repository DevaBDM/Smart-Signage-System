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
  role: localStorage.getItem("role") || null,
  department_id: localStorage.getItem("department_id") || null,

  setAuth: (token, role, department_id) => {
    const user = decodeToken(token);
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("department_id", department_id ?? "");
    set({ token, id: user.id || null, role, department_id });
  },

  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("department_id");
    set({ token: null, id: null, role: null, department_id: null });
  },
}));

export default useAuthStore;
