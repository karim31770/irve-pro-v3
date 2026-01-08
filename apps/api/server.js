import { runIrveCalculation } from "./calc_irve.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { withTx, setTenant, isUuid } from "./db.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api" }));

function httpError(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

function requireAuth(req) {
  const h = req.headers.authorization;
  if (!h || !h.toLowerCase().startsWith("bearer ")) throw httpError(401, "Missing Authorization Bearer token");
  return h.slice("bearer ".length).trim();
}

function requireTenant(req) {
  const t = req.headers["x-tenant-id"];
  if (typeof t !== "string" || !isUuid(t)) throw httpError(400, "Missing or invalid X-Tenant-Id");
  return t;
}

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
    if (m.rowCount === 0) throw httpError(403, "Forbidden (no membership for tenant)");

    req.user = { id: userId };
    req.tenant = { id: tenantId };
    req.membership = { role: m.rows[0].role };

    return handler(db);
  });
}

function requireRole(req, roles) {
  const r = req.membership?.role;
  if (!r || !roles.includes(r)) throw httpError(403, "Forbidden (insufficient role)");
}

async function requireProject(db, tenantId, projectId) {
  const r = await db.query(
    "select id, client_id, name, status, created_at from project where id = $1 and tenant_id = $2",
    [projectId, tenantId]
  );
  if (r.rowCount === 0) throw httpError(404, "Project not found");
  return r.rows[0];
}

// -----------------------------
// AUTH
// -----------------------------
app.post("/auth/signup", async (req, reply) => {
  const body = req.body ?? {};
  const tenantName = body.tenantName;
  const email = body.email;
  const password = body.password;

  if (typeof tenantName !== "string" || tenantName.length < 2) return reply.code(400).send({ error: "tenantName invalid" });
  if (typeof email !== "string" || !email.includes("@")) return reply.code(400).send({ error: "email invalid" });
  if (typeof password !== "string" || password.length < 8) return reply.code(400).send({ error: "password invalid (min 8 chars)" });

  const pwdHash = await hashPassword(password);

  const result = await withTx(async (db) => {
    const existing = await db.query("select id from app_user where email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) return { ok: false };

    const t = await db.query(
      "insert into tenant(name, status) values ($1, $2) returning id, name, status, created_at",
      [tenantName, "ACTIVE"]
    );

    const u = await db.query(
      "insert into app_user(email, password_hash) values ($1, $2) returning id, email, created_at",
      [email.toLowerCase(), pwdHash]
    );

    await db.query(
      "insert into membership(tenant_id, user_id, role) values ($1, $2, $3, $4)",
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

// -----------------------------
// CLIENTS
// -----------------------------


app.post("/clients", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;

  if (typeof name !== "string" || name.length < 2) return reply.code(400).send({ error: "name invalid" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);

    const r = await db.query(
      `insert into client(
         tenant_id, name, contact_name, phone, email,
         address_line1, address_line2, postal_code, city, country
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'FR'))
       returning id, name, created_at`,
      [
        req.tenant.id,
        name,
        body.contactName ?? null,
        body.phone ?? null,
        body.email ?? null,
        body.addressLine1 ?? null,
        body.addressLine2 ?? null,
        body.postalCode ?? null,
        body.city ?? null,
        body.country ?? null
      ]
    );

    return r.rows[0];
  });

  return reply.code(201).send(out);
});





app.get("/clients", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      "select id, name, created_at from client where tenant_id = $1 order by created_at desc limit 200",
      [req.tenant.id]
    );
    return r.rows;
  });
  return reply.send(out);
});



// -----------------------------
// SITES (simple)
// -----------------------------
app.post("/sites", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;
  const clientId = body.clientId;

  if (typeof name !== "string" || name.length < 2) return reply.code(400).send({ error: "name invalid" });
  if (clientId != null && (typeof clientId !== "string" || !isUuid(clientId))) return reply.code(400).send({ error: "clientId invalid" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER", "TECH"]);

    const r = await db.query(
      `insert into site(
         tenant_id, client_id, name, address_line1, postal_code, city, country, notes
       ) values (
         $1, $2, $3, $4, $5, $6, coalesce($7,FR), $8
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
       where tenant_id = $1
       order by created_at desc
       limit 200`,
      [req.tenant.id]
    );
    return r.rows;
  });
  return reply.send(out);
});

// -----------------------------
// PROJECTS
// -----------------------------

