import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { storage } from "../lib/storage";
import { LayoutDashboard, Users, FolderKanban, LogOut, Palette, Building2 } from "lucide-react";

function NavItem({ href, active, icon, label }) {
  return (
    <li>
      <Link href={href} className={active ? "active" : ""}>
        <span className="w-5 h-5">{icon}</span>
        {label}
      </Link>
    </li>
  );
}

export default function AppShell({ title, children }) {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [theme, setTheme] = useState("irve");

  useEffect(() => {
    const th = storage.getTheme() || "irve";
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

  const isActive = (path) => router.pathname === path || router.pathname.startsWith(path + "/");

  function logout() {
    storage.clear();
    window.location.href = "/login";
  }

  function onTenantChange(id) {
    setTenantId(id);
    storage.setTenantId(id);
    toast.success("Entreprise sélectionnée");
    router.replace(router.asPath);
  }

  function onThemeChange(t) {
    setTheme(t);
    storage.setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />

      <div className="drawer lg:drawer-open">
        <input id="app-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex flex-col">
          {/* Topbar */}
          <div className="navbar bg-base-100/60 backdrop-blur border-b border-base-300">
            <div className="flex-none lg:hidden">
              <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label="menu">☰</label>
            </div>

            <div className="flex-1">
              <div className="flex flex-col">
                <div className="text-lg font-semibold leading-tight">{title || "Dashboard"}</div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {tenantLabel}
                </div>
              </div>
            </div>

            <div className="flex-none gap-2">
              <label className="hidden md:flex items-center gap-2">
                <span className="opacity-70 text-sm">Entreprise</span>
                <select className="select select-bordered" value={tenantId} onChange={(e) => onTenantChange(e.target.value)}>
                  <option value="" disabled>Choisir…</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <Palette className="w-4 h-4 opacity-70" />
                <select className="select select-bordered" value={theme} onChange={(e) => onThemeChange(e.target.value)}>
                  <option value="irve">IRVE</option>
                  <option value="corporate">Corporate</option>
                  <option value="business">Business</option>
                  <option value="dark">Dark</option>
                </select>
              </label>

              <button className="btn btn-outline" onClick={logout}>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              {children}
              <div className="mt-10 text-xs opacity-60">{tenantLabel}</div>
            </div>
          </main>
        </div>

        {/* Sidebar */}
        <div className="drawer-side">
          <label htmlFor="app-drawer" className="drawer-overlay"></label>

          <aside className="w-80 min-h-full bg-base-100/70 backdrop-blur border-r border-base-300">
            <div className="p-6">
              <div className="rounded-2xl p-4 border border-base-300 bg-gradient-to-b from-primary/15 to-transparent shadow-soft">
                <Link href="/app" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/25 border border-base-300 flex items-center justify-center">
                    <span className="font-black text-lg">I</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold leading-tight">IRVE SaaS</div>
                    <div className="text-xs opacity-70">Gestion + Conception IRVE</div>
                  </div>
                </Link>
              </div>
            </div>

            <ul className="menu px-4 gap-1">
              <NavItem href="/app" active={isActive("/app")} icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
              <NavItem href="/app/clients" active={isActive("/app/clients")} icon={<Users className="w-5 h-5" />} label="Clients" />
              <NavItem href="/app/projects" active={isActive("/app/projects")} icon={<FolderKanban className="w-5 h-5" />} label="Projets" />
            </ul>

            <div className="px-6 mt-6">
              <div className="divider opacity-40" />
              <div className="text-xs opacity-60">
                MVP • prochaine étape : Calcul + Schéma unifilaire
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
