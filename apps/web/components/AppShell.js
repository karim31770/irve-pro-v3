import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { storage } from "../lib/storage";

export default function AppShell({ title, children }) {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(null);
  const [theme, setTheme] = useState("corporate");

  useEffect(() => {
    const th = storage.getTheme();
    setTheme(th);
    document.documentElement.setAttribute("data-theme", th);

    const ts = storage.getTenants();
    setTenants(ts);

    const tid = storage.getTenantId() || ts[0]?.id || "";
    if (tid) {
      setTenantId(tid);
      storage.setTenantId(tid);
    }
  }, []);

  const tenantLabel = useMemo(() => {
    const t = tenants.find(x => x.id === tenantId);
    return t ? `${t.name} (${t.role})` : "Aucune entreprise";
  }, [tenants, tenantId]);

  function logout() {
    storage.clear();
    window.location.href = "/login";
  }

  function onTenantChange(id) {
    setTenantId(id);
    storage.setTenantId(id);
    toast.success("Entreprise sélectionnée");
  }

  function onThemeChange(t) {
    setTheme(t);
    storage.setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Toaster position="top-right" />

      <div className="navbar bg-base-100 border-b border-base-300">
        <div className="flex-1">
          <Link href="/app" className="btn btn-ghost text-xl">IRVE SaaS</Link>
        </div>
        <div className="flex-none gap-2">
          <select className="select select-bordered" value={tenantId || ""} onChange={(e) => onTenantChange(e.target.value)}>
            <option value="" disabled>Choisir entreprise…</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
          </select>

          <select className="select select-bordered" value={theme} onChange={(e) => onThemeChange(e.target.value)}>
            <option value="corporate">Corporate</option>
            <option value="business">Business</option>
            <option value="dark">Dark</option>
          </select>

          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-5">
        <div className="breadcrumbs text-sm mb-4">
          <ul>
            <li><Link href="/app">Dashboard</Link></li>
            {title ? <li>{title}</li> : null}
          </ul>
        </div>

        <div className="flex gap-2 mb-6">
          <Link href="/app/clients" className="btn btn-sm">Clients</Link>
          <Link href="/app/projects" className="btn btn-sm">Projets</Link>
        </div>

        {children}

        <div className="mt-10 text-xs opacity-60">{tenantLabel}</div>
      </div>
    </div>
  );
}
