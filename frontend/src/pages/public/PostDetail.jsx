import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BASE = API.replace("/api", "");

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/posts/${id}`)
      .then((r) => setPost(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.center}>Loading...</div>;
  if (!post)
    return (
      <div style={s.center}>
        Post not found.{" "}
        <button
          onClick={() => navigate("/feed")}
          style={{
            color: "#2563eb",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ← Back to Feed
        </button>
      </div>
    );

  const images = post.images || [];

  return (
    <div style={s.page}>
      {/* Nav */}
      <div style={s.nav}>
        <button onClick={() => navigate("/feed")} style={s.backBtn}>
          ← Back to Feed
        </button>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          {new Date(post.created_at).toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <div style={s.container}>
        {/* Image Carousel */}
        {images.length > 0 && (
          <div style={s.carousel}>
            <img
              src={`${BASE}${images[imgIdx].image_path}`}
              alt={post.title}
              style={s.carouselImg}
            />
            {images.length > 1 && (
              <div style={s.carouselControls}>
                <button
                  onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                  style={s.arrowBtn}
                  disabled={imgIdx === 0}
                >
                  ‹
                </button>
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {imgIdx + 1} / {images.length}
                </span>
                <button
                  onClick={() =>
                    setImgIdx((i) => Math.min(images.length - 1, i + 1))
                  }
                  style={s.arrowBtn}
                  disabled={imgIdx === images.length - 1}
                >
                  ›
                </button>
              </div>
            )}
            {images.length > 1 && (
              <div style={s.dots}>
                {images.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setImgIdx(i)}
                    style={{
                      ...s.dot,
                      background: i === imgIdx ? "#2563eb" : "#d1d5db",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div style={s.content}>
          <h1 style={s.title}>{post.title}</h1>
          {post.description_markdown ? (
            <div style={s.markdown}>
              <ReactMarkdown>{post.description_markdown}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
              No description provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f4f6f9" },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    fontSize: 16,
    color: "#6b7280",
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 36px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  container: { maxWidth: 820, margin: "36px auto", padding: "0 24px" },
  carousel: {
    background: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    marginBottom: 24,
  },
  carouselImg: {
    width: "100%",
    maxHeight: 460,
    objectFit: "contain",
    background: "#1a1a2e",
    display: "block",
  },
  carouselControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: "12px",
  },
  arrowBtn: {
    background: "#f3f4f6",
    border: "none",
    borderRadius: 8,
    padding: "6px 16px",
    fontSize: 20,
    cursor: "pointer",
    fontWeight: 700,
  },
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 12,
  },
  dot: { width: 8, height: 8, borderRadius: "50%", cursor: "pointer" },
  content: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 32px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  title: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", marginBottom: 20 },
  markdown: { fontSize: 15, lineHeight: 1.7, color: "#374151" },
};
