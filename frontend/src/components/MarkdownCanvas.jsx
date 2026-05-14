import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkWikiLink from "remark-wiki-link";

const CANVAS_W = 1280;
const CANVAS_H = 720;

export default function MarkdownCanvas({ markdown, markdownRef, fontSize = 32, fontFamily = "Inter" }) {
  const content = markdown || "# New Document\nWrite your announcement here...";

  // Standard Obsidian-style colors/icons
  const CustomBlockquote = ({ children }) => {
    const textContent = children[1]?.props?.children?.[0] || "";
    const match = String(textContent).match(/^\[!(INFO|NOTE|WARNING|ERROR|SUCCESS|TIP|IMPORTANT|TODO)\]/i);
    
    if (match) {
      const type = match[1].toUpperCase();
      const cleanChildren = [...children];
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
          borderLeft: `12px solid ${style.border}`,
          padding: "20px 30px",
          borderRadius: "0 15px 15px 0",
          margin: "24px 0",
        }}>
          <div style={{ fontWeight: 800, color: style.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, fontSize: "1.2em" }}>
            <span>{style.icon}</span> {type}
          </div>
          <div style={{ color: "#374151" }}>{cleanChildren}</div>
        </div>
      );
    }
    return <blockquote className="classic-quote">{children}</blockquote>;
  };

  return (
    <div 
      ref={markdownRef}
      className="markdown-canvas-container"
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "#ffffff",
        padding: "60px 80px",
        overflow: "hidden",
        color: "#000000",
        boxSizing: "border-box",
        textAlign: "left"
      }}
    >
      <style>{`
        .markdown-body { 
          font-family: '${fontFamily}', -apple-system, system-ui, sans-serif; 
          font-size: ${fontSize}px; 
          line-height: 1.6; 
        }
        .markdown-body h1 { font-size: 3.5em; border-bottom: 3px solid #eaecef; padding-bottom: 0.3em; margin-bottom: 1rem; font-weight: 800; }
        .markdown-body h2 { font-size: 2.5em; margin-top: 1.5rem; border-bottom: 2px solid #eaecef; font-weight: 700; }
        .markdown-body p { margin-bottom: 1rem; }
        .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 1rem; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85em; }
        .markdown-body table th, .markdown-body table td { border: 2px solid #dfe2e5; padding: 12px 20px; }
        .markdown-body table th { background: #f6f8fa; }
        .classic-quote { border-left: 12px solid #dfe2e5; padding: 15px 30px; color: #6a737d; background: #f9fafb; font-style: italic; border-radius: 0 10px 10px 0; }
        .katex { font-size: 1.1em; }
        .katex-display { margin: 1em 0; overflow: hidden; }
      `}</style>
      <div className="markdown-body">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath, remarkWikiLink]} 
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          components={{
            blockquote: CustomBlockquote
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
