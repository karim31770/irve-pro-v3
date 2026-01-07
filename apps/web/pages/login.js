import { useState } from "react";

function apiBase() {
  // En prod: on passe par Nginx -> /api
  return "/api";
}

export default function Login() {
  const [email, setEmail] = useState("admin@demo.fr");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("tenants", JSON.stringify(data.tenants || []));

      // auto-select si 1 seul tenant
      if ((data.tenants || []).length === 1) {
        localStorage.setItem("tenantId", data.tenants[0].id);
      }

      window.location.href = "/app";
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24, maxWidth: 520 }}>
      <h1>Connexion</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)}
                 style={{ width: "100%", padding: 10 }} />
        </label>

        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 style={{ width: "100%", padding: 10 }} />
        </label>

        <button disabled={loading} style={{ padding: 12 }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </form>
    </main>
  );
}
