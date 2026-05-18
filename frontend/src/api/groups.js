import api from "./axios";

export const listGroups = () => api.get("/groups").then((r) => r.data);

export const createGroup = (data) => api.post("/groups", data);

export const updateGroup = (id, changes) => api.put(`/groups/${id}`, changes);

export const deleteGroup = (id) => api.delete(`/groups/${id}`);
