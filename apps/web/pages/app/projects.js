import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";

export default function Projects() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  async function reload() {
    const data = await apiFetch("/projects");
    setItems(data);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    reload().catch(e => toast.error(e.message));
  }, []);

  async function create() {
    try {
      await apiFetch("/projects", { method: "POST", body: { name } });
      setName("");
      toast.success("Projet créé");
      await reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title="Projets">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <label className="form-control w-full max-w-md">
              <div className="label"><span className="label-text">Nouveau projet</span></div>
              <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Parking - 8 points 22kW" />
            </label>
            <button className="btn btn-primary" disabled={name.length < 2} onClick={create}>Créer</button>
            <button className="btn btn-ghost" onClick={() => reload().catch(e => toast.error(e.message))}>Rafraîchir</button>
          </div>

          <div className="divider" />

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>Nom</th><th>Statut</th><th>Créé le</th></tr></thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td><span className="badge badge-outline">{p.status}</span></td>
                    <td className="text-sm opacity-70">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {items.length === 0 ? <tr><td colSpan={3} className="opacity-60">Aucun projet</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
