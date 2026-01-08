import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../components/AppShell";
import { apiFetch } from "../../../lib/api";
import { storage } from "../../../lib/storage";
import { Save, RefreshCw } from "lucide-react";

export default function ClientDetail() {
  const clientId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || null;
  }, []);

  const [client, setClient] = useState(null);
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "FR"
  });

  async function load() {
    const c = await apiFetch(`/clients/${clientId}`);
    setClient(c);
    setForm({
      name: c.name || "",
      contactName: c.contact_name || "",
      phone: c.phone || "",
      email: c.email || "",
      addressLine1: c.address_line1 || "",
      addressLine2: c.address_line2 || "",
      postalCode: c.postal_code || "",
      city: c.city || "",
      country: c.country || "FR"
    });
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    if (!clientId) return;
    load().catch(e => toast.error(e.message));
  }, [clientId]);

  async function save() {
    try {
      const c = await apiFetch(`/clients/${clientId}`, { method: "PUT", body: form });
      setClient(c);
      toast.success("Client mis à jour");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title={client ? client.name : "Client"}>
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
        <div className="card-body">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Fiche client</h1>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => load().catch(e => toast.error(e.message))}>
                <RefreshCw className="w-4 h-4" /> Recharger
              </button>
              <button className="btn btn-primary" onClick={save}>
                <Save className="w-4 h-4" /> Enregistrer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <label className="form-control">
              <div className="label"><span className="label-text">Nom (obligatoire)</span></div>
              <input className="input input-bordered" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Contact</span></div>
              <input className="input input-bordered" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Téléphone</span></div>
              <input className="input input-bordered" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Email</span></div>
              <input className="input input-bordered" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>

            <label className="form-control md:col-span-2">
              <div className="label"><span className="label-text">Adresse ligne 1</span></div>
              <input className="input input-bordered" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
            </label>

            <label className="form-control md:col-span-2">
              <div className="label"><span className="label-text">Adresse ligne 2</span></div>
              <input className="input input-bordered" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Code postal</span></div>
              <input className="input input-bordered" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Ville</span></div>
              <input className="input input-bordered" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Pays</span></div>
              <input className="input input-bordered" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </label>
          </div>

          <div className="mt-3 text-xs opacity-60">
            Astuce : ces coordonnées seront affichées dans la fiche projet pour l’installateur.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
