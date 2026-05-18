import api from "./axios";

export const listPosts = (params) => api.get("/posts", { params }).then((r) => r.data);

export const listPostsForGroups = async (groupIds) => {
  const all = [];
  for (const gid of groupIds) {
    try {
      const r = await api.get(`/posts?group_id=${gid}`);
      all.push(...(r.data || []));
    } catch {
      /* ignore group fetch errors */
    }
  }
  return all;
};

export const createPost = (data, opts = {}) => api.post("/posts", data, opts).then((r) => r.data);

export const updatePost = (id, data, opts = {}) =>
  api.put(`/posts/${id}`, data, opts).then((r) => r.data);

export const deletePost = (id, deleteSignage = false) =>
  api.delete(`/posts/${id}`, { params: { delete_signage: deleteSignage } });

export const bulkAction = (payload) => api.post("/posts/bulk-action", payload);

export const togglePostField = (post, field) =>
  api.put(`/posts/${post.id}`, { [field]: !post[field] });