app.post("/projects", async (req, reply) => {
  const body = req.body ?? {};
  const name = body.name;
  const clientId = body.clientId ?? null;

  if (typeof name !== "string" || name.length < 2) return reply.code(400).send({ error: "name invalid" });
  if (!clientId || (typeof clientId !== "string") || !isUuid(clientId)) {
    return reply.code(400).send({ error: "clientId required" });
  }

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);

    const r = await db.query(
      `insert into project(tenant_id, client_id, name, status)
       values ($1, $2, $3, $4)
       returning id, client_id, name, status, created_at`,
      [req.tenant.id, clientId, name, "DRAFT"]
    );

    return r.rows[0];
  });

  return reply.code(201).send(out);
});




app.get("/projects", async (req, reply) => {
  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      `select p.id, p.client_id, p.name, p.status, p.created_at, c.name as client_name
       from project p
       left join client c on c.id = p.client_id
       where p.tenant_id = $1
       order by p.created_at desc
       limit 200`,
      [req.tenant.id]
    );
    return r.rows;
  });
  return reply.send(out);
});



app.get("/projects/:projectId", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    return requireProject(db, req.tenant.id, projectId);
  });
  return reply.send(out);
});

// -----------------------------
// Conception électrique (MVP)
// -----------------------------
app.get("/projects/:projectId/electrical-context", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    await requireProject(db, req.tenant.id, projectId);
    const r = await db.query(
      `select id, earthing_system, supply_phase, nominal_voltage_v, prospective_sc_ik_a, ambient_temp_c, voltage_drop_limit_percent, available_power_kw
       from electrical_context
       where tenant_id = $1 and project_id = $2`,
      [req.tenant.id, projectId]
    );
    return r.rows[0] ?? null;
  });

  return reply.send(out);
});

app.put("/projects/:projectId/electrical-context", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const body = req.body ?? {};

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      `insert into electrical_context(
         tenant_id, project_id,
         earthing_system, supply_phase, nominal_voltage_v, prospective_sc_ik_a,
         ambient_temp_c, voltage_drop_limit_percent, available_power_kw
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (project_id) do update set
         earthing_system = excluded.earthing_system,
         supply_phase = excluded.supply_phase,
         nominal_voltage_v = excluded.nominal_voltage_v,
         prospective_sc_ik_a = excluded.prospective_sc_ik_a,
         ambient_temp_c = excluded.ambient_temp_c,
         voltage_drop_limit_percent = excluded.voltage_drop_limit_percent,
         available_power_kw = excluded.available_power_kw
       returning id, earthing_system, supply_phase, nominal_voltage_v, prospective_sc_ik_a, ambient_temp_c, voltage_drop_limit_percent, available_power_kw`,
      [
        req.tenant.id, projectId,
        body.earthingSystem ?? null,
        body.supplyPhase ?? null,
        body.nominalVoltageV ?? null,
        body.prospectiveScIkA ?? null,
        body.ambientTempC ?? null,
        body.voltageDropLimitPercent ?? null,
        body.availablePowerKw ?? null
      ]
    );
    return r.rows[0];
  });

  return reply.send(out);
});

// EVSE
app.get("/projects/:projectId/evse", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    await requireProject(db, req.tenant.id, projectId);
    const r = await db.query(
      `select id, name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection, manufacturer, model, created_at
       from evse
       where tenant_id = $1 and project_id = $2
       order by created_at desc`,
      [req.tenant.id, projectId]
    );
    return r.rows;
  });

  return reply.send(out);
});

app.post("/projects/:projectId/evse", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const body = req.body ?? {};
  if (typeof body.name !== "string" || body.name.length < 2) return reply.code(400).send({ error: "name invalid" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      `insert into evse(
         tenant_id, project_id,
         name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection,
         manufacturer, model
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id, name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection, manufacturer, model, created_at`,
      [
        req.tenant.id, projectId,
        body.name,
        body.evseType ?? "AC",
        (() => {
        const p = Number(body.maxPowerKw ?? 7.4);
        if (body.evseType === 'AC' && p > 7.4) return 'TRI';
        return body.phase ?? 'MONO';
      })(),
        (() => {
        const p = Number(body.maxPowerKw ?? 7.4);
        if (body.evseType === 'AC' && p > 44) {
          const err = new Error('EVSE AC: puissance max 44 kW');
          err.statusCode = 400;
          throw err;
        }
        return p;
      })(),
        body.maxCurrentA ?? null,
        !!body.has6mADcDetection,
        body.manufacturer ?? null,
        body.model ?? null
      ]
    );
    return r.rows[0];
  });

  return reply.code(201).send(out);
});

