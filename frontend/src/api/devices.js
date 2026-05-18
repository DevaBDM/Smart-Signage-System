import api from "./axios";

export const listDevices = (sortBy = "id", sortOrder = "asc") =>
  api.get(`/devices?sortBy=${sortBy}&sortOrder=${sortOrder}`).then((r) => r.data);

export const getDevice = (id) => api.get(`/devices/${id}`).then((r) => r.data);

export const registerDevice = (data) => api.post("/devices/register", data);

export const updateDevice = (id, data) => api.put(`/devices/${id}`, data);

export const resetDevice = (id) => api.put(`/devices/${id}/reset`);

export const removeDevice = (id) => api.delete(`/devices/${id}`);

export const approveDevice = (id, data) => api.post(`/devices/${id}/approve`, data);

export const rejectDevice = (id) => api.post(`/devices/${id}/reject`);
