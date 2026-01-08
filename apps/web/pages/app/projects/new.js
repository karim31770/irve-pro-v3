import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../components/AppShell";
import { apiFetch } from "../../../lib/api";
import { storage } from "../../../lib/storage";
import { ArrowRight, Sparkles } from "lucide-react";

const EVSE_PROFILES = [
  { key: "AC_3_7", label: "3.7 kW (mono 16A)", hint: "Résidentiel léger" },
  { key: "AC_7_4", label: "7.4 kW (mono 32A)", hint: "Résidentiel courant" },
  { key: "AC_11",  label: "11 kW (tri 16A)", hint: "Tri 400V" },
  { key: "AC_22",  label: "22 kW (tri 32A)", hint: "Tertiaire / maison tri" },
  { key: "AC_44",  label: "44 kW (tri 63A)", hint: "AC max (limite)" }
];

export default function ProjectWizard() {
  const [clients, setClients] = useState([]);
  const [useExistingClient, setUseExistingClient] = useState(true);

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [siteName, setSiteName] = useState("Site principal");
  const [siteAddress, setSiteAddress] = useState("");
  const [sitePostal, setSitePostal] = useState("");
  const [siteCity, setSiteCity] = useState("");

  const [projectName, setProjectName] = useState("");

  const [evseProfile, setEvseProfile] = useState("AC_7_4");
  const [evseName, setEvseName] = useState("Borne 1");
  const [has6, setHas6] = useState(false);

  const [lengthM, setLengthM] = useState(20);
  const [installMethod, setInstallMethod] = useState("INDOOR");

  const [availablePowerKw, setAvailablePowerKw] = useState(9);

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    (async () => {
      const c = await apiFetch("/clients");
      setClients(c);
      if (c.length) setClientId(c[0].id);
    })().catch(e => toast.error(e.message));
  }, []);

  async function submit() {
    try {
      if (!projectName || projectName.length < 2) { toast.error("Nom projet requis"); return; }

      const payload = {
        preset: "HOME_FR",
        client: useExistingClient ? { id: clientId } : { name: clientName, phone: clientPhone, email: clientEmail },
        site: { name: siteName, addressLine1: siteAddress, postalCode: sitePostal, city: siteCity, country: "FR" },
        project: { name: projectName },
        context: { availablePowerKw },
        evse: { name: evseName, profile: evseProfile, has6mADcDetection: has6 },
        feeder: { name: `Départ ${evseName}`, lengthM, installMethod }
      };

      const res = await apiFetch("/projects/wizard", { method: "POST", body: payload });
      toast.success("Projet créé + calcul automatique");
      window.location.href = `/app/projects/${res.project.id}`;
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title="Nouveau projet">
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5" /> Création guidée</h1>
              <div className="opacity-70 mt-1">Tu renseignes le minimum, l’app propose le reste (contexte, protections, câble, délestage).</div>
            </div>
            <button className="btn btn-primary" onClick={submit}>
              Créer <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divider" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="font-semibold">Client & site</h2>

              <div className="flex items-center gap-2">
                <input type="checkbox" className="toggle" checked={useExistingClient} onChange={(e) => setUseExistingClient(e.target.checked)} />
                <span className="opacity-70">Client existant</span>
              </div>

              {useExistingClient ? (
                <label className="form-control">
                  <div className="label"><span className="label-text">Client (obligatoire)</span></div>
                  <select className="select select-bordered" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="" disabled>Choisir…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input className="input input-bordered" placeholder="Nom client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  <input className="input input-bordered" placeholder="Téléphone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  <input className="input input-bordered md:col-span-2" placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className="input input-bordered md:col-span-2" placeholder="Nom du projet (obligatoire)" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                <input className="input input-bordered md:col-span-2" placeholder="Nom du site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                <input className="input input-bordered md:col-span-2" placeholder="Adresse" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
                <input className="input input-bordered" placeholder="Code postal" value={sitePostal} onChange={(e) => setSitePostal(e.target.value)} />
                <input className="input input-bordered" placeholder="Ville" value={siteCity} onChange={(e) => setSiteCity(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-semibold">Borne & pose</h2>

              <label className="form-control">
                <div className="label"><span className="label-text">Profil borne (AC)</span></div>
                <select className="select select-bordered" value={evseProfile} onChange={(e) => setEvseProfile(e.target.value)}>
                  {EVSE_PROFILES.map(p => <option key={p.key} value={p.key}>{p.label} — {p.hint}</option>)}
                </select>
                <div className="label"><span className="label-text-alt opacity-70">Auto 230→400 selon profil. AC max 44 kW.</span></div>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className="input input-bordered" placeholder="Nom EVSE" value={evseName} onChange={(e) => setEvseName(e.target.value)} />
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="toggle" checked={has6} onChange={(e) => setHas6(e.target.checked)} />
                  <span className="label-text">Détection DC 6 mA</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="form-control md:col-span-1">
                  <div className="label"><span className="label-text">Distance (m)</span></div>
                  <input className="input input-bordered" value={lengthM} onChange={(e) => setLengthM(Number(e.target.value))} />
                </label>

                <label className="form-control md:col-span-2">
                  <div className="label"><span className="label-text">Pose</span></div>
                  <select className="select select-bordered" value={installMethod} onChange={(e) => setInstallMethod(e.target.value)}>
                    <option value="INDOOR">Intérieur</option>
                    <option value="OUTDOOR">Extérieur</option>
                    <option value="UNDERGROUND">Enterré</option>
                    <option value="PARKING">Parking</option>
                  </select>
                </label>
              </div>

              <label className="form-control">
                <div className="label"><span className="label-text">Puissance disponible (kW) (délestage)</span></div>
                <input className="input input-bordered" value={availablePowerKw} onChange={(e) => setAvailablePowerKw(Number(e.target.value))} />
                <div className="label"><span className="label-text-alt opacity-70">Ex: 9 kW maison. Si total EVSE &gt; dispo ⇒ délestage recommandé.</span></div>
              </label>
            </div>
          </div>

          <div className="divider" />

          <div className="opacity-70 text-sm">
            À la création : Contexte + EVSE + Départ sont créés, puis le calcul est lancé et la section câble est proposée automatiquement.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
