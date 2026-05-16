import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuthStore from "./store/useAuthStore";

// Auth
import Login from "./pages/Login";

// Public
import Feed from "./pages/public/Feed";
import PostDetail from "./pages/public/PostDetail";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminGroups from "./pages/admin/AdminGroups";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminPlaylists from "./pages/admin/AdminPlaylists";
import AdminLogs from "./pages/admin/AdminLogs";

// Creator
import CreatorDashboard from "./pages/creator/CreatorDashboard";
import CreatorPosts from "./pages/creator/CreatorPosts";
import CreatorEditor from "./pages/creator/CreatorEditor";
import CreatorSignage from "./pages/creator/CreatorSignage";

function RequireRole({ role, children }) {
  const { token, role: userRole } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role && userRole !== role) return <Navigate to="/feed" replace />;
  return children;
}

function AppRoutes() {
  const { token, role } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={role === "admin" ? "/admin" : "/creator"} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/feed" element={<Feed />} />
      <Route path="/post/:id" element={<PostDetail />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/admin/devices"
        element={
          <RequireRole role="admin">
            <AdminDevices />
          </RequireRole>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireRole role="admin">
            <AdminUsers />
          </RequireRole>
        }
      />
      <Route
        path="/admin/groups"
        element={
          <RequireRole role="admin">
            <AdminGroups />
          </RequireRole>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <RequireRole role="admin">
            <AdminPosts />
          </RequireRole>
        }
      />
      <Route
        path="/admin/playlists"
        element={
          <RequireRole role="admin">
            <AdminPlaylists />
          </RequireRole>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <RequireRole role="admin">
            <AdminLogs />
          </RequireRole>
        }
      />

      {/* Creator */}
      <Route
        path="/creator"
        element={
          <RequireRole role="creator">
            <CreatorDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/creator/posts"
        element={
          <RequireRole role="creator">
            <CreatorPosts />
          </RequireRole>
        }
      />
      <Route
        path="/creator/editor"
        element={
          <RequireRole role="creator">
            <CreatorEditor />
          </RequireRole>
        }
      />
      <Route
        path="/creator/signage"
        element={
          <RequireRole role="creator">
            <CreatorSignage />
          </RequireRole>
        }
      />

      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
