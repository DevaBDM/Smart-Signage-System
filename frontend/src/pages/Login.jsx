import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Title */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>📡</div>
          <h1 style={styles.title}>Smart Signage</h1>
          <p style={styles.subtitle}>Admin Portal</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handle}
            required
            style={styles.input}
            placeholder="Enter username"
          />

          <label style={styles.label}>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handle}
            required
            style={styles.input}
            placeholder="Enter password"
          />

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #e8f0fe 0%, #f4f6f9 100%)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
  },
  logoArea: { textAlign: "center", marginBottom: 32 },
  logoIcon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a2e" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    outline: "none",
    transition: "border 0.2s",
    background: "#f9fafb",
  },
  btn: {
    marginTop: 8,
    padding: "12px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    transition: "background 0.2s",
  },
};
