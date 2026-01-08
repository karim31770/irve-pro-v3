import { runIrveCalculation } from "./calc_irve.js";

const SQRT3 = Math.sqrt(3);

const PRESETS = {
  HOME_FR: {
    earthing_system: "TT",
    supply_phase: "MONO_230",
    nominal_voltage_v: 230,
    prospective_sc_ik_a: 3000,
    ambient_temp_c: 30,
    voltage_drop_limit_percent: 3,
    available_power_kw: 9
  }
};

const EVSE_PROFILES = {
  AC_3_7:  { evse_type: "AC", phase: "MONO", max_power_kw: 3.7, max_current_a: 16 },
  AC_7_4:  { evse_type: "AC", phase: "MONO", max_power_kw: 7.4, max_current_a: 32 },
  AC_11:   { evse_type: "AC", phase: "TRI",  max_power_kw: 11,  max_current_a: 16 },
  AC_22:   { evse_type: "AC", phase: "TRI",  max_power_kw: 22,  max_current_a: 32 },
  AC_44:   { evse_type: "AC", phase: "TRI",  max_power_kw: 44,  max_current_a: 63 }
};

function autoSupplyFromEvse(evsePhase) {
  return evsePhase === "TRI" ? { supply_phase: "TRI_400", nominal_voltage_v: 400 } : { supply_phase: "MONO_230", nominal_voltage_v: 230 };
}

function cableDefaults(installMethod, evsePhase) {
  const conductors = evsePhase === "TRI" ? "5G" : "3G";
  // MVP: type câble simple. Tu pourras raffiner.
  let cableType = "U1000_R2V";
  if (installMethod === "UNDERGROUND") cableType = "U1000_R2V_IN_TPC";
  if (installMethod === "PARKING") cableType = "U1000_R2V_PROTECTED";
  return { conductors, cableType };
}

