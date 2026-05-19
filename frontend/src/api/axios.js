import axios from "axios";
import { apiBaseUrl } from "../config/apiBase";
import useAuthStore from "../store/useAuthStore";

const api = axios.create({
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  config.baseURL = apiBaseUrl();
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
