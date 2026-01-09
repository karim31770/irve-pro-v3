import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../../../../components/AppShell";
import { apiFetch } from "../../../../lib/api";
import { storage } from "../../../../lib/storage";
import { Copy, Printer, Play, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";

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

function bomToText(bom) {
  return (bom || []).map(l => `- ${l.qty} ${l.unit} • ${l.label}${l.spec ? " — " + l.spec : ""}`).join("\n");
}

export default function BuyList() {
  const projectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    // /app/projects/<id>/buy
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 2] || null;
  }, []);

  const [project, setProject] = useState(null);
  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [p, latest] = await Promise.all([
      apiFetch(`/projects/${projectId}`),
      apiFetch(`/projects/${projectId}/calculations/latest`).catch(() => null)
    ]);
    setProject(p);
    setCalc(latest);
  }

  useEffect(() => {
    if (!storage.getToken()) { window.location.href = "/login"; return; }
    if (!projectId) return;
    load().catch(e => toast.error(e.message));
  }, [projectId]);

  async function runCalc() {
    try {
      setLoading(true);
      const res = await apiFetch(`/projects/${projectId}/calculations/run`, { method: "POST" });
      setCalc(res);
      toast.success("Calcul terminé");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyList() {
    try {
      const text = bomToText(calc?.bom || []);
      await navigator.clipboard.writeText(text || "");
      toast.success("Liste copiée");
    } catch {
      toast.error("Impossible de copier");
    }
  }

  return (
    <AppShell title="Liste d’achat">
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4 print:hidden">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm opacity-70">Projet</div>
              <div className="text-2xl font-semibold">{project?.name || "…"}</div>
              <div className="text-sm opacity-70 mt-1">Objectif: savoir quoi acheter en 10 secondes.</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={runCalc} disabled={loading}>
                <Play className="w-4 h-4" /> {loading ? "Calcul..." : "Actualiser calcul"}
              </button>
              <button className="btn btn-outline" onClick={copyList} disabled={!calc?.bom?.length}>
                <Copy className="w-4 h-4" /> Copier
              </button>
              <button className="btn btn-outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      {!calc ? (
        <div className="alert alert-warning bg-base-100/50 border border-base-300">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <div className="font-semibold">Aucun calcul disponible</div>
            <div className="text-sm opacity-80">Clique “Actualiser calcul” pour générer la liste d’achat.</div>
          </div>
        </div>
      ) : (
        <>
          {(calc.nonConformities || []).length ? (
            <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft mb-4">
              <div className="card-body">
                <h2 className="card-title">À valider / à corriger</h2>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {calc.nonConformities.map((n, idx) => (
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
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
            <div className="card-body">
              <h2 className="card-title">Liste d’achat</h2>
              <div className="overflow-x-auto mt-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Qté</th>
                      <th>Unité</th>
                      <th>Article</th>
                      <th>Spécification</th>
                      <th>Pour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calc.bom || []).map((l, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{l.qty}</td>
                        <td>{l.unit}</td>
                        <td className="font-medium">{l.label}</td>
                        <td className="opacity-70">{l.spec || "-"}</td>
                        <td className="text-sm opacity-70">{(l.for || []).join(", ") || "-"}</td>
                      </tr>
                    ))}
                    {(!calc.bom || calc.bom.length === 0) ? (
                      <tr><td colSpan={5} className="opacity-70">Aucune ligne. Clique “Actualiser calcul”.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs opacity-60">
                Conseil terrain : prévoir une marge de câble + accessoires selon pose. Validation finale par un électricien qualifié.
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
