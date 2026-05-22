import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkWikiLink from "remark-wiki-link";
import api from "../../api/axios";
import PostMedia from "../../components/PostMedia";
import PostAIChat from "../../components/PostAIChat";
import "katex/dist/katex.min.css"; // For LaTeX math

// Custom renderer for Obsidian Callouts
const CustomBlockquote = ({ children }) => {
  const content = children[1]?.props?.children?.[0] || "";
  const match = String(content).match(/^\[!(INFO|NOTE|WARNING|ERROR|SUCCESS|TIP|IMPORTANT|TODO)\]/i);
  
  if (match) {
    const type = match[1].toUpperCase();
    const cleanChildren = [...children];
    // Remove the [!TYPE] marker from the first paragraph
    if (cleanChildren[1]?.props?.children) {
      cleanChildren[1] = {
        ...cleanChildren[1],
        props: {
          ...cleanChildren[1].props,
          children: cleanChildren[1].props.children.slice(1)
        }
      };
    }
    
    const colors = {
      INFO: { bg: "#e0f2fe", border: "#0ea5e9", color: "#0369a1", icon: "ℹ️" },
      NOTE: { bg: "#f3f4f6", border: "#6b7280", color: "#374151", icon: "📝" },
      WARNING: { bg: "#fef3c7", border: "#f59e0b", color: "#b45309", icon: "⚠️" },
      ERROR: { bg: "#fee2e2", border: "#ef4444", color: "#b91c1c", icon: "❌" },
      SUCCESS: { bg: "#dcfce7", border: "#22c55e", color: "#15803d", icon: "✅" },
      TIP: { bg: "#f0fdf4", border: "#10b981", color: "#166534", icon: "💡" },
      IMPORTANT: { bg: "#f5f3ff", border: "#8b5cf6", color: "#6d28d9", icon: "🔥" },
    };
    const style = colors[type] || colors.INFO;

    return (
      <div style={{
        background: style.bg,
        borderLeft: `4px solid ${style.border}`,
        padding: "12px 16px",
        borderRadius: "0 8px 8px 0",
        margin: "16px 0",
      }}>
        <div style={{ fontWeight: 700, color: style.color, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{style.icon}</span> {type}
        </div>
        <div style={{ color: "#374151" }}>{cleanChildren}</div>
      </div>
    );
  }
  return <blockquote style={s.classicQuote}>{children}</blockquote>;
};

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/posts/${id}`)
      .then((r) => setPost(r.data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.center}>Loading...</div>;
  if (!post) {
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
  }

  const images = post.images || [];

  return (
    <div style={s.page}>
      <style>{markdownCss}</style>
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
        {(images.length > 0 || post.live_stream) && (
          <div style={s.carousel}>
            <PostMedia
              item={images[imgIdx]}
              alt={post.title}
              style={s.carouselImg}
              videoProps={{ style: s.carouselImg, controls: true }}
              streamUrl={post.live_stream?.relay_url}
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
            <div className="markdown-body">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkMath, remarkWikiLink]} 
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                  blockquote: CustomBlockquote
                }}
              >
                {post.description_markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
              No description provided.
            </p>
          )}
        </div>
      </div>

      <PostAIChat postId={post.id} descriptionMarkdown={post.description_markdown} />
    </div>
  );
}

const markdownCss = `
  .markdown-body {
    font-size: 15px;
    line-height: 1.7;
    color: #374151;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3 {
    margin-top: 24px;
    margin-bottom: 12px;
    font-weight: 700;
    color: #111827;
  }
  .markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  .markdown-body h2 { font-size: 1.4em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  .markdown-body p { margin-bottom: 16px; }
  .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 16px; }
  .markdown-body li { margin-bottom: 4px; }
  .markdown-body table {
    border-spacing: 0;
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 16px;
    overflow-x: auto;
    display: block;
  }
  .markdown-body table th, .markdown-body table td {
    padding: 8px 14px;
    border: 1px solid #dfe2e5;
  }
  .markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
  .markdown-body code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27,31,35,0.05);
    border-radius: 6px;
    font-family: monospace;
  }
  .markdown-body pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .markdown-body pre code {
    background: none;
    padding: 0;
  }
  .markdown-body img { max-width: 100%; box-sizing: content-box; background-color: #fff; }
  .markdown-body hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
  .markdown-body input[type="checkbox"] { margin-right: 8px; vertical-align: middle; }
  
  /* LaTeX centering */
  .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; }
`;

const s = {
  classicQuote: {
    padding: "10px 20px",
    color: "#6a737d",
    borderLeft: "0.25em solid #dfe2e5",
    margin: "0 0 16px 0",
    background: "#f9fafb",
  },
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
