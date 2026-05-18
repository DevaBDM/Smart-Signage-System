import api from "./axios";

export const publish = (data) => api.post("/signage/publish", data).then((r) => r.data);

export const getDeviceAssets = (deviceId) =>
  api.get(`/signage/devices/${deviceId}/assets`).then((r) => r.data);

export const controlDevice = (deviceId, payload) =>
  api.post(`/signage/devices/${deviceId}/control`, payload);

export const patchAsset = (deviceId, assetId, payload) =>
  api.patch(`/signage/devices/${deviceId}/assets/${assetId}`, payload);

export const deleteAsset = (deviceId, assetId) =>
  api.delete(`/signage/devices/${deviceId}/assets/${assetId}`);
