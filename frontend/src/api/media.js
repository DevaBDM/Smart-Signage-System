import api from "./axios";

export const processMedia = (formData) =>
  api.post("/media/process", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 600000,
  });
