import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";

export default function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, projects: 0 });

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      try {
        const [clients, projects] = await Promise.all([apiFetch("/clients"), apiFetch("/projects")]);
        setStats({ clients: clients.length, projects: projects.length });
      } catch (e) {
        toast.error(e.message);
      }
    })();
  }, []);

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="text-sm opacity-60">Clients</div>
            <div className="text-4xl font-semibold">{stats.clients}</div>
          </div>
        </div>
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="text-sm opacity-60">Projets</div>
            <div className="text-4xl font-semibold">{stats.projects}</div>
          </div>
        </div>
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="text-sm opacity-60">Prochaine étape</div>
            <div className="font-semibold">Conception électrique IRVE</div>
            <div className="text-sm opacity-70">Contexte → EVSE → Départs → Calcul → Schéma</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
