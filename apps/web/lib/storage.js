export const storage = {
  getToken: () => (typeof window === "undefined" ? null : localStorage.getItem("token")),
  setToken: (t) => localStorage.setItem("token", t),
  clear: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    localStorage.removeItem("tenants");
    localStorage.removeItem("theme");
  },

  getTenants: () => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("tenants") || "[]"); } catch { return []; }
  },
  setTenants: (x) => localStorage.setItem("tenants", JSON.stringify(x || [])),

  getTenantId: () => (typeof window === "undefined" ? null : localStorage.getItem("tenantId")),
  setTenantId: (id) => localStorage.setItem("tenantId", id),

  getTheme: () => (typeof window === "undefined" ? "corporate" : (localStorage.getItem("theme") || "corporate")),
  setTheme: (t) => localStorage.setItem("theme", t)
};
