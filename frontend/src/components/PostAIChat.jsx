import { useState, useRef, useEffect } from "react";
import {
  MessageCircle, X, Send, Bot, User, Copy, Check, Square,
  GripVertical
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import api from "../api/axios";
import { checkAIStatus, askQuestion } from "../api/ai";

const MIN_W = 320;
const MAX_W = 900;
const MIN_H = 360;
const MAX_H = 900;

export default function PostAIChat({ postId, descriptionMarkdown, attachments = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dims, setDims] = useState({ w: 380, h: 520 });
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiChecking, setAiChecking] = useState(true);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const resizeRef = useRef({ dragging: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  const hasContext = !!(descriptionMarkdown || attachments.length > 0);

  useEffect(() => {
    let mounted = true;
    checkAIStatus()
      .then((s) => { if (mounted) setAiStatus(s); })
      .catch(() => { if (mounted) setAiStatus({ ok: false }); })
      .finally(() => { if (mounted) setAiChecking(false); });
    return () => { mounted = false; };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    const history = [...messages]; // conversation so far
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await askQuestion(postId, question, history, controller.signal);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      if (api.isCancel?.(err) || err.name === "CanceledError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Stopped." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't get an answer right now. Please try again.",
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // ignore
    }
  };

  const startResize = (e) => {
    e.preventDefault();
    resizeRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startW: dims.w,
      startH: dims.h,
    };
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeUp);
  };

  const onResizeMove = (e) => {
    const r = resizeRef.current;
    if (!r.dragging) return;
    const newW = Math.min(MAX_W, Math.max(MIN_W, r.startW - (e.clientX - r.startX)));
    const newH = Math.min(MAX_H, Math.max(MIN_H, r.startH - (e.clientY - r.startY)));
    setDims({ w: newW, h: newH });
  };

  const onResizeUp = () => {
    resizeRef.current.dragging = false;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasContext || aiChecking || !aiStatus?.ok) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={s.fab}
        title="Ask about this post"
      >
        <MessageCircle size={24} color="#fff" />
        <span style={s.fabLabel}>Ask Me</span>
      </button>
    );
  }

  return (
    <div style={s.overlay}>
      <style>{aiMarkdownCss}</style>
      <div style={{ ...s.panel, width: dims.w, height: dims.h }}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTitle}>
            <Bot size={20} color="#2563eb" />
            <span style={{ fontWeight: 600, color: "#1a1a2e" }}>Ask About This Post</span>
          </div>
          <button onClick={() => setIsOpen(false)} style={s.closeBtn}>
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.emptyState}>
              <Bot size={40} color="#d1d5db" />
              <p style={{ color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
                Ask me anything about this post!
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...s.messageRow,
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                position: "relative",
              }}
            >
              {msg.role === "assistant" && (
                <div style={s.avatar}>
                  <Bot size={16} color="#2563eb" />
                </div>
              )}
              <div
                style={{
                  ...s.messageBubble,
                  background: msg.role === "user" ? "#2563eb" : "#f3f4f6",
                  color: msg.role === "user" ? "#fff" : "#374151",
                  position: "relative",
                }}
              >
                {msg.role === "assistant" ? (
                  <div className="ai-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
                {/* Copy button */}
                <button
                  onClick={() => handleCopy(msg.content, i)}
                  title="Copy"
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    opacity: 0.4,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
                >
                  {copiedIdx === i ? (
                    <Check size={12} color={msg.role === "user" ? "#bfdbfe" : "#6b7280"} />
                  ) : (
                    <Copy size={12} color={msg.role === "user" ? "#bfdbfe" : "#6b7280"} />
                  )}
                </button>
              </div>
              {msg.role === "user" && (
                <div style={{ ...s.avatar, background: "#dbeafe" }}>
                  <User size={16} color="#2563eb" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ ...s.messageRow, justifyContent: "flex-start" }}>
              <div style={s.avatar}>
                <Bot size={16} color="#2563eb" />
              </div>
              <div style={{ ...s.messageBubble, background: "#f3f4f6", color: "#6b7280" }}>
                <span style={s.typing}>Thinking</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={s.inputArea}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            style={s.input}
          />
          {loading ? (
            <button
              onClick={handleStop}
              title="Stop"
              style={{ ...s.stopBtn }}
            >
              <Square size={14} color="#fff" fill="#fff" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                ...s.sendBtn,
                opacity: !input.trim() ? 0.5 : 1,
                cursor: !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              <Send size={18} color="#fff" />
            </button>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 20,
            height: 20,
            cursor: "nwse-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.4,
          }}
          title="Resize"
        >
          <GripVertical size={14} color="#9ca3af" />
        </div>
      </div>
    </div>
  );
}

const aiMarkdownCss = `
  .ai-markdown { font-size: 14px; line-height: 1.5; }
  .ai-markdown h1, .ai-markdown h2, .ai-markdown h3 {
    margin: 8px 0 4px; font-weight: 700; color: inherit;
  }
  .ai-markdown h1 { font-size: 1.15em; }
  .ai-markdown h2 { font-size: 1.05em; }
  .ai-markdown h3 { font-size: 0.95em; }
  .ai-markdown p { margin: 0 0 8px; }
  .ai-markdown ul, .ai-markdown ol { padding-left: 1.4em; margin: 4px 0; }
  .ai-markdown li { margin-bottom: 2px; }
  .ai-markdown code {
    background: rgba(0,0,0,0.06); padding: 2px 5px; border-radius: 4px;
    font-family: monospace; font-size: 0.9em;
  }
  .ai-markdown pre {
    background: rgba(0,0,0,0.06); padding: 8px 10px; border-radius: 8px;
    overflow-x: auto; margin: 6px 0;
  }
  .ai-markdown pre code { background: none; padding: 0; }
  .ai-markdown blockquote {
    border-left: 3px solid rgba(0,0,0,0.15); padding-left: 10px;
    margin: 6px 0; color: rgba(0,0,0,0.7);
  }
  .ai-markdown a { color: #2563eb; }
  .ai-markdown table {
    border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0;
  }
  .ai-markdown th, .ai-markdown td {
    border: 1px solid rgba(0,0,0,0.1); padding: 4px 8px; text-align: left;
  }
  .ai-markdown hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 8px 0; }
`;

const s = {
  fab: {
    position: "fixed",
    bottom: 24,
    right: 24,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#2563eb",
    border: "none",
    borderRadius: 50,
    padding: "14px 20px",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
    zIndex: 1000,
    transition: "transform 0.2s",
  },
  fabLabel: {
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
  },
  overlay: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 1000,
  },
  panel: {
    position: "relative",
    maxWidth: "calc(100vw - 48px)",
    maxHeight: "calc(100vh - 48px)",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  typing: {
    display: "inline-block",
    animation: "pulse 1.5s infinite",
  },
  inputArea: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  input: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#374151",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#2563eb",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#ef4444",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
  },
};