app.delete("/projects/:projectId/evse/:evseId", async (req, reply) => {
  const { projectId, evseId } = req.params ?? {};
  if (!isUuid(projectId) || !isUuid(evseId)) return reply.code(400).send({ error: "invalid ids" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      "delete from evse where tenant_id = $1 and project_id = $2 and id = $3 returning id",
      [req.tenant.id, projectId, evseId]
    );
    if (r.rowCount === 0) throw httpError(404, "EVSE not found");
    return { ok: true };
  });

  return reply.send(out);
});

// Feeders
app.get("/projects/:projectId/feeders", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    await requireProject(db, req.tenant.id, projectId);
    const r = await db.query(
      `select f.id, f.name, f.evse_id, f.length_m, f.cable_section_mm2, f.notes, f.created_at,
              e.name as evse_name
       from feeder f
       left join evse e on e.id = f.evse_id
       where f.tenant_id = $1 and f.project_id = $2
       order by f.created_at desc`,
      [req.tenant.id, projectId]
    );
    return r.rows;
  });

  return reply.send(out);
});

app.post("/projects/:projectId/feeders", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const body = req.body ?? {};
  if (typeof body.name !== "string" || body.name.length < 2) return reply.code(400).send({ error: "name invalid" });
  if (body.evseId != null && (!isUuid(body.evseId))) return reply.code(400).send({ error: "evseId invalid" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      `insert into feeder(
         tenant_id, project_id, name, evse_id, length_m, cable_section_mm2, notes
       ) values ($1,$2,$3,$4,$5,$6,$7)
       returning id, name, evse_id, length_m, cable_section_mm2, notes, created_at`,
      [
        req.tenant.id, projectId,
        body.name,
        body.evseId ?? null,
        body.lengthM ?? 0,
        body.cableSectionMm2 ?? null,
        body.notes ?? null
      ]
    );
    return r.rows[0];
  });

  return reply.code(201).send(out);
});

app.delete("/projects/:projectId/feeders/:feederId", async (req, reply) => {
  const { projectId, feederId } = req.params ?? {};
  if (!isUuid(projectId) || !isUuid(feederId)) return reply.code(400).send({ error: "invalid ids" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      "delete from feeder where tenant_id = $1 and project_id = $2 and id = $3 returning id",
      [req.tenant.id, projectId, feederId]
    );
    if (r.rowCount === 0) throw httpError(404, "Feeder not found");
    return { ok: true };
  });

  return reply.send(out);
});


