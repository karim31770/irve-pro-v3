import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import StatCard from "../../components/StatCard";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";
import { Users, FolderKanban, Zap, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const recentProjects = useMemo(() => projects.slice(0, 5), [projects]);

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      try {
        setLoading(true);
        const [c, p] = await Promise.all([apiFetch("/clients"), apiFetch("/projects")]);
        setClients(c);
        setProjects(p);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell title="Dashboard">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-sm opacity-70">Bienvenue</div>
          <div className="text-2xl font-semibold">Pilotage IRVE</div>
          <div className="text-sm opacity-70">Chantiers, parc, conformité et conception électrique.</div>
        </div>

        <a className="btn btn-primary" href="/app/projects">
          Nouveau projet <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Clients"
          value={loading ? "…" : clients.length}
          subtitle="Référentiel clients"
          tone="primary"
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Projets"
          value={loading ? "…" : projects.length}
          subtitle="Chantiers & études"
          tone="secondary"
          icon={<FolderKanban className="w-6 h-6" />}
        />
        <StatCard
          title="Conception IRVE"
          value="MVP"
          subtitle="Contexte → EVSE → Départs"
          tone="accent"
          icon={<Zap className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Derniers projets</h2>
              <a className="btn btn-sm btn-ghost" href="/app/projects">Voir tout</a>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="table">
                <thead>
                  <tr><th>Nom</th><th>Statut</th><th></th></tr>
                </thead>
                <tbody>
                  {recentProjects.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td><span className="badge badge-outline">{p.status}</span></td>
                      <td>
                        <a className="btn btn-xs btn-primary" href={`/app/projects/${p.id}`}>Ouvrir</a>
                      </td>
                    </tr>
                  ))}
                  {!loading && recentProjects.length === 0 ? (
                    <tr><td colSpan={3} className="opacity-60">Aucun projet</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
          <div className="card-body">
            <h2 className="card-title">Actions rapides</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <a className="btn btn-outline justify-between" href="/app/clients">
                Ajouter un client <ArrowRight className="w-4 h-4" />
              </a>
              <a className="btn btn-outline justify-between" href="/app/projects">
                Créer un projet <ArrowRight className="w-4 h-4" />
              </a>
              <a className="btn btn-outline justify-between md:col-span-2" href="/app/projects">
                Aller vers “Conception électrique” <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="text-xs opacity-60 mt-3">
              Prochaine étape: bouton Calculer + non-conformités + schéma unifilaire SVG.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
