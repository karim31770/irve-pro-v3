import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import EmptyState from "../../components/EmptyState";
import ProjectCard from "../../components/ProjectCard";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";
import { Plus, Search, Filter } from "lucide-react";

export default function Projects() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");

  async function reload() {
    const data = await apiFetch("/projects");
    setItems(data);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter(p => {
      const okQ = !qq || (p.name || "").toLowerCase().includes(qq);
      const okS = status === "ALL" || p.status === status;
      return okQ && okS;
    });
  }, [items, q, status]);

  async function createProject() {
    try {
      await apiFetch("/projects", { method: "POST", body: { name: newName } });
      setNewName("");
      toast.success("Projet créé");
      await reload();
      // ferme modal
      document.getElementById("new_project_modal")?.close?.();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title="Projets">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-5">
        <div className="flex-1">
          <div className="text-2xl font-semibold">Projets</div>
          <div className="opacity-70">Recherche, ouvre une fiche et passe en conception électrique.</div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => document.getElementById("new_project_modal").showModal()}>
            <Plus className="w-4 h-4" /> Nouveau
          </button>
          <button className="btn btn-ghost" onClick={() => reload().catch(e => toast.error(e.message))}>
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="input input-bordered flex items-center gap-2">
              <Search className="w-4 h-4 opacity-70" />
              <input className="grow" placeholder="Rechercher un projet…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>

            <label className="input input-bordered flex items-center gap-2">
              <Filter className="w-4 h-4 opacity-70" />
              <select className="select w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ALL">Tous statuts</option>
                <option value="DRAFT">DRAFT</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="DONE">DONE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </label>

            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="text-sm opacity-70">
                {loading ? "Chargement…" : `${filtered.length} / ${items.length}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {(!loading && items.length === 0) ? (
        <EmptyState
          title="Aucun projet pour le moment"
          subtitle="Crée ton premier projet puis configure Contexte / EVSE / Départs."
          actionLabel="Créer un projet"
          onAction={() => document.getElementById("new_project_modal").showModal()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card bg-base-100/70 border border-base-300 shadow-soft">
                <div className="card-body">
                  <div className="skeleton h-6 w-3/4" />
                  <div className="skeleton h-4 w-1/3 mt-3" />
                  <div className="skeleton h-10 w-full mt-6" />
                </div>
              </div>
            ))
          ) : (
            filtered.map(p => <ProjectCard key={p.id} project={p} />)
          )}
        </div>
      )}

      {/* Modal création */}
      <dialog id="new_project_modal" className="modal">
        <div className="modal-box bg-base-100/80 backdrop-blur border border-base-300 shadow-soft">
          <h3 className="font-bold text-lg">Nouveau projet</h3>
          <p className="py-2 opacity-70">Donne un nom clair (site + nb points + puissance).</p>

          <input
            className="input input-bordered w-full"
            placeholder="Ex: Parking SFR — 8 points — 22kW"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <div className="modal-action">
            <form method="dialog" className="flex gap-2">
              <button className="btn btn-ghost">Annuler</button>
              <button className="btn btn-primary" disabled={newName.trim().length < 2} onClick={(e) => { e.preventDefault(); createProject(); }}>
                Créer
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </AppShell>
  );
}
