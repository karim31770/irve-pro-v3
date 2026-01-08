import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../components/AppShell";
import { apiFetch } from "../../../lib/api";
import { storage } from "../../../lib/storage";
import { Play, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2, Sparkles, Sliders } from "lucide-react";

function toNum(v, fallback = null) {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sevBadge(sev) {
  if (sev === "BLOCK") return "badge-error";
  if (sev === "WARN") return "badge-warning";
  return "badge-ghost";
}

function sevIcon(sev) {
  if (sev === "BLOCK") return <ShieldAlert className="w-4 h-4" />;
  if (sev === "WARN") return <AlertTriangle className="w-4 h-4" />;
  return <CheckCircle2 className="w-4 h-4" />;
}

const PRESETS = {
  HOME_FR: {
    label: "Maison / appartement (France) — défaut",
    earthingSystem: "TT",
    supplyPhase: "MONO_230",
    nominalVoltageV: 230,
    prospectiveScIkA: 3000,          // indicatif (à valider)
    ambientTempC: 30,
    voltageDropLimitPercent: 3
  },
  SMALL_TERTIARY: {
    label: "Petit tertiaire (indicatif)",
    earthingSystem: "TN_S",
    supplyPhase: "TRI_400",
    nominalVoltageV: 400,
    prospectiveScIkA: 6000,
    ambientTempC: 30,
    voltageDropLimitPercent: 3
  }
};

function autoVoltageFromSupply(supplyPhase) {
  return supplyPhase === "TRI_400" ? 400 : 230;
}

export default function ProjectDetail() {
  const [tab, setTab] = useState("elec");
  const [project, setProject] = useState(null);

  const [preset, setPreset] = useState("HOME_FR");
  const [advanced, setAdvanced] = useState(false);

  const [ctx, setCtx] = useState(null);
  const [ctxForm, setCtxForm] = useState({ ...PRESETS.HOME_FR });

  const [evse, setEvse] = useState([]);
  const [evseForm, setEvseForm] = useState({
    name: "",
    evseType: "AC",
    phase: "MONO",
    maxPowerKw: 7.4,
    maxCurrentA: "",
    has6mADcDetection: false
  });

  const [feeders, setFeeders] = useState([]);
  const [feederForm, setFeederForm] = useState({
    name: "",
    evseId: "",
    lengthM: 20,
    cableSectionMm2: ""
  });

  const [calc, setCalc] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const projectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || null;
  }, []);

  function isContextRequiredOk() {
    return !!ctxForm.earthingSystem && !!ctxForm.supplyPhase;
  }

  function contextPayload() {
    const uAuto = autoVoltageFromSupply(ctxForm.supplyPhase);
    const u = advanced ? toNum(ctxForm.nominalVoltageV, uAuto) : uAuto;

    return {
      earthingSystem: ctxForm.earthingSystem,
      supplyPhase: ctxForm.supplyPhase,
      nominalVoltageV: u,
      prospectiveScIkA: toNum(ctxForm.prospectiveScIkA, null),
      ambientTempC: toNum(ctxForm.ambientTempC, 30),
      voltageDropLimitPercent: toNum(ctxForm.voltageDropLimitPercent, 3)
    };
  }

  async function loadAll() {
    if (!projectId) return;
    const [p, c, e, f, latest] = await Promise.all([
      apiFetch(`/projects/${projectId}`),
      apiFetch(`/projects/${projectId}/electrical-context`),
      apiFetch(`/projects/${projectId}/evse`),
      apiFetch(`/projects/${projectId}/feeders`),
      apiFetch(`/projects/${projectId}/calculations/latest`).catch(() => null)
    ]);

    setProject(p);
    setCtx(c);
    setEvse(e);
    setFeeders(f);
    setCalc(latest);

    if (c) {
      const supply = c.supply_phase ?? PRESETS.HOME_FR.supplyPhase;
      const uAuto = autoVoltageFromSupply(supply);
      setCtxForm({
        earthingSystem: c.earthing_system ?? PRESETS.HOME_FR.earthingSystem,
        supplyPhase: supply,
        nominalVoltageV: c.nominal_voltage_v ?? uAuto,
        prospectiveScIkA: c.prospective_sc_ik_a ?? PRESETS.HOME_FR.prospectiveScIkA,
        ambientTempC: c.ambient_temp_c ?? PRESETS.HOME_FR.ambientTempC,
        voltageDropLimitPercent: c.voltage_drop_limit_percent ?? PRESETS.HOME_FR.voltageDropLimitPercent
      });
    }
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    loadAll().catch((e) => toast.error(e.message));
  }, [projectId]);

  function applyPreset(key) {
    const p = PRESETS[key] ?? PRESETS.HOME_FR;
    setPreset(key);
    setCtxForm({ ...p });
    toast.success(`Profil appliqué : ${p.label}`);
  }

  async function saveContext() {
    try {
      if (!isContextRequiredOk()) {
        toast.error("Champs obligatoires manquants : régime de neutre + mono/tri");
        return;
      }
      await apiFetch(`/projects/${projectId}/electrical-context`, {
        method: "PUT",
        body: contextPayload()
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
          has6mADcDetection: !!evseForm.has6mADcDetection
        }
      });
      setEvseForm({ name: "", evseType: "AC", phase: "MONO", maxPowerKw: 7.4, maxCurrentA: "", has6mADcDetection: false });
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
      setFeederForm({ name: "", evseId: "", lengthM: 20, cableSectionMm2: "" });
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

  async function runCalc() {
    try {
      setCalcLoading(true);
      const res = await apiFetch(`/projects/${projectId}/calculations/run`, { method: "POST" });
      setCalc(res);
      toast.success("Calcul terminé");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCalcLoading(false);
    }
  }

  const autoU = autoVoltageFromSupply(ctxForm.supplyPhase);

  return (
    <AppShell title={project ? project.name : "Projet"}>
      {!project ? (
        <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
          <div className="card-body">
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-5 w-1/3 mt-2" />
            <div className="skeleton h-28 w-full mt-5" />
          </div>
        </div>
      ) : (
        <>
          <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4">
            <div className="card-body">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm opacity-70">Projet</div>
                  <h1 className="text-2xl font-semibold">{project.name}</h1>
                  <div className="mt-2">
                    <span className="badge badge-outline">{project.status}</span>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => loadAll().catch(e => toast.error(e.message))}>
                  <RefreshCw className="w-4 h-4" /> Rafraîchir
                </button>
              </div>
            </div>
          </div>

          <div className="tabs tabs-boxed mb-4">
            <a className={`tab ${tab === "elec" ? "tab-active" : ""}`} onClick={() => setTab("elec")}>Conception</a>
            <a className={`tab ${tab === "calc" ? "tab-active" : ""}`} onClick={() => setTab("calc")}>Calcul & conformité</a>
          </div>

          {tab === "elec" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft lg:col-span-3">
                <div className="card-body">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h2 className="card-title flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> Contexte (simple)
                      </h2>
                      <div className="text-sm opacity-70 mt-1">
                        Obligatoire : régime de neutre + mono/tri. Le reste est prérempli “Maison FR”.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-outline" onClick={() => setAdvanced(!advanced)}>
                        <Sliders className="w-4 h-4" /> {advanced ? "Masquer avancé" : "Avancé"}
                      </button>
                      <button className="btn btn-primary" onClick={saveContext} disabled={!isContextRequiredOk()}>
                        Enregistrer
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <label className="form-control">
                      <div className="label"><span className="label-text">Profil</span></div>
                      <select className="select select-bordered" value={preset} onChange={(e) => applyPreset(e.target.value)}>
                        {Object.entries(PRESETS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">
                          Régime de neutre <span className="badge badge-error badge-sm ml-2">Obligatoire</span>
                        </span>
                      </div>
                      <select className={`select select-bordered ${ctxForm.earthingSystem ? "" : "select-error"}`}
                        value={ctxForm.earthingSystem}
                        onChange={(e) => setCtxForm({ ...ctxForm, earthingSystem: e.target.value })}
                      >
                        <option value="TT">TT (courant résidentiel)</option>
                        <option value="TN_S">TN-S</option>
                        <option value="TN_C">TN-C</option>
                        <option value="IT">IT</option>
                      </select>
                    </label>

                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">
                          Alimentation <span className="badge badge-error badge-sm ml-2">Obligatoire</span>
                        </span>
                      </div>
                      <select className={`select select-bordered ${ctxForm.supplyPhase ? "" : "select-error"}`}
                        value={ctxForm.supplyPhase}
                        onChange={(e) => {
                          const supplyPhase = e.target.value;
                          const u = autoVoltageFromSupply(supplyPhase);
                          setCtxForm({ ...ctxForm, supplyPhase, nominalVoltageV: u });
                        }}
                      >
                        <option value="MONO_230">Mono 230V (ménage)</option>
                        <option value="TRI_400">Tri 400V</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="badge badge-outline">Tension auto : {autoU} V</span>
                    <span className="badge badge-outline">ΔU max : {ctxForm.voltageDropLimitPercent}%</span>
                    <span className="badge badge-outline">T° : {ctxForm.ambientTempC}°C</span>
                    <span className="badge badge-outline">Ik : {ctxForm.prospectiveScIkA ? `${ctxForm.prospectiveScIkA} A` : "non renseigné"}</span>
                  </div>

                  <div className="mt-4 alert alert-warning bg-base-100/50 border border-base-300">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Recommandé : Ik</div>
                      <div className="text-sm opacity-80">
                        Ik (A) améliore la recommandation Icu. Si tu ne connais pas, garde la valeur profil ou mets vide.
                      </div>
                    </div>
                  </div>

                  {advanced ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="form-control">
                        <div className="label"><span className="label-text">Ik présumé (A) <span className="badge badge-warning badge-sm ml-2">Recommandé</span></span></div>
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
                  ) : null}

                  <div className="mt-6 divider"></div>

                  {/* EVSE */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="card bg-base-100/50 border border-base-300 lg:col-span-2">
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
                          <input className="input input-bordered" placeholder="kW" value={evseForm.maxPowerKw}
                            onChange={(e) => setEvseForm({ ...evseForm, maxPowerKw: e.target.value })} />
                          <input className="input input-bordered" placeholder="A (optionnel)" value={evseForm.maxCurrentA}
                            onChange={(e) => setEvseForm({ ...evseForm, maxCurrentA: e.target.value })} />
                        </div>

                        <label className="label cursor-pointer justify-start gap-3 mt-2">
                          <input type="checkbox" className="toggle" checked={evseForm.has6mADcDetection}
                            onChange={(e) => setEvseForm({ ...evseForm, has6mADcDetection: e.target.checked })} />
                          <span className="label-text">Détection DC 6 mA intégrée</span>
                        </label>

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
                                  <td><button className="btn btn-sm btn-ghost" onClick={() => deleteEvse(x.id)}>Supprimer</button></td>
                                </tr>
                              ))}
                              {evse.length === 0 ? <tr><td colSpan={5} className="opacity-60">Aucune EVSE</td></tr> : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Départs */}
                    <div className="card bg-base-100/50 border border-base-300">
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
                          <input className="input input-bordered" placeholder="Longueur (m)" value={feederForm.lengthM}
                            onChange={(e) => setFeederForm({ ...feederForm, lengthM: e.target.value })} />
                          <input className="input input-bordered" placeholder="Section (mm²) (optionnel)" value={feederForm.cableSectionMm2}
                            onChange={(e) => setFeederForm({ ...feederForm, cableSectionMm2: e.target.value })} />
                        </div>

                        <button className="btn btn-primary mt-3" disabled={feederForm.name.length < 2} onClick={addFeeder}>
                          Ajouter départ
                        </button>

                        <div className="divider" />

                        <div className="overflow-x-auto">
                          <table className="table table-zebra">
                            <thead><tr><th>Nom</th><th>m</th><th>mm²</th><th></th></tr></thead>
                            <tbody>
                              {feeders.map(f => (
                                <tr key={f.id}>
                                  <td className="font-medium">{f.name}</td>
                                  <td>{f.length_m}</td>
                                  <td>{f.cable_section_mm2 ?? "-"}</td>
                                  <td><button className="btn btn-sm btn-ghost" onClick={() => deleteFeeder(f.id)}>Supprimer</button></td>
                                </tr>
                              ))}
                              {feeders.length === 0 ? <tr><td colSpan={4} className="opacity-60">Aucun départ</td></tr> : null}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 text-xs opacity-60">
                          Ensuite : onglet “Calcul & conformité” → Calculer automatiquement.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
                <div className="card-body">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h2 className="card-title">Calcul automatique & conformité</h2>
                      <div className="text-sm opacity-70 mt-1">
                        Le calcul fonctionne même si le contexte n’est pas enregistré (profil Maison par défaut), mais ce sera moins fiable.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className={`btn btn-primary ${calcLoading ? "btn-disabled" : ""}`} onClick={runCalc}>
                        <Play className="w-4 h-4" />
                        {calcLoading ? "Calcul..." : "Calculer automatiquement"}
                      </button>
                      <button className="btn btn-ghost" onClick={() => loadAll().catch(e => toast.error(e.message))}>
                        <RefreshCw className="w-4 h-4" /> Recharger
                      </button>
                    </div>
                  </div>

                  {calc ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="stat bg-base-100/50 border border-base-300 rounded-2xl">
                        <div className="stat-title">Départs</div>
                        <div className="stat-value text-2xl">{calc.summary?.feeders ?? "-"}</div>
                      </div>
                      <div className="stat bg-base-100/50 border border-base-300 rounded-2xl">
                        <div className="stat-title">EVSE</div>
                        <div className="stat-value text-2xl">{calc.summary?.evse ?? "-"}</div>
                      </div>
                      <div className="stat bg-base-100/50 border border-base-300 rounded-2xl">
                        <div className="stat-title">WARN</div>
                        <div className="stat-value text-2xl text-warning">{calc.summary?.warns ?? 0}</div>
                      </div>
                      <div className="stat bg-base-100/50 border border-base-300 rounded-2xl">
                        <div className="stat-title">BLOCK</div>
                        <div className="stat-value text-2xl text-error">{calc.summary?.blocks ?? 0}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm opacity-70">Aucun calcul enregistré. Clique “Calculer automatiquement”.</div>
                  )}
                </div>
              </div>

              <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
                <div className="card-body">
                  <h3 className="card-title">Non-conformités</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {(calc?.nonConformities || []).length === 0 ? (
                      <div className="opacity-70">Aucune non-conformité enregistrée.</div>
                    ) : (
                      calc.nonConformities.map((n, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl border border-base-300 bg-base-100/50">
                          <div className={`badge ${sevBadge(n.severity)} gap-2`}>
                            {sevIcon(n.severity)} {n.severity}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{n.message}</div>
                            <div className="text-xs opacity-70 mt-1">
                              {n.code}{n.standard_ref ? ` • ${n.standard_ref}` : ""}{n.clause_ref ? ` • ${n.clause_ref}` : ""}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
                <div className="card-body">
                  <h3 className="card-title">Résultats par départ</h3>
                  <div className="overflow-x-auto mt-2">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Départ</th>
                          <th>EVSE</th>
                          <th>Ib (A)</th>
                          <th>ΔU %</th>
                          <th>Câble (mm²)</th>
                          <th>Disj (In)</th>
                          <th>Icu (kA)</th>
                          <th>DDR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(calc?.items || []).map((it) => (
                          <tr key={it.feeder_id}>
                            <td className="font-medium">{it.feeder_name}</td>
                            <td className="opacity-70 text-sm">{it.evse_name || "-"}</td>
                            <td>{it.ib_a != null ? it.ib_a.toFixed(1) : "-"}</td>
                            <td>{it.vdrop_percent != null ? it.vdrop_percent.toFixed(2) : "-"}</td>
                            <td>{it.cable_section_mm2 ?? "-"}</td>
                            <td>{it.breaker_in_a ? `${it.breaker_in_a}A` : "-"}</td>
                            <td>{it.breaker_icu_ka != null ? it.breaker_icu_ka : "-"}</td>
                            <td>{it.rcd_type ? `${it.rcd_type} / ${it.rcd_sensitivity_ma}mA` : "-"}</td>
                          </tr>
                        ))}
                        {(calc?.items || []).length === 0 ? (
                          <tr><td colSpan={8} className="opacity-70">Aucun départ à calculer.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
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
