import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Droplets } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export function LoginPage() {
  const { login, token } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "admin@smartwater.local", password: "AdminPass123", rememberMe: false });
  const [error, setError] = useState("");

  if (token) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await login(form.email, form.password, form.rememberMe);
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials or API unavailable.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-3 text-primary">
          <Droplets size={28} />
          <div>
            <h1 className="text-xl font-semibold">Smart Water Map</h1>
            <p className="text-sm text-black/60">Operational login</p>
          </div>
        </div>
        <label className="mb-3 block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="mb-4 block text-sm font-medium">
          Password
          <input type="password" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <label className="mb-4 flex items-center gap-2 text-sm font-medium text-black/70">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-black/20 text-primary"
            checked={form.rememberMe}
            onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
          />
          Remember me for 7 days
        </label>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white" type="submit">Sign in</button>
      </form>
    </main>
  );
}
