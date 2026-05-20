import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listLiveStreams() {
  const res = await axios.get(`${API_BASE}/live-streams`, { headers: authHeaders() });
  return res.data;
}

export async function getLiveStream(id) {
  const res = await axios.get(`${API_BASE}/live-streams/${id}`, { headers: authHeaders() });
  return res.data;
}

export async function createLiveStream(data) {
  const res = await axios.post(`${API_BASE}/live-streams`, data, { headers: authHeaders() });
  return res.data;
}

export async function updateLiveStream(id, data) {
  const res = await axios.put(`${API_BASE}/live-streams/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteLiveStream(id, force = false) {
  const res = await axios.delete(`${API_BASE}/live-streams/${id}?force=${force}`, { headers: authHeaders() });
  return res.data;
}

export async function startLiveStream(id) {
  const res = await axios.post(`${API_BASE}/live-streams/${id}/start`, {}, { headers: authHeaders() });
  return res.data;
}

export async function stopLiveStream(id) {
  const res = await axios.post(`${API_BASE}/live-streams/${id}/stop`, {}, { headers: authHeaders() });
  return res.data;
}
