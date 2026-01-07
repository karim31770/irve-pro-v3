import { useEffect, useMemo, useState } from "react";

function apiBase() {
  return "/api";
}

function getStoredTenants() {
  try { return JSON.parse(localStorage.getItem("tenants") || "[]"); } catch { return []; }
}

export default function App() {
  const [token, setToken] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(null);

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [newClientName, setNewClientName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  const headers = useMemo(() => {
    if (!token || !tenantId) return null;
    return {
      "Authorization": `Bearer ${token}`,
      "X-Tenant-Id": tenantId,
      "Content-Type": "application/json"
    };
  }, [token, tenantId]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      window.location.href = "/login";
      return;
    }
    setToken(t);
    const ts = getStoredTenants();
    setTenants(ts);
    setTenantId(localStorage.getItem("tenantId") || (ts[0]?.id ?? null));
  }, []);

  async function loadAll() {
    if (!headers) return;

    const [cRes, pRes] = await Promise.all([
      fetch(`${apiBase()}/clients`, { headers }),
      fetch(`${apiBase()}/projects`, { headers })
    ]);

    const c = await cRes.json();
    const p = await pRes.json();

    if (!cRes.ok) throw new Error(c?.error || "Failed to load clients");
    if (!pRes.ok) throw new Error(p?.error || "Failed to load projects");

    setClients(c);
    setProjects(p);
  }

  async function createClient() {
    if (!headers) return;
    const res = await fetch(`${apiBase()}/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: newClientName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to create client");
    setNewClientName("");
    await loadAll();
  }

  async function createProject() {
    if (!headers) return;
    const res = await fetch(`${apiBase()}/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: newProjectName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to create project");
    setNewProjectName("");
    await loadAll();
  }

  function onTenantChange(id) {
    setTenantId(id);
    localStorage.setItem("tenantId", id);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    window.location.href = "/login";
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>IRVE SaaS</h1>
        <button onClick={logout}>Logout</button>
      </div>

      <section style={{ marginTop: 16 }}>
        <h2>Entreprise</h2>
        <select value={tenantId || ""} onChange={(e) => onTenantChange(e.target.value)} style={{ padding: 10 }}>
          <option value="" disabled>Choisir…</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
          ))}
        </select>
        <button onClick={loadAll} disabled={!headers} style={{ marginLeft: 12, padding: 10 }}>
          Charger données
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Clients</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                 placeholder="Nom du client" style={{ padding: 10, width: 280 }} />
          <button onClick={createClient} disabled={!headers || newClientName.length < 2}>Créer</button>
        </div>
        <ul>
          {clients.map(c => <li key={c.id}>{c.name}</li>)}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Projets</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                 placeholder="Nom du projet" style={{ padding: 10, width: 280 }} />
          <button onClick={createProject} disabled={!headers || newProjectName.length < 2}>Créer</button>
        </div>
        <ul>
          {projects.map(p => <li key={p.id}>{p.name} — {p.status}</li>)}
        </ul>
      </section>
    </main>
  );
}
