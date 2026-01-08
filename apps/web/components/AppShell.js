import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { storage } from "../lib/storage";

function Icon({ d }) {
  return (
    <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const icons = {
  dashboard: "M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8V15H3v6Zm10-10h8V3h-8v8Z",
  clients: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  projects: "M4 4h16v6H4V4Zm0 10h10v6H4v-6Zm12 0h4v6h-4v-6Z"
};

export default function AppShell({ title, children }) {
  const router = useRouter();
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
    // Optionnel: recharger la page pour re-fetch
    router.replace(router.asPath);
  }

  function onThemeChange(t) {
    setTheme(t);
    storage.setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  const isActive = (path) => router.pathname === path || router.pathname.startsWith(path + "/");

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
              <div className="flex flex-col">
                <div className="text-lg font-semibold leading-tight">{title || "IRVE SaaS"}</div>
                <div className="text-xs opacity-60">{tenantLabel}</div>
              </div>
            </div>

            <div className="flex-none gap-2">
              <select className="select select-bordered hidden md:inline-flex" value={tenantId} onChange={(e) => onTenantChange(e.target.value)}>
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

          {/* Content */}
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

            <ul className="menu px-4 gap-1">
              <li>
                <Link className={isActive("/app") ? "active" : ""} href="/app">
                  <Icon d={icons.dashboard} /> Dashboard
                </Link>
              </li>
              <li>
                <Link className={isActive("/app/clients") ? "active" : ""} href="/app/clients">
                  <Icon d={icons.clients} /> Clients
                </Link>
              </li>
              <li>
                <Link className={isActive("/app/projects") ? "active" : ""} href="/app/projects">
                  <Icon d={icons.projects} /> Projets
                </Link>
              </li>
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
