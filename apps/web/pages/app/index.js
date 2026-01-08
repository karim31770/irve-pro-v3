import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";
import { Users, FolderKanban, Zap, ArrowRight } from "lucide-react";

const ProjectsCharts = dynamic(() => import("../../components/ProjectsCharts"), { ssr: false });

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const recentProjects = useMemo(() => projects.slice(0, 6), [projects]);

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
          <div className="text-sm opacity-70">Chantiers, conformité et conception électrique.</div>
        </div>

        <a className="btn btn-primary" href="/app/projects">
          Nouveau projet <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Clients" value={loading ? "…" : clients.length} subtitle="Référentiel clients" tone="primary" icon={<Users className="w-6 h-6" />} />
        <StatCard title="Projets" value={loading ? "…" : projects.length} subtitle="Chantiers & études" tone="secondary" icon={<FolderKanban className="w-6 h-6" />} />
        <StatCard title="Conception IRVE" value="MVP" subtitle="Contexte → EVSE → Départs" tone="accent" icon={<Zap className="w-6 h-6" />} />
      </div>

      <div className="mt-6">
        {!loading && projects.length === 0 ? (
          <EmptyState
            title="Aucun projet"
            subtitle="Crée un projet pour voir des statistiques et démarrer la conception électrique."
            actionLabel="Créer un projet"
            onAction={() => (window.location.href = "/app/projects")}
          />
        ) : (
          <ProjectsCharts projects={projects} />
        )}
      </div>

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mt-6">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Derniers projets</h2>
            <a className="btn btn-sm btn-ghost" href="/app/projects">Voir tout</a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card bg-base-100/50 border border-base-300">
                  <div className="card-body">
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-4 w-1/2 mt-2" />
                    <div className="skeleton h-9 w-full mt-4" />
                  </div>
                </div>
              ))
            ) : (
              recentProjects.map(p => (
                <a key={p.id} className="card bg-base-100/50 border border-base-300 hover:-translate-y-0.5 transition-transform" href={`/app/projects/${p.id}`}>
                  <div className="card-body">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm opacity-70">{p.status}</div>
                    <div className="btn btn-sm btn-primary mt-3">Ouvrir</div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