// -----------------------------
// CALCULATIONS (IRVE MVP)
// -----------------------------
app.post("/projects/:projectId/calculations/run", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);
    await requireProject(db, req.tenant.id, projectId);

    const ctx = await db.query(
      `select earthing_system, supply_phase, nominal_voltage_v, prospective_sc_ik_a, ambient_temp_c, voltage_drop_limit_percent, available_power_kw
       from electrical_context
       where tenant_id = $1 and project_id = $2`,
      [req.tenant.id, projectId]
    );

    const evse = await db.query(
      `select id, name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection
       from evse
       where tenant_id = $1 and project_id = $2`,
      [req.tenant.id, projectId]
    );

    const feeders = await db.query(
      `select id, name, evse_id, length_m, cable_section_mm2
       from feeder
       where tenant_id = $1 and project_id = $2`,
      [req.tenant.id, projectId]
    );

    let ctxRow = ctx.rows[0] ?? null;
    let ctxDefaultUsed = false;
    if (!ctxRow) {
      ctxDefaultUsed = true;
      ctxRow = {
        earthing_system: "TT",
        supply_phase: "MONO_230",
        nominal_voltage_v: 230,
        prospective_sc_ik_a: 3000,
        ambient_temp_c: 30,
        voltage_drop_limit_percent: 3
      };
    }

    const calc = runIrveCalculation({
      context: ctxRow,
      evseList: evse.rows,
      feederList: feeders.rows
    });

    if (ctxDefaultUsed) {
      calc.nonConformities = [
        {
          severity: "WARN",
          code: "CTX_DEFAULT_USED",
          standard_ref: null,
          clause_ref: null,
          message: "Contexte non enregistré : valeurs par défaut (profil Maison) appliquées pour le calcul. À valider sur site.",
          meta: { preset: "HOME_FR" }
        },
        ...(calc.nonConformities || [])
      ];
      if (calc.summary && typeof calc.summary.warns === "number") calc.summary.warns += 1;
    }

    const inputs = { context: ctxRow, evse: evse.rows, feeders: feeders.rows };
    const outputs = { ...calc };

    const run = await db.query(
      `insert into calculation_run(tenant_id, project_id, ruleset_name, ruleset_version, inputs_json, outputs_json, created_by)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, created_at`,
      [req.tenant.id, projectId, calc.ruleset.name, calc.ruleset.version, inputs, outputs, req.user.id]
    );

    for (const n of calc.nonConformities) {
      await db.query(
        `insert into non_conformity(tenant_id, run_id, severity, code, standard_ref, clause_ref, message, meta)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          req.tenant.id,
          run.rows[0].id,
          n.severity,
          n.code,
          n.standard_ref,
          n.clause_ref,
          n.message,
          n.meta ?? {}
        ]
      );
    }

    return { run_id: run.rows[0].id, created_at: run.rows[0].created_at, ...calc };
  });

  return reply.send(out);
});

app.get("/projects/:projectId/calculations/latest", async (req, reply) => {
  const projectId = req.params?.projectId;
  if (!isUuid(projectId)) return reply.code(400).send({ error: "invalid projectId" });

  const out = await withTenantContext(req, async (db) => {
    await requireProject(db, req.tenant.id, projectId);

    const r = await db.query(
      `select id, ruleset_name, ruleset_version, outputs_json, created_at
       from calculation_run
       where tenant_id = $1 and project_id = $2
       order by created_at desc
       limit 1`,
      [req.tenant.id, projectId]
    );
    if (r.rowCount === 0) return null;

    const nc = await db.query(
      `select severity, code, standard_ref, clause_ref, message, meta
       from non_conformity
       where run_id = $1
       order by created_at asc`,
      [r.rows[0].id]
    );

    return {
      run_id: r.rows[0].id,
      ruleset: { name: r.rows[0].ruleset_name, version: r.rows[0].ruleset_version },
      created_at: r.rows[0].created_at,
      ...r.rows[0].outputs_json,
      nonConformities: nc.rows
    };
  });

  return reply.send(out);
});


// -----------------------------
// CLIENT DETAIL (coords)
// -----------------------------
app.get("/clients/:clientId", async (req, reply) => {
  const clientId = req.params?.clientId;
  if (!isUuid(clientId)) return reply.code(400).send({ error: "invalid clientId" });

  const out = await withTenantContext(req, async (db) => {
    const r = await db.query(
      `select id, name, contact_name, phone, email, address_line1, address_line2, postal_code, city, country, created_at
       from client
       where tenant_id = $1 and id = $2`,
      [req.tenant.id, clientId]
    );
    if (r.rowCount === 0) throw httpError(404, "Client not found");
    return r.rows[0];
  });

  return reply.send(out);
});

app.put("/clients/:clientId", async (req, reply) => {
  const clientId = req.params?.clientId;
  if (!isUuid(clientId)) return reply.code(400).send({ error: "invalid clientId" });

  const body = req.body ?? {};

  const out = await withTenantContext(req, async (db) => {
    requireRole(req, ["ADMIN", "MANAGER"]);

    const r = await db.query(
      `update client set
         name = coalesce($3, name),
         contact_name = $4,
         phone = $5,
         email = $6,
         address_line1 = $7,
         address_line2 = $8,
         postal_code = $9,
         city = $10,
         country = coalesce($11, country)
       where tenant_id = $1 and id = $2
       returning id, name, contact_name, phone, email, address_line1, address_line2, postal_code, city, country, created_at`,
      [
        req.tenant.id, clientId,
        body.name ?? null,
        body.contactName ?? null,
        body.phone ?? null,
        body.email ?? null,
        body.addressLine1 ?? null,
        body.addressLine2 ?? null,
        body.postalCode ?? null,
        body.city ?? null,
        body.country ?? null
      ]
    );
    if (r.rowCount === 0) throw httpError(404, "Client not found");
    return r.rows[0];
  });

  return reply.send(out);
});

const port = Number(process.env.PORT ?? 4010);
await app.listen({ port, host: "0.0.0.0" });
