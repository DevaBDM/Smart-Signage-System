import api from "./axios";

export const checkAIStatus = () =>
  api.get("/ai/status").then((r) => r.data);

export const askQuestion = (postId, question, history = [], signal) =>
  api.post("/ai/ask", { post_id: postId, question, history }, { signal }).then((r) => r.data);
