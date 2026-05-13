import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuthStore from "./store/useAuthStore";

// Auth
import Login from "./pages/Login";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminPlaylists from "./pages/admin/AdminPlaylists";
import AdminLogs from "./pages/admin/AdminLogs";

// Creator
import CreatorDashboard from "./pages/creator/CreatorDashboard";
import CreatorPosts from "./pages/creator/CreatorPosts";
import CreatorEditor from "./pages/creator/CreatorEditor";
import CreatorSignage from "./pages/creator/CreatorSignage";

// Public
import Feed from "./pages/public/Feed";
import PostDetail from "./pages/public/PostDetail";

function RequireRole({ role, children }) {
  const { token, role: userRole } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { token, role } = useAuthStore();

  return (
    <Routes>
      {/* Public */}
      <Route path="/feed" element={<Feed />} />
      <Route path="/post/:id" element={<PostDetail />} />

      {/* Auth */}
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={role === "admin" ? "/admin" : "/creator"} />
          ) : (
            <Login />
          )
        }
      />

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
        path="/admin/departments"
        element={
          <RequireRole role="admin">
            <AdminDepartments />
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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/feed" />} />
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
