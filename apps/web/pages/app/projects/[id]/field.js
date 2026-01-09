import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../../components/AppShell";
import { apiFetch } from "../../../../lib/api";
import { storage } from "../../../../lib/storage";
import { Play, AlertTriangle, ShieldAlert, Wrench, Link2 } from "lucide-react";

function pickMissing(calc) {
  const codes = new Set((calc?.nonConformities || []).map(x => x.code));
  const missing = [];
  if (codes.has("FEEDER_NO_EVSE")) missing.push("Départ non lié à une EVSE");
  if (codes.has("IB_UNKNOWN")) missing.push("Ib non calculable (puissance/phase manquante)");
  if (codes.has("IK_MISSING")) missing.push("Ik manquant (Icu à valider)");
  return missing;
}

export default function FieldView() {
  const projectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 2] || null;
  }, []);

  const [project, setProject] = useState(null);
  const [evse, setEvse] = useState([]);
  const [feeders, setFeeders] = useState([]);
  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(false);

  const [linkFeederId, setLinkFeederId] = useState("");
  const [linkEvseId, setLinkEvseId] = useState("");

  async function loadAll() {
    const [p, e, f, latest] = await Promise.all([
      apiFetch(`/projects/${projectId}`),
      apiFetch(`/projects/${projectId}/evse`),
      apiFetch(`/projects/${projectId}/feeders`),
      apiFetch(`/projects/${projectId}/calculations/latest`).catch(() => null)
    ]);
    setProject(p);
    setEvse(e);
    setFeeders(f);
    setCalc(latest);
    if (!linkFeederId && f.length) setLinkFeederId(f[0].id);
    if (!linkEvseId && e.length) setLinkEvseId(e[0].id);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    if (!projectId) return;
    loadAll().catch(e => toast.error(e.message));
  }, [projectId]);

  async function runCalc() {
    try {
      setLoading(true);
      const res = await apiFetch(`/projects/${projectId}/calculations/run`, { method: "POST" });
      setCalc(res);
      toast.success("Calcul OK");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function link() {
    try {
      if (!linkFeederId || !linkEvseId) { toast.error("Choisir un départ et une EVSE"); return; }
      await apiFetch(`/projects/${projectId}/feeders/${linkFeederId}`, { method: "PUT", body: { evseId: linkEvseId } });
      toast.success("Départ lié");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const blocks = (calc?.nonConformities || []).filter(x => x.severity === "BLOCK");
  const missing = pickMissing(calc);

  return (
    <AppShell title="Mode technicien">
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm opacity-70">Projet</div>
              <div className="text-2xl font-semibold">{project?.name || "…"}</div>
              <div className="text-sm opacity-70">Objectif: acheter + installer sans perdre de temps.</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={runCalc} disabled={loading}>
                <Play className="w-4 h-4" /> {loading ? "Calcul..." : "Calculer"}
              </button>
              <a className="btn btn-outline" href={`/app/projects/${projectId}/buy`}>Liste d’achat</a>
            </div>
          </div>
        </div>
      </div>

      {blocks.length ? (
        <div className="alert alert-error bg-error/10 border border-error/30 mt-4">
          <ShieldAlert className="w-5 h-5" />
          <div>
            <div className="font-semibold">Bloquants</div>
            <div className="text-sm opacity-80">{blocks[0].message}</div>
          </div>
        </div>
      ) : null}

      {missing.length ? (
        <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mt-4">
          <div className="card-body">
            <h2 className="card-title"><Wrench className="w-5 h-5" /> Données à compléter</h2>
            <ul className="list-disc ml-5 opacity-80 mt-2">
              {missing.map((m, i) => <li key={i}>{m}</li>)}
            </ul>

            <div className="divider" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <label className="form-control">
                <div className="label"><span className="label-text">Départ</span></div>
                <select className="select select-bordered" value={linkFeederId} onChange={(e) => setLinkFeederId(e.target.value)}>
                  {feeders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>

              <label className="form-control">
                <div className="label"><span className="label-text">EVSE</span></div>
                <select className="select select-bordered" value={linkEvseId} onChange={(e) => setLinkEvseId(e.target.value)}>
                  {evse.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>

              <button className="btn btn-primary" onClick={link}>
                <Link2 className="w-4 h-4" /> Lier
              </button>
            </div>

            <div className="text-xs opacity-60 mt-2">
              Après liaison, relance le calcul : Ib/disjoncteur/différentiel seront proposés.
            </div>
          </div>
        </div>
      ) : null}

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mt-4">
        <div className="card-body">
          <h2 className="card-title">Raccourci</h2>
          <div className="opacity-70">Pour les achats: utilise la page “Liste d’achat” (BOM) qui regroupe par catégories.</div>
        </div>
      </div>
    </AppShell>
  );
}
