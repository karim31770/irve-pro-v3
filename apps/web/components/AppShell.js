import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { storage } from "../lib/storage";

export default function AppShell({ title, children }) {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [theme, setTheme] = useState("corporate");

  useEffect(() => {
    const th = storage.getTheme();
    setTheme(th);
    document.documentElement.setAttribute("data-theme", th);

    const ts = storage.getTenants();
    setTenants(ts);

    const tid = storage.getTenantId() || ts[0]?.id || "";
    setTenantId(tid);
    if (tid) storage.setTenantId(tid);
  }, []);

  const tenantLabel = useMemo(() => {
    const t = tenants.find(x => x.id === tenantId);
    return t ? `${t.name} (${t.role})` : "Choisir entreprise…";
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

      <div className="drawer lg:drawer-open">
        <input id="app-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex flex-col">
          {/* Topbar */}
          <div className="navbar bg-base-100 border-b border-base-300">
            <div className="flex-none lg:hidden">
              <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label="menu">
                <span className="text-xl">☰</span>
              </label>
            </div>

            <div className="flex-1">
              <div className="text-lg font-semibold">{title || "IRVE SaaS"}</div>
              <div className="ml-3 hidden md:block text-sm opacity-60">{tenantLabel}</div>
            </div>

            <div className="flex-none gap-2">
              <select className="select select-bordered hidden sm:inline-flex" value={tenantId} onChange={(e) => onTenantChange(e.target.value)}>
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

          {/* Page */}
          <main className="p-5">
            <div className="max-w-7xl mx-auto">
              {children}
              <div className="mt-10 text-xs opacity-60">{tenantLabel}</div>
            </div>
          </main>
        </div>

        {/* Sidebar */}
        <div className="drawer-side">
          <label htmlFor="app-drawer" className="drawer-overlay"></label>
          <aside className="w-72 min-h-full bg-base-100 border-r border-base-300">
            <div className="p-5">
              <Link href="/app" className="btn btn-ghost text-xl justify-start w-full">IRVE SaaS</Link>
            </div>

            <ul className="menu px-4">
              <li><Link href="/app">Dashboard</Link></li>
              <li><Link href="/app/clients">Clients</Link></li>
              <li><Link href="/app/projects">Projets</Link></li>
            </ul>

            <div className="p-5 text-xs opacity-60">
              Version MVP
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
