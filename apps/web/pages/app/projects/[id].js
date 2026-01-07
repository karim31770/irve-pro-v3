import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../components/AppShell";
import { apiFetch } from "../../../lib/api";
import { storage } from "../../../lib/storage";

function toNum(v, fallback = null) {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProjectDetail() {
  const [tab, setTab] = useState("overview");
  const [project, setProject] = useState(null);

  const [ctx, setCtx] = useState(null);
  const [ctxForm, setCtxForm] = useState({
    earthingSystem: "TT",
    supplyPhase: "MONO_230",
    nominalVoltageV: 230,
    prospectiveScIkA: "",
    ambientTempC: 30,
    voltageDropLimitPercent: 3
  });

  const [evse, setEvse] = useState([]);
  const [evseForm, setEvseForm] = useState({
    name: "",
    evseType: "AC",
    phase: "MONO",
    maxPowerKw: 7.4,
    maxCurrentA: "",
    has6mADcDetection: false,
    manufacturer: "",
    model: ""
  });

  const [feeders, setFeeders] = useState([]);
  const [feederForm, setFeederForm] = useState({
    name: "",
    evseId: "",
    lengthM: 0,
    cableSectionMm2: ""
  });

  const projectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || null;
  }, []);

  async function loadAll() {
    if (!projectId) return;
    const [p, c, e, f] = await Promise.all([
      apiFetch(`/projects/${projectId}`),
      apiFetch(`/projects/${projectId}/electrical-context`),
      apiFetch(`/projects/${projectId}/evse`),
      apiFetch(`/projects/${projectId}/feeders`)
    ]);

    setProject(p);
    setCtx(c);
    setEvse(e);
    setFeeders(f);

    if (c) {
      setCtxForm({
        earthingSystem: c.earthing_system ?? "TT",
        supplyPhase: c.supply_phase ?? "MONO_230",
        nominalVoltageV: c.nominal_voltage_v ?? 230,
        prospectiveScIkA: c.prospective_sc_ik_a ?? "",
        ambientTempC: c.ambient_temp_c ?? 30,
        voltageDropLimitPercent: c.voltage_drop_limit_percent ?? 3
      });
    }
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    loadAll().catch((e) => toast.error(e.message));
  }, [projectId]);

  async function saveContext() {
    try {
      await apiFetch(`/projects/${projectId}/electrical-context`, {
        method: "PUT",
        body: {
          earthingSystem: ctxForm.earthingSystem,
          supplyPhase: ctxForm.supplyPhase,
          nominalVoltageV: toNum(ctxForm.nominalVoltageV, 230),
          prospectiveScIkA: toNum(ctxForm.prospectiveScIkA, null),
          ambientTempC: toNum(ctxForm.ambientTempC, 30),
          voltageDropLimitPercent: toNum(ctxForm.voltageDropLimitPercent, 3)
        }
      });
      toast.success("Contexte enregistré");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function addEvse() {
    try {
      await apiFetch(`/projects/${projectId}/evse`, {
        method: "POST",
        body: {
          name: evseForm.name,
          evseType: evseForm.evseType,
          phase: evseForm.phase,
          maxPowerKw: toNum(evseForm.maxPowerKw, 7.4),
          maxCurrentA: toNum(evseForm.maxCurrentA, null),
          has6mADcDetection: !!evseForm.has6mADcDetection,
          manufacturer: evseForm.manufacturer || null,
          model: evseForm.model || null
        }
      });
      setEvseForm({
        name: "", evseType: "AC", phase: "MONO", maxPowerKw: 7.4, maxCurrentA: "",
        has6mADcDetection: false, manufacturer: "", model: ""
      });
      toast.success("EVSE ajoutée");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function deleteEvse(id) {
    try {
      await apiFetch(`/projects/${projectId}/evse/${id}`, { method: "DELETE" });
      toast.success("EVSE supprimée");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function addFeeder() {
    try {
      await apiFetch(`/projects/${projectId}/feeders`, {
        method: "POST",
        body: {
          name: feederForm.name,
          evseId: feederForm.evseId || null,
          lengthM: toNum(feederForm.lengthM, 0),
          cableSectionMm2: toNum(feederForm.cableSectionMm2, null)
        }
      });
      setFeederForm({ name: "", evseId: "", lengthM: 0, cableSectionMm2: "" });
      toast.success("Départ ajouté");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function deleteFeeder(id) {
    try {
      await apiFetch(`/projects/${projectId}/feeders/${id}`, { method: "DELETE" });
      toast.success("Départ supprimé");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell title={project ? project.name : "Projet"}>
      {!project ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="skeleton h-10 w-2/3" />
            <div className="skeleton h-5 w-1/3 mt-2" />
            <div className="skeleton h-24 w-full mt-4" />
          </div>
        </div>
      ) : (
        <>
          <div className="card bg-base-100 shadow mb-4">
            <div className="card-body">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">{project.name}</h1>
                  <div className="mt-2">
                    <span className="badge badge-outline">{project.status}</span>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => loadAll().catch(e => toast.error(e.message))}>
                  Rafraîchir
                </button>
              </div>
            </div>
          </div>

          <div className="tabs tabs-boxed mb-4">
            <a className={`tab ${tab === "overview" ? "tab-active" : ""}`} onClick={() => setTab("overview")}>Aperçu</a>
            <a className={`tab ${tab === "elec" ? "tab-active" : ""}`} onClick={() => setTab("elec")}>Conception électrique</a>
          </div>

          {tab === "overview" ? (
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="opacity-70">
                  Ici on ajoutera bientôt : client/site, documents, statut chantier, export dossier.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Contexte */}
              <div className="card bg-base-100 shadow lg:col-span-3">
                <div className="card-body">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="card-title">Contexte</h2>
                    <button className="btn btn-primary" onClick={saveContext}>Enregistrer</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <label className="form-control">
                      <div className="label"><span className="label-text">Régime de neutre</span></div>
                      <select className="select select-bordered" value={ctxForm.earthingSystem}
                        onChange={(e) => setCtxForm({ ...ctxForm, earthingSystem: e.target.value })}>
                        <option value="TT">TT</option>
                        <option value="TN_S">TN-S</option>
                        <option value="TN_C">TN-C</option>
                        <option value="IT">IT</option>
                      </select>
                    </label>

                    <label className="form-control">
                      <div className="label"><span className="label-text">Alimentation</span></div>
                      <select className="select select-bordered" value={ctxForm.supplyPhase}
                        onChange={(e) => setCtxForm({ ...ctxForm, supplyPhase: e.target.value })}>
                        <option value="MONO_230">Mono 230V</option>
                        <option value="TRI_400">Tri 400V</option>
                      </select>
                    </label>

                    <label className="form-control">
                      <div className="label"><span className="label-text">Tension nominale (V)</span></div>
                      <input className="input input-bordered" value={ctxForm.nominalVoltageV}
                        onChange={(e) => setCtxForm({ ...ctxForm, nominalVoltageV: e.target.value })} />
                    </label>

                    <label className="form-control">
                      <div className="label"><span className="label-text">Ik présumé (A)</span></div>
                      <input className="input input-bordered" value={ctxForm.prospectiveScIkA}
                        onChange={(e) => setCtxForm({ ...ctxForm, prospectiveScIkA: e.target.value })} />
                    </label>

                    <label className="form-control">
                      <div className="label"><span className="label-text">Température (°C)</span></div>
                      <input className="input input-bordered" value={ctxForm.ambientTempC}
                        onChange={(e) => setCtxForm({ ...ctxForm, ambientTempC: e.target.value })} />
                    </label>

                    <label className="form-control">
                      <div className="label"><span className="label-text">Chute de tension max (%)</span></div>
                      <input className="input input-bordered" value={ctxForm.voltageDropLimitPercent}
                        onChange={(e) => setCtxForm({ ...ctxForm, voltageDropLimitPercent: e.target.value })} />
                    </label>
                  </div>

                  <div className="text-xs opacity-60 mt-3">
                    Contexte enregistré : {ctx ? "oui" : "non"}.
                  </div>
                </div>
              </div>

              {/* EVSE */}
              <div className="card bg-base-100 shadow lg:col-span-2">
                <div className="card-body">
                  <h2 className="card-title">EVSE</h2>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                    <input className="input input-bordered md:col-span-2" placeholder="Nom (ex: Borne 1)"
                      value={evseForm.name} onChange={(e) => setEvseForm({ ...evseForm, name: e.target.value })} />

                    <select className="select select-bordered" value={evseForm.phase}
                      onChange={(e) => setEvseForm({ ...evseForm, phase: e.target.value })}>
                      <option value="MONO">Mono</option>
                      <option value="TRI">Tri</option>
                    </select>

                    <input className="input input-bordered" placeholder="kW"
                      value={evseForm.maxPowerKw} onChange={(e) => setEvseForm({ ...evseForm, maxPowerKw: e.target.value })} />

                    <input className="input input-bordered" placeholder="A (optionnel)"
                      value={evseForm.maxCurrentA} onChange={(e) => setEvseForm({ ...evseForm, maxCurrentA: e.target.value })} />
                  </div>

                  <label className="label cursor-pointer justify-start gap-3 mt-2">
                    <input type="checkbox" className="toggle"
                      checked={evseForm.has6mADcDetection}
                      onChange={(e) => setEvseForm({ ...evseForm, has6mADcDetection: e.target.checked })} />
                    <span className="label-text">Détection DC 6 mA intégrée</span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <input className="input input-bordered" placeholder="Fabricant (optionnel)"
                      value={evseForm.manufacturer} onChange={(e) => setEvseForm({ ...evseForm, manufacturer: e.target.value })} />
                    <input className="input input-bordered" placeholder="Modèle (optionnel)"
                      value={evseForm.model} onChange={(e) => setEvseForm({ ...evseForm, model: e.target.value })} />
                  </div>

                  <div className="mt-3">
                    <button className="btn btn-primary" disabled={evseForm.name.length < 2} onClick={addEvse}>Ajouter EVSE</button>
                  </div>

                  <div className="divider" />

                  <div className="overflow-x-auto">
                    <table className="table table-zebra">
                      <thead><tr><th>Nom</th><th>Phase</th><th>kW</th><th>6 mA DC</th><th></th></tr></thead>
                      <tbody>
                        {evse.map(x => (
                          <tr key={x.id}>
                            <td className="font-medium">{x.name}</td>
                            <td>{x.phase}</td>
                            <td>{x.max_power_kw}</td>
                            <td>{x.has_6ma_dc_detection ? "Oui" : "Non"}</td>
                            <td>
                              <button className="btn btn-sm btn-ghost" onClick={() => deleteEvse(x.id)}>Supprimer</button>
                            </td>
                          </tr>
                        ))}
                        {evse.length === 0 ? <tr><td colSpan={5} className="opacity-60">Aucune EVSE</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Départs */}
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title">Départs</h2>

                  <input className="input input-bordered w-full" placeholder="Nom (ex: Départ Borne 1)"
                    value={feederForm.name} onChange={(e) => setFeederForm({ ...feederForm, name: e.target.value })} />

                  <select className="select select-bordered w-full mt-2"
                    value={feederForm.evseId} onChange={(e) => setFeederForm({ ...feederForm, evseId: e.target.value })}>
                    <option value="">(optionnel) Lier à une EVSE</option>
                    {evse.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input className="input input-bordered" placeholder="Longueur (m)"
                      value={feederForm.lengthM} onChange={(e) => setFeederForm({ ...feederForm, lengthM: e.target.value })} />
                    <input className="input input-bordered" placeholder="Section (mm²)"
                      value={feederForm.cableSectionMm2} onChange={(e) => setFeederForm({ ...feederForm, cableSectionMm2: e.target.value })} />
                  </div>

                  <button className="btn btn-primary mt-3" disabled={feederForm.name.length < 2} onClick={addFeeder}>
                    Ajouter départ
                  </button>

                  <div className="divider" />

                  <div className="overflow-x-auto">
                    <table className="table table-zebra">
                      <thead><tr><th>Nom</th><th>EVSE</th><th>m</th><th>mm²</th><th></th></tr></thead>
                      <tbody>
                        {feeders.map(f => (
                          <tr key={f.id}>
                            <td className="font-medium">{f.name}</td>
                            <td className="text-sm opacity-70">{f.evse_name || "-"}</td>
                            <td>{f.length_m}</td>
                            <td>{f.cable_section_mm2 ?? "-"}</td>
                            <td>
                              <button className="btn btn-sm btn-ghost" onClick={() => deleteFeeder(f.id)}>Supprimer</button>
                            </td>
                          </tr>
                        ))}
                        {feeders.length === 0 ? <tr><td colSpan={5} className="opacity-60">Aucun départ</td></tr> : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-xs opacity-60">
                    Prochaine étape: bouton “Calculer” + non-conformités + schéma unifilaire SVG.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
