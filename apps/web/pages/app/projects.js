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
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newClientId, setNewClientId] = useState("");

  async function reload() {
    const [p, c] = await Promise.all([apiFetch("/projects"), apiFetch("/clients")]);
    setItems(p);
    setClients(c);
    if (!newClientId && c.length) setNewClientId(c[0].id);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      try { setLoading(true); await reload(); }
      catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter(p => {
      const okQ = !qq || (p.name || "").toLowerCase().includes(qq) || (p.client_name || "").toLowerCase().includes(qq);
      const okS = status === "ALL" || p.status === status;
      return okQ && okS;
    });
  }, [items, q, status]);

  async function createProject() {
    try {
      if (!newClientId) { toast.error("Choisis un client"); return; }
      await apiFetch("/projects", { method: "POST", body: { name: newName, clientId: newClientId } });
      setNewName("");
      toast.success("Projet créé");
      await reload();
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
          <div className="opacity-70">Chaque projet doit être rattaché à un client.</div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => window.location.href="/app/projects/new"}>
            <Plus className="w-4 h-4" /> Nouveau
          </button>
          <button className="btn btn-ghost" onClick={() => reload().catch(e => toast.error(e.message))}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="input input-bordered flex items-center gap-2">
              <Search className="w-4 h-4 opacity-70" />
              <input className="grow" placeholder="Rechercher projet / client…" value={q} onChange={(e) => setQ(e.target.value)} />
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

            <div className="flex items-center justify-end text-sm opacity-70">
              {loading ? "Chargement…" : `${filtered.length} / ${items.length}`}
            </div>
          </div>
        </div>
      </div>

      {(!loading && items.length === 0) ? (
        <EmptyState
          title="Aucun projet"
          subtitle="Crée un projet lié à un client."
          actionLabel="Créer un projet"
          onAction={() => window.location.href="/app/projects/new"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card bg-base-100/70 border border-base-300 shadow-soft">
                <div className="card-body">
                  <div className="skeleton h-6 w-3/4" />
                  <div className="skeleton h-4 w-1/2 mt-3" />
                  <div className="skeleton h-10 w-full mt-6" />
                </div>
              </div>
            ))
          ) : (
            filtered.map(p => <ProjectCard key={p.id} project={p} />)
          )}
        </div>
      )}

      <dialog id="new_project_modal" className="modal">
        <div className="modal-box bg-base-100/80 backdrop-blur border border-base-300 shadow-soft">
          <h3 className="font-bold text-lg">Nouveau projet</h3>
          <p className="py-2 opacity-70">Choisis le client puis donne un nom clair.</p>

          <label className="form-control">
            <div className="label"><span className="label-text">Client (obligatoire)</span></div>
            <select className="select select-bordered" value={newClientId} onChange={(e) => setNewClientId(e.target.value)}>
              <option value="" disabled>Choisir…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="form-control mt-3">
            <div className="label"><span className="label-text">Nom du projet</span></div>
            <input className="input input-bordered" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Maison Dupont — 1 point — 7,4kW" />
          </label>

          <div className="modal-action">
            <form method="dialog" className="flex gap-2">
              <button className="btn btn-ghost">Annuler</button>
              <button className="btn btn-primary" disabled={newName.trim().length < 2 || !newClientId}
                onClick={(e) => { e.preventDefault(); createProject(); }}>
                Créer
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </AppShell>
  );
}
