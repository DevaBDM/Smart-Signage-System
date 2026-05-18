import api from "./axios";

export const listPlaylists = () => api.get("/playlists").then((r) => r.data);

export const createPlaylist = (data) => api.post("/playlists", data);

export const deletePlaylist = (id) => api.delete(`/playlists/${id}`);
