import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import PostMedia from "../../components/PostMedia";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  const fetchFeed = () =>
    api
      .get("/posts", { params: { feed: true } })
      .then((r) => setPosts(r.data))
      .catch(() => setPosts([]));

  useEffect(() => {
    fetchFeed().finally(() => setLoading(false));
    const clock = setInterval(() => setTime(new Date()), 1000);
    const refresh = setInterval(() => {
      fetchFeed();
    }, 60000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const filtered = posts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 26 }}>📡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e" }}>
              Smart Signage
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Campus Information Feed
            </div>
          </div>
        </div>
        <div style={s.headerActions}>
          <button onClick={() => navigate("/login")} style={s.loginBtn}>
            Login
          </button>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#2563eb",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {time.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {time.toLocaleDateString([], {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </header>

      <div style={s.searchBar}>
        <input
          style={s.search}
          placeholder="🔍  Search announcements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <main style={{ flex: 1, padding: "28px 36px" }}>
        {loading && <p style={s.empty}>Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p style={s.empty}>No announcements found.</p>
        )}
        <div style={s.grid}>
          {filtered.map((p) => (
            <article
              key={p.id}
              onClick={() => navigate(`/post/${p.id}`)}
              style={s.card}
            >
              {p.images?.[0] || p.live_stream ? (
                <PostMedia
                  item={p.images?.[0]}
                  alt={p.title}
                  style={s.img}
                  preview
                  streamUrl={p.live_stream?.relay_url}
                />
              ) : (
                <div style={s.imgPlaceholder}>📋</div>
              )}
              <div style={s.cardBody}>
                <h2 style={s.cardTitle}>{p.title}</h2>
                {p.images?.length > 1 && (
                  <div style={s.imgCount}>🖼 {p.images.length} images</div>
                )}
                <div style={s.cardMeta}>
                  🕒{" "}
                  {new Date(p.created_at).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: 14,
          fontSize: 12,
          color: "#9ca3af",
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        Auto-refreshes every 60 seconds · Smart Digital Signage System
      </footer>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f9",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#fff",
    borderBottom: "1.5px solid #e5e7eb",
    padding: "18px 36px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  loginBtn: {
    border: "1.5px solid #2563eb",
    borderRadius: 8,
    background: "#fff",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 14px",
  },
  searchBar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "14px 36px",
    display: "flex",
    gap: 16,
    alignItems: "center",
  },
  search: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#f9fafb",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  img: { width: "100%", height: 170, objectFit: "cover" },
  imgPlaceholder: {
    height: 170,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 40,
    background: "#f3f4f6",
  },
  cardBody: { padding: "14px 16px" },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 6,
  },
  imgCount: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  empty: { textAlign: "center", color: "#9ca3af", padding: 48, fontSize: 15 },
};
