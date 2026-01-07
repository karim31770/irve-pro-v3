import Fastify from "fastify";
import cors from "@fastify/cors";
import { withTx, setTenant, isUuid } from "./db.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api" }));

function requireAuth(req) {
  const h = req.headers.authorization;
  if (!h || !h.toLowerCase().startsWith("bearer ")) {
    const err = new Error("Missing Authorization Bearer token");
    err.statusCode = 401;
    throw err;
  }
  return h.slice("bearer ".length).trim();
}

function requireTenant(req) {
  const t = req.headers["x-tenant-id"];
  if (typeof t !== "string" || !isUuid(t)) {
    const err = new Error("Missing or invalid X-Tenant-Id");
    err.statusCode = 400;
    throw err;
  }
  return t;
}

/**
 * Hook: ouvre une transaction + set tenant + vérifie membership
 * On met req.db (client PG) à disposition des routes.
 */
app.addHook("preHandler", async (req, reply) => {
  // routes publiques
  if (req.url.startsWith("/health")) return;
  if (req.url.startsWith("/auth/")) return;

  const token = requireAuth(req);
  const { userId } = await verifyToken(token);

  const tenantId = requireTenant(req);

  req.user = { id: userId };
  req.tenant = { id: tenantId };

  // Transaction par requête (simple et sûr au MVP)
  req._txResult = await withTx(async (db) => {
    await setTenant(db, tenantId);

    const m = await db.query(
      "select role from membership where tenant_id = $1 and user_id = $2",
      [tenantId, userId]
    );
    if (m.rowCount === 0) {
      const err = new Error("Forbidden (no membership for tenant)");
      err.statusCode = 403;
      throw err;
    }
    req.membership = { role: m.rows[0].role };
    req.db = db;

    // Ne rien retourner ici: les routes vont utiliser req.db
    return true;
  });

  // IMPORTANT:
  // withTx commit/rollback se fait après l’exécution du callback.
  // Ici, on a déjà quitté le callback => commit déjà fait.
  // Donc on ne peut pas réutiliser req.db après.
  //
  // => Pour le MVP, on ne fait pas un tx global dans preHandler.
  // On fera un helper par route (voir below).
});

/**
 * Helper route-level : ouvre une tx, set tenant, vérifie membership, puis exécute handler.
 * (On le fait ici car preHandler ne peut pas garder le client ouvert.)
 */
async function withTenantContext(req, handler) {
  const token = requireAuth(req);
  const { userId } = await verifyToken(token);
  const tenantId = requireTenant(req);

  return withTx(async (db) => {
    await setTenant(db, tenantId);

    const m = await db.query(
      "select role from membership where tenant_id = $1 and user_id = $2",
      [tenantId, userId]
    );
    if (m.rowCount === 0) {
      const err = new Error("Forbidden (no membership for tenant)");
      err.statusCode = 403;
      throw err;
    }

    req.user = { id: userId };
    req.tenant = { id: tenantId };
    req.membership = { role: m.rows[0].role };

    return handler(db);
  });
}

function requireRole(req, roles) {
  const r = req.membership?.role;
  if (!r || !roles.includes(r)) {
    const err = new Error("Forbidden (insufficient role)");
    err.statusCode = 403;
    throw err;
  }
}

// -----------------------------
// AUTH
// -----------------------------
app.post("/auth/signup", async (req, reply) => {
  const body = req.body ?? {};
  const tenantName = body.tenantName;
  const email = body.email;
  const password = body.password;

  if (typeof tenantName !== "string" || tenantName.length < 2) {
    return reply.code(400).send({ error: "tenantName invalid" });
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return reply.code(400).send({ error: "email invalid" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return reply.code(400).send({ error: "password invalid (min 8 chars)" });
  }

  const pwdHash = await hashPassword(password);

  const result = await withTx(async (db) => {
    const existing = await db.query("select id from app_user where email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return { ok: false, reason: "EMAIL_EXISTS" };
    }

    const t = await db.query(
      "insert into tenant(name, status) values ($1, 'ACTIVE') returning id, name, status, created_at",
      [tenantName]
    );

    const u = await db.query(
      "insert into app_user(email, password_hash) values ($1, $2) returning id, email, created_at",
      [email.toLowerCase(), pwdHash]
    );

    await db.query(
      "insert into membership(tenant_id, user_id, role) values ($1, $2, $3)",
      [t.rows[0].id, u.rows[0].id, "ADMIN"]
    );

    return { ok: true, tenant: t.rows[0], user: u.rows[0] };
  });

  if (!result.ok) return reply.code(409).send({ error: "email already exists" });

  const token = await signToken({ userId: result.user.id });
  return reply.send({ token, tenant: result.tenant, user: result.user });
});

app.post("/auth/login", async (req, reply) => {
  const body = req.body ?? {};
  const email = body.email;
  const password = body.password;

  if (typeof email !== "string" || typeof password !== "string") {
    return reply.code(400).send({ error: "email/password required" });
  }

  const result = await withTx(async (db) => {
    const u = await db.query(
      "select id, email, password_hash, is_active from app_user where email = $1",
      [email.toLowerCase()]
    );
    if (u.rowCount === 0) return { ok: false };

    const user = u.rows[0];
    if (!user.is_active) return { ok: false };

    const passOk = await verifyPassword(password, user.password_hash);
    if (!passOk) return { ok: false };

    const tenants = await db.query(
      `select t.id, t.name, t.status, m.role
       from membership m join tenant t on t.id = m.tenant_id
       where m.user_id = $1
       order by t.created_at asc`,
      [user.id]
    );

    return { ok: true, user: { id: user.id, email: user.email }, tenants: tenants.rows };
  });

  if (!result.ok) return reply.code(401).send({ error: "invalid credentials" });

  const token = await signToken({ userId: result.user.id });
  return reply.send({ token, user: result.user, tenants: result.tenants });
});

app.get("/me", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const u = await db.query("select id, email, created_at from app_user where id = $1", [req.user.id]);
    return {
      user: u.rows[0],
      tenant: { id: req.tenant.id },
      role: req.membership.role
    };
  });
  return reply.send(out);
});

