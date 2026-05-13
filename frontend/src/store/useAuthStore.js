import { create } from "zustand";

const useAuthStore = create((set) => ({
  token: localStorage.getItem("token") || null,
  role: localStorage.getItem("role") || null,
  department_id: localStorage.getItem("department_id") || null,

  setAuth: (token, role, department_id) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("department_id", department_id ?? "");
    set({ token, role, department_id });
  },

  clearAuth: () => {
    localStorage.clear();
    set({ token: null, role: null, department_id: null });
  },
}));

export default useAuthStore;
