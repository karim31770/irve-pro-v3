import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import { storage } from "../../lib/storage";

export default function Clients() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  async function reload() {
    const data = await apiFetch("/clients");
    setItems(data);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    reload().catch(e => toast.error(e.message));
  }, []);

  async function create() {
    try {
      await apiFetch("/clients", { method: "POST", body: { name } });
      setName("");
      toast.success("Client créé");
      await reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title="Clients">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <label className="form-control w-full max-w-md">
              <div className="label"><span className="label-text">Nouveau client</span></div>
              <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vinci, Carrefour..." />
            </label>
            <button className="btn btn-primary" disabled={name.length < 2} onClick={create}>Créer</button>
            <button className="btn btn-ghost" onClick={() => reload().catch(e => toast.error(e.message))}>Rafraîchir</button>
          </div>

          <div className="divider" />

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>Nom</th><th>Créé le</th></tr></thead>
              <tbody>
                {items.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-sm opacity-70">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {items.length === 0 ? <tr><td colSpan={2} className="opacity-60">Aucun client</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