// -----------------------------
// CRUD: CLIENTS
// -----------------------------
app.post("/clients", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;
  if (typeof name !== "string" || name.length < 2) {
    return reply.code(400).send({ error: "name invalid" });
  }

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN","MANAGER"]);

    const r = await db.query(
      "insert into client(tenant_id, name) values (nullif(current_setting(app.tenant_id, true), )::uuid, $1) returning id, name, created_at",
      [name]
    );
    return r.rows[0];
  });

  return reply.code(201).send(out);
});

app.get("/clients", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      "select id, name, created_at from client order by created_at desc limit 200"
    );
    return r.rows;
  });
  return reply.send(out);
});

// -----------------------------
// CRUD: SITES
// -----------------------------
app.post("/sites", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;
  const clientId = body.clientId;

  if (typeof name !== "string" || name.length < 2) {
    return reply.code(400).send({ error: "name invalid" });
  }
  if (clientId != null && (typeof clientId !== "string" || !isUuid(clientId))) {
    return reply.code(400).send({ error: "clientId invalid" });
  }

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN","MANAGER","TECH"]);

    const r = await db.query(
      `insert into site(
         tenant_id, client_id, name, address_line1, postal_code, city, country, notes
       ) values (
         nullif(current_setting(app.tenant_id, true), )::uuid,
         $1, $2, $3, $4, $5, coalesce($6,FR), $7
       )
       returning id, client_id, name, address_line1, postal_code, city, country, created_at`,
      [
        req.tenant.id,
        clientId ?? null,
        name,
        body.addressLine1 ?? null,
        body.postalCode ?? null,
        body.city ?? null,
        body.country ?? null,
        body.notes ?? null
      ]
    );
    return r.rows[0];
  });

  return reply.code(201).send(out);
});

app.get("/sites", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      `select id, client_id, name, address_line1, postal_code, city, country, created_at
       from site
       order by created_at desc
       limit 200`
    );
    return r.rows;
  });
  return reply.send(out);
});

// -----------------------------
// CRUD: PROJECTS
// -----------------------------
app.post("/projects", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;
  const clientId = body.clientId;
  const siteId = body.siteId;

  if (typeof name !== "string" || name.length < 2) {
    return reply.code(400).send({ error: "name invalid" });
  }
  if (clientId != null && (typeof clientId !== "string" || !isUuid(clientId))) {
    return reply.code(400).send({ error: "clientId invalid" });
  }
  if (siteId != null && (typeof siteId !== "string" || !isUuid(siteId))) {
    return reply.code(400).send({ error: "siteId invalid" });
  }

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN","MANAGER"]);

    const r = await db.query(
      `insert into project(tenant_id, client_id, site_id, name, status)
       values (nullif(current_setting(app.tenant_id, true), )::uuid, $1, $2, $3, DRAFT)
       returning id, client_id, site_id, name, status, created_at`,
      [req.tenant.id, clientId ?? null, siteId ?? null, name]
    );
    return r.rows[0];
  });

  return reply.code(201).send(out);
});

app.get("/projects", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      `select id, client_id, site_id, name, status, created_at
       from project
       order by created_at desc
       limit 200`
    );
    return r.rows;
  });
  return reply.send(out);
});

// -----------------------------
const port = Number(process.env.PORT ?? 4010);
await app.listen({ port, host: "0.0.0.0" });
