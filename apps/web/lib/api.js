import { storage } from "./storage";

export async function apiFetch(path, { method = "GET", body, headers: extraHeaders } = {}) {
  const token = storage.getToken();
  const tenantId = storage.getTenantId();

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    ...(extraHeaders || {})
  };

  // Important: Content-Type uniquement si body JSON
  const hasBody = body !== undefined && body !== null;
  if (hasBody) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
