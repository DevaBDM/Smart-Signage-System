import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import api from "../api/axios";

export default function PostAIChat({ postId, descriptionMarkdown }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await api.post("/ai/ask", {
        post_id: postId,
        question,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't get an answer right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      <div style={s.panel}>
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
                }}
              >
                {msg.content}
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              ...s.sendBtn,
              opacity: !input.trim() || loading ? 0.5 : 1,
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
            }}
          >
            <Send size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

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
    width: 380,
    maxWidth: "calc(100vw - 48px)",
    height: 520,
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
  },
};
