import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/useAuthStore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { token, role, department_id } = res.data;
    setAuth(token, role, department_id);
    // Route to correct dashboard by role
    if (role === "admin") navigate("/admin");
    else if (role === "creator") navigate("/creator");
    else navigate("/feed");
  };

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
