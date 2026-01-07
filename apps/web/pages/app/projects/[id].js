import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../components/AppShell";
import { apiFetch } from "../../../lib/api";
import { storage } from "../../../lib/storage";

export default function ProjectDetail() {
  const [project, setProject] = useState(null);

  const projectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || null;
  }, []);

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    if (!projectId) return;
    (async () => {
      try {
        const p = await apiFetch(`/projects/${projectId}`);
        setProject(p);
      } catch (e) {
        toast.error(e.message);
      }
    })();
  }, [projectId]);

  return (
    <AppShell title={project ? project.name : "Projet"}>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          {!project ? (
            <div className="skeleton h-24 w-full" />
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <div className="mt-2">
                <span className="badge badge-outline">{project.status}</span>
              </div>

              <div className="mt-4 text-sm opacity-70">
                Prochaine étape: onglets + Conception électrique (Contexte / EVSE / Départs).
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
