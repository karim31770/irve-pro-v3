import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";
import { Plus, RefreshCw } from "lucide-react";

export default function Clients() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");

  async function reload() {
    const data = await apiFetch("/clients");
    setItems(data);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      try { setLoading(true); await reload(); }
      catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  async function createClient() {
    try {
      await apiFetch("/clients", { method: "POST", body: { name: newName } });
      setNewName("");
      toast.success("Client créé");
      await reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title="Clients">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-2xl font-semibold">Clients</div>
          <div className="opacity-70">Renseigne les coordonnées pour les futurs installateurs.</div>
        </div>
        <button className="btn btn-ghost" onClick={() => reload().catch(e => toast.error(e.message))}>
          <RefreshCw className="w-4 h-4" /> Rafraîchir
        </button>
      </div>

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-2">
            <label className="input input-bordered flex items-center gap-2 flex-1">
              <Plus className="w-4 h-4 opacity-70" />
              <input className="grow" placeholder="Nom du client (obligatoire)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={newName.trim().length < 2} onClick={createClient}>
              Créer
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Nom</th><th>Créé le</th><th></th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="opacity-70">Chargement…</td></tr>
                ) : items.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="opacity-70 text-sm">{new Date(c.created_at).toLocaleString()}</td>
                    <td><a className="btn btn-sm btn-primary" href={`/app/clients/${c.id}`}>Ouvrir</a></td>
                  </tr>
                ))}
                {!loading && items.length === 0 ? (
                  <tr><td colSpan={3} className="opacity-70">Aucun client</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
