import pg from "pg";
const { Pool } = pg;

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const pool = new Pool({ connectionString: mustEnv("DATABASE_URL") });

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    try { await client.query("rollback"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

export async function setTenant(client, tenantId) {
  // SET LOCAL ne vaut que pour la transaction en cours
  await client.query("select set_config(app.tenant_id, $1, true)", [tenantId]);
}

export function isUuid(v) {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
