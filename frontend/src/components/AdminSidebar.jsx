import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/admin", label: "🏠 Dashboard" },
  { to: "/admin/devices", label: "📟 Devices" },
  { to: "/admin/users", label: "👥 Users" },
  { to: "/admin/groups", label: "🏫 Groups" },
  { to: "/admin/posts", label: "🖼 Posts" },
  { to: "/admin/playlists", label: "📋 Playlists" },
  { to: "/admin/logs", label: "📊 Logs" },
];

export default function AdminSidebar() {
  const { logout } = useAuth();
  return <Sidebar links={links} role="Admin" logout={logout} color="#2563eb" />;
}

export function Sidebar({ links, role, logout, color }) {
  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <span style={{ fontSize: 22 }}>📡</span>
        <div>
          <div style={s.brandName}>Smart Signage</div>
          <div style={{ ...s.roleTag, color }}>{role}</div>
        </div>
      </div>
      <nav style={s.nav}>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to.split("/").length === 2}
            style={({ isActive }) => ({
              ...s.link,
              background: isActive ? `${color}18` : "transparent",
              color: isActive ? color : "#374151",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={s.footer}>
        <button onClick={logout} style={s.logoutBtn}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: "#fff",
    borderRight: "1.5px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  brandName: { fontWeight: 700, fontSize: 15, color: "#1a1a2e" },
  roleTag: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "12px 8px",
  },
  link: {
    display: "block",
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 13,
    transition: "all 0.15s",
    textDecoration: "none",
  },
  footer: { padding: "16px", borderTop: "1px solid #e5e7eb" },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
