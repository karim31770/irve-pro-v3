import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

export default function Login() {
  const [email, setEmail] = useState("admin@demo.fr");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  useEffect(() => { storage.clear(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: { email, password } });
      storage.setToken(data.token);
      storage.setTenants(data.tenants || []);
      if ((data.tenants || []).length === 1) storage.setTenantId(data.tenants[0].id);
      toast.success("Connecté");
      window.location.href = "/app";
    } catch (e) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">Connexion</h1>
          <p className="opacity-70">Accède à ton espace IRVE.</p>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">Email</span></div>
              <input className="input input-bordered" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Mot de passe</span></div>
              <input className="input input-bordered" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="text-xs opacity-60 mt-4">
            L’API doit être accessible via <code>/api</code> (Nginx).
          </div>
        </div>
      </div>
    </div>
  );
}
