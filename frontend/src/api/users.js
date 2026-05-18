import api from "./axios";

export const listUsers = () => api.get("/users").then((r) => r.data);

export const registerUser = (data) => api.post("/auth/register", data);

export const updateUser = (id, changes) => api.put(`/users/${id}`, changes);

export const deleteUser = (id) => api.delete(`/users/${id}`);
