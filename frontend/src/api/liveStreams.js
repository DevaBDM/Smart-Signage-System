import api from "./axios";

export async function listLiveStreams() {
  const res = await api.get("/live-streams");
  return res.data;
}

export async function getLiveStream(id) {
  const res = await api.get(`/live-streams/${id}`);
  return res.data;
}

export async function createLiveStream(data) {
  const res = await api.post("/live-streams", data);
  return res.data;
}

export async function updateLiveStream(id, data) {
  const res = await api.put(`/live-streams/${id}`, data);
  return res.data;
}

export async function deleteLiveStream(id, force = false) {
  const res = await api.delete(`/live-streams/${id}?force=${force}`);
  return res.data;
}

export async function startLiveStream(id) {
  const res = await api.post(`/live-streams/${id}/start`);
  return res.data;
}

export async function stopLiveStream(id) {
  const res = await api.post(`/live-streams/${id}/stop`);
  return res.data;
}

export async function rotateStreamKey(id) {
  const res = await api.post(`/live-streams/${id}/rotate-key`);
  return res.data;
}

export async function getLiveStreamLogs(id, limit = 100) {
  const res = await api.get(`/live-streams/${id}/logs?limit=${limit}`);
  return res.data;
}

export async function uploadLiveStreamThumbnail(id, file) {
  const formData = new FormData();
  formData.append("thumbnail", file);
  const res = await api.post(`/live-streams/${id}/thumbnail`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
