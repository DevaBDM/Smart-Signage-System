import axios from "axios";
import { apiBaseUrl } from "../config/apiBase";

const api = axios.create({
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  config.baseURL = apiBaseUrl();
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
