import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "🏠 Dashboard" },
  { to: "/content", label: "🖼 Content Manager" },
  { to: "/devices", label: "📟 Devices" },
  { to: "/sensors", label: "📊 Sensor Logs" },
  { to: "/feed", label: "📰 Public Feed" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <span style={styles.brandIcon}>📡</span>
        <span style={styles.brandText}>Smart Signage</span>
      </div>

      <nav style={styles.nav}>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.link,
              background: isActive ? "#dbeafe" : "transparent",
              color: isActive ? "#1d4ed8" : "#374151",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.roleTag}>{user?.role?.replace("_", " ")}</div>
        <button onClick={logout} style={styles.logoutBtn}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 240,
    minHeight: "100vh",
    background: "#fff",
    borderRight: "1.5px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    position: "fixed",
    top: 0,
    left: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  brandIcon: { fontSize: 24 },
  brandText: { fontWeight: 700, fontSize: 16, color: "#1a1a2e" },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "16px 12px",
    flex: 1,
  },
  link: {
    display: "block",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 14,
    transition: "all 0.15s",
  },
  footer: { padding: "16px 20px", borderTop: "1px solid #e5e7eb" },
  roleTag: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "capitalize",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
};
