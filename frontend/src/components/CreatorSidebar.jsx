import { Sidebar } from "./AdminSidebar";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/creator", label: "🏠 Dashboard" },
  { to: "/creator/posts", label: "📝 My Posts" },
  { to: "/creator/editor", label: "🎨 Designer" },
  { to: "/creator/signage", label: "🖥 Signage" },
];

export default function CreatorSidebar() {
  const { logout } = useAuth();
  return (
    <Sidebar links={links} role="Creator" logout={logout} color="#7c3aed" />
  );
}
