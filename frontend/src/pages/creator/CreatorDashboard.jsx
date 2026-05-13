import { useEffect, useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import api from "../../api/axios";
import useAuthStore from "../../store/useAuthStore";
import * as S from "../../styles";

export default function CreatorDashboard() {
  const { department_id } = useAuthStore();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api
      .get(`/posts?department_id=${department_id}`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  }, []);

  const feed = posts.filter((p) => p.publish_to_feed);
  const signage = posts.filter((p) => p.publish_to_signage);

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Creator Dashboard</h1>
        <p style={S.sub}>Your department content overview.</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {[
            {
              icon: "📝",
              label: "Total Posts",
              value: posts.length,
              color: "#7c3aed",
            },
            {
              icon: "📰",
              label: "On Feed",
              value: feed.length,
              color: "#2563eb",
            },
            {
              icon: "🖥",
              label: "On Signage",
              value: signage.length,
              color: "#16a34a",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                ...S.card,
                borderTop: `4px solid ${s.color}`,
                textAlign: "center",
                marginBottom: 0,
              }}
            >
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h2 style={{ fontWeight: 700, marginBottom: 14 }}>Recent Posts</h2>
          {posts.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 24 }}>
              No posts yet. Go to My Posts to create one.
            </p>
          )}
          {posts.slice(0, 5).map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontWeight: 500 }}>{p.title}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {new Date(p.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
