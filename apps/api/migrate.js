import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const DATABASE_URL = mustEnv("DATABASE_URL");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "db", "migrations");

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Ensure schema_migrations exists (in case migration file not yet applied)
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedRes = await client.query("select id from schema_migrations");
    const applied = new Set(appliedRes.rows.map((r) => r.id));

    for (const file of files) {
      if (applied.has(file)) continue;

      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, "utf8");

      console.log(`[migrate] applying ${file}`);
      await client.query(sql);
      await client.query("insert into schema_migrations(id) values ($1)", [file]);
    }

    await client.query("commit");
    console.log("[migrate] done");
  } catch (e) {
    await client.query("rollback");
    console.error("[migrate] failed:", e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
