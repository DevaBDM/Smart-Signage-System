import { createContext, useContext, useEffect } from "react";
import useAuthStore from "../store/useAuthStore";
import * as authApi from "../api/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const auth = useAuthStore();

  useEffect(() => {
    if (!auth.token) return;
    authApi.me()
      .then((data) => {
        const {
          role,
          group_id,
          max_signage_state,
          managed_group_ids,
          can_manage_other_posts,
          creator_priority,
          control_lock_minutes,
          auto_approve,
        } = data;
        auth.setAuth(auth.token, role, group_id, {
          max_signage_state,
          managed_group_ids,
          can_manage_other_posts,
          creator_priority,
          control_lock_minutes,
          auto_approve,
        });
      })
      .catch(() => {});
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const {
      token,
      role,
      group_id,
      max_signage_state,
      managed_group_ids,
      can_manage_other_posts,
      creator_priority,
      control_lock_minutes,
      auto_approve,
    } = res;
    auth.setAuth(token, role, group_id, {
      max_signage_state,
      managed_group_ids,
      can_manage_other_posts,
      creator_priority,
      control_lock_minutes,
      auto_approve,
    });
    return res;
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