async function insertCalculationRun(db, tenantId, projectId, userId, ctxRow, evseRows, feederRows) {
  const calc = runIrveCalculation({ context: ctxRow, evseList: evseRows, feederList: feederRows });

  const inputs = { context: ctxRow, evse: evseRows, feeders: feederRows };
  const outputs = { ...calc };

  const runRes = await db.query(
    `insert into calculation_run(tenant_id, project_id, ruleset_name, ruleset_version, inputs_json, outputs_json, created_by)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning id, created_at`,
    [tenantId, projectId, calc.ruleset.name, calc.ruleset.version, inputs, outputs, userId]
  );

  const runId = runRes.rows[0].id;
  for (const n of (calc.nonConformities || [])) {
    await db.query(
      `insert into non_conformity(tenant_id, run_id, severity, code, standard_ref, clause_ref, message, meta)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tenantId, runId, n.severity, n.code, n.standard_ref ?? null, n.clause_ref ?? null, n.message, n.meta ?? {}]
    );
  }

  return { runId, createdAt: runRes.rows[0].created_at, calc };
}

export async function runProjectWizard(db, { tenantId, userId, payload }) {
  const presetKey = payload?.preset ?? "HOME_FR";
  const preset = PRESETS[presetKey] ?? PRESETS.HOME_FR;

  // ---- Client ----
  let clientId = payload?.client?.id ?? null;
  if (!clientId) {
    const cn = payload?.client?.name;
    if (typeof cn !== "string" || cn.length < 2) throw Object.assign(new Error("client.name required"), { statusCode: 400 });

    const c = await db.query(
      `insert into client(
         tenant_id, name, contact_name, phone, email,
         address_line1, address_line2, postal_code, city, country
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'FR'))
       returning id`,
      [
        tenantId,
        cn,
        payload?.client?.contactName ?? null,
        payload?.client?.phone ?? null,
        payload?.client?.email ?? null,
        payload?.client?.addressLine1 ?? null,
        payload?.client?.addressLine2 ?? null,
        payload?.client?.postalCode ?? null,
        payload?.client?.city ?? null,
        payload?.client?.country ?? null
      ]
    );
    clientId = c.rows[0].id;
  }

  // ---- Site ----
  const siteName = payload?.site?.name ?? "Site principal";
  const siteRes = await db.query(
    `insert into site(tenant_id, client_id, name, address_line1, postal_code, city, country, notes)
     values ($1,$2,$3,$4,$5,$6,coalesce($7,'FR'),$8)
     returning id`,
    [
      tenantId,
      clientId,
      siteName,
      payload?.site?.addressLine1 ?? null,
      payload?.site?.postalCode ?? null,
      payload?.site?.city ?? null,
      payload?.site?.country ?? null,
      payload?.site?.notes ?? null
    ]
  );
  const siteId = siteRes.rows[0].id;

  // ---- Projet ----
  const projectName = payload?.project?.name;
  if (typeof projectName !== "string" || projectName.length < 2) throw Object.assign(new Error("project.name required"), { statusCode: 400 });

  const projRes = await db.query(
    `insert into project(tenant_id, client_id, site_id, name, status)
     values ($1,$2,$3,$4,'DRAFT')
     returning id, name, status, client_id, site_id, created_at`,
    [tenantId, clientId, siteId, projectName]
  );
  const project = projRes.rows[0];

  // ---- EVSE ----
  const profileKey = payload?.evse?.profile ?? "AC_7_4";
  const profile = EVSE_PROFILES[profileKey];
  if (!profile) throw Object.assign(new Error("evse.profile invalid"), { statusCode: 400 });

  if (profile.evse_type === "AC" && profile.max_power_kw > 44) {
    throw Object.assign(new Error("EVSE AC: puissance max 44 kW"), { statusCode: 400 });
  }

  const evseName = payload?.evse?.name ?? "Borne 1";
  const has6 = !!payload?.evse?.has6mADcDetection;

  const evseRes = await db.query(
    `insert into evse(tenant_id, project_id, name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection, manufacturer, model)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning id, name, evse_type, phase, max_power_kw, max_current_a, has_6ma_dc_detection`,
    [tenantId, project.id, evseName, profile.evse_type, profile.phase, profile.max_power_kw, profile.max_current_a, has6, payload?.evse?.manufacturer ?? null, payload?.evse?.model ?? null]
  );
  const evseRow = evseRes.rows[0];

  // ---- Contexte ----
  // Applique preset + overrides simples + auto mono/tri depuis EVSE
  const auto = autoSupplyFromEvse(profile.phase);
  const ctxRow = {
    ...preset,
    ...auto,
    earthing_system: payload?.context?.earthingSystem ?? preset.earthing_system,
    prospective_sc_ik_a: payload?.context?.prospectiveScIkA ?? preset.prospective_sc_ik_a,
    available_power_kw: payload?.context?.availablePowerKw ?? preset.available_power_kw,
    voltage_drop_limit_percent: payload?.context?.voltageDropLimitPercent ?? preset.voltage_drop_limit_percent,
    ambient_temp_c: payload?.context?.ambientTempC ?? preset.ambient_temp_c
  };

  await db.query(
    `insert into electrical_context(
       tenant_id, project_id, earthing_system, supply_phase, nominal_voltage_v, prospective_sc_ik_a,
       ambient_temp_c, voltage_drop_limit_percent, available_power_kw
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (project_id) do update set
       earthing_system = excluded.earthing_system,
       supply_phase = excluded.supply_phase,
       nominal_voltage_v = excluded.nominal_voltage_v,
       prospective_sc_ik_a = excluded.prospective_sc_ik_a,
       ambient_temp_c = excluded.ambient_temp_c,
       voltage_drop_limit_percent = excluded.voltage_drop_limit_percent,
       available_power_kw = excluded.available_power_kw`,
    [tenantId, project.id, ctxRow.earthing_system, ctxRow.supply_phase, ctxRow.nominal_voltage_v, ctxRow.prospective_sc_ik_a, ctxRow.ambient_temp_c, ctxRow.voltage_drop_limit_percent, ctxRow.available_power_kw]
  );

  // ---- Départ ----
  const lengthM = Number(payload?.feeder?.lengthM ?? 20);
  const installMethod = payload?.feeder?.installMethod ?? "INDOOR";
  const { cableType, conductors } = cableDefaults(installMethod, profile.phase);

  const feederName = payload?.feeder?.name ?? `Départ ${evseName}`;
  const feederRes = await db.query(
    `insert into feeder(tenant_id, project_id, name, evse_id, length_m, install_method, cable_type, conductors, cable_section_mm2, cable_section_source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning id, name, evse_id, length_m, cable_section_mm2`,
    [tenantId, project.id, feederName, evseRow.id, lengthM, installMethod, cableType, conductors, null, null]  # placeholders handled by pg (null)
  );
  const feederRow = feederRes.rows[0];

  // ---- Calcul + persist + update section AUTO ----
  const evseList = [evseRow];
  const feederList = [{
    id: feederRow.id,
    name: feederRow.name,
    evse_id: evseRow.id,
    length_m: lengthM,
    cable_section_mm2: null
  }];

  const { runId, createdAt, calc } = await insertCalculationRun(db, tenantId, project.id, userId, ctxRow, evseList, feederList);

  // met à jour la section recommandée dans feeder (AUTO) si calcul en propose une
  const first = (calc.items || [])[0];
  if (first?.cable_section_mm2) {
    await db.query(
      `update feeder set cable_section_mm2 = $4, cable_section_source = 'AUTO'
       where tenant_id = $1 and project_id = $2 and id = $3`,
      [tenantId, project.id, feederRow.id, first.cable_section_mm2]
    );
  }

  return {
    project,
    client_id: clientId,
    site_id: siteId,
    wizard: {
      evse: evseRow,
      feeder_id: feederRow.id,
      calculation: { run_id: runId, created_at: createdAt, summary: calc.summary }
    }
  };
}
