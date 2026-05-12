import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ContentManager from "./pages/ContentManager";
import DeviceMonitor from "./pages/DeviceMonitor";
import SensorLogs from "./pages/SensorLogs";
import PublicFeed from "./pages/PublicFeed";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/content"
        element={
          <ProtectedRoute>
            <ContentManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <DeviceMonitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sensors"
        element={
          <ProtectedRoute>
            <SensorLogs />
          </ProtectedRoute>
        }
      />
      <Route path="/feed" element={<PublicFeed />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
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
