import { createContext, useContext } from "react";
import useAuthStore from "../store/useAuthStore";
import api from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const auth = useAuthStore();

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { token, role, group_id, max_signage_state, managed_group_ids } = res.data;
    auth.setAuth(token, role, group_id, { max_signage_state, managed_group_ids });
    return res.data;
  };

  const logout = () => {
    auth.clearAuth();
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
