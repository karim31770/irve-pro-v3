const SQRT3 = Math.sqrt(3);

// Heuristiques MVP (à remplacer par abaques normatifs licenciés + corrections)
const STANDARD_BREAKERS_A = [10, 16, 20, 25, 32, 40, 50, 63];
const STANDARD_ICU_KA = [6, 10, 15, 25];

// Résistivité cuivre approx à 20°C (ohm*mm²/m)
const RHO_CU = 0.0175;

function nextStandardBreaker(ib) {
  for (const a of STANDARD_BREAKERS_A) if (a >= ib) return a;
  return STANDARD_BREAKERS_A[STANDARD_BREAKERS_A.length - 1];
}

function recommendCableSection(ib) {
  // mapping très simplifié (MVP). Remplacer par tables NF C 15-100.
  if (ib <= 16) return 2.5;
  if (ib <= 25) return 4;
  if (ib <= 32) return 6;
  if (ib <= 45) return 10;
  if (ib <= 63) return 16;
  return 25;
}

function estimateVoltageDropPercent({ phase, lengthM, currentA, sectionMm2, nominalVoltageV }) {
  if (!lengthM || !currentA || !sectionMm2 || !nominalVoltageV) return null;

  const L = Number(lengthM);
  const I = Number(currentA);
  const S = Number(sectionMm2);
  const U = Number(nominalVoltageV);

  if (!(L > 0 && I > 0 && S > 0 && U > 0)) return null;

  // ΔU ≈ k * ρ * L * I / S
  // mono : k=2 ; tri : k=√3
  const k = (phase === "TRI") ? SQRT3 : 2;
  const dU = k * RHO_CU * L * I / S; // volts
  return (dU / U) * 100;
}

function recommendIcuKa(ikA) {
  if (!ikA || ikA <= 0) return null;
  const ikKa = ikA / 1000;
  for (const kA of STANDARD_ICU_KA) if (kA >= ikKa) return kA;
  return STANDARD_ICU_KA[STANDARD_ICU_KA.length - 1];
}

function nc(severity, code, message, standardRef = null, clauseRef = null, meta = {}) {
  return { severity, code, message, standard_ref: standardRef, clause_ref: clauseRef, meta };
}

export function runIrveCalculation({ context, evseList, feederList }) {
  const ruleset = { name: "IRVE_MVP", version: "2026-01" };

  const nonConformities = [];
  if (!context) {
    nonConformities.push(
      nc("BLOCK", "CTX_MISSING", "Contexte électrique absent : renseigner TT/TN/IT, mono/tri, tension, etc.")
    );
  }

  const supplyPhase = context?.supply_phase || "MONO_230";
  const defaultU = supplyPhase === "TRI_400" ? 400 : 230;
  const nominalVoltageV = Number(context?.nominal_voltage_v ?? defaultU);
  const vdropLimit = Number(context?.voltage_drop_limit_percent ?? 3);
  const ikA = context?.prospective_sc_ik_a != null ? Number(context.prospective_sc_ik_a) : null;

  if (!ikA) {
    nonConformities.push(
      nc("WARN", "IK_MISSING", "Ik présumé non renseigné : vérifier pouvoir de coupure des protections (Icu).")
    );
  }

  const evseById = new Map(evseList.map(e => [e.id, e]));
  const items = [];

  for (const f of feederList) {
    const evse = f.evse_id ? evseById.get(f.evse_id) : null;

    if (!evse) {
      nonConformities.push(
        nc("WARN", "FEEDER_NO_EVSE", `Le départ "${f.name}" n'est lié à aucune EVSE : impossible d'inférer P/I automatiquement.`, null, null, { feeder_id: f.id })
      );
    }

    const evsePhase = evse?.phase || "MONO"; // MONO/TRI
    const phase = evsePhase === "TRI" ? "TRI" : "MONO";

    const pKw = evse?.max_power_kw != null ? Number(evse.max_power_kw) : null;
    let ib = null;

    if (pKw && nominalVoltageV) {
      if (phase === "TRI") ib = (pKw * 1000) / (SQRT3 * nominalVoltageV);
      else ib = (pKw * 1000) / nominalVoltageV;
    }

    if (!ib) {
      nonConformities.push(
        nc("WARN", "IB_UNKNOWN", `Courant d'emploi (Ib) non calculable pour "${f.name}" : renseigner EVSE + tension.`, null, null, { feeder_id: f.id })
      );
    }

    const chosenCable = f.cable_section_mm2 != null ? Number(f.cable_section_mm2) : null;
    const cable = chosenCable || (ib ? recommendCableSection(ib) : null);

    const vdrop = (ib && cable)
      ? estimateVoltageDropPercent({
          phase,
          lengthM: Number(f.length_m ?? 0),
          currentA: ib,
          sectionMm2: cable,
          nominalVoltageV
        })
      : null;

    if (vdrop != null && vdropLimit != null && vdrop > vdropLimit) {
      nonConformities.push(
        nc(
          "WARN",
          "VDROP_HIGH",
          `Chute de tension estimée ${vdrop.toFixed(2)}% > ${vdropLimit}% sur "${f.name}".`,
          "NF C 15-100",
          "chute_de_tension (réf interne)",
          { feeder_id: f.id, vdrop, limit: vdropLimit }
        )
      );
    }

    const breakerIn = ib ? nextStandardBreaker(ib) : null;
    const icuKa = ikA ? recommendIcuKa(ikA) : null;

    // RCD / IRVE logic (MVP)
    let rcdType = "A";
    const rcdSens = 30;

    if (evse?.evse_type === "AC") {
      const has6 = !!evse.has_6ma_dc_detection;
      if (!has6) {
        nonConformities.push(
          nc(
            "BLOCK",
            "IRVE_DC_6MA_MISSING",
            `EVSE "${evse.name}" déclarée sans détection DC 6 mA : vérifier le choix/architecture du différentiel amont (risque composante DC).`,
            "IEC 60364-7-722",
            "DC leakage (réf interne)",
            { evse_id: evse.id, feeder_id: f.id }
          )
        );
        rcdType = "B?";
      }
    } else if (evse?.evse_type === "DC") {
      nonConformities.push(
        nc(
          "WARN",
          "EVSE_DC_CHECK",
          "EVSE DC : vérifier protections et exigences spécifiques constructeur/architecture.",
          "IEC 60364-7-722",
          "DC charger (réf interne)",
          { evse_id: evse?.id }
        )
      );
      rcdType = "B?";
    }

    items.push({
      feeder_id: f.id,
      feeder_name: f.name,
      evse_id: evse?.id ?? null,
      evse_name: evse?.name ?? null,
      p_kw: pKw,
      ib_a: ib,
      cable_section_mm2: cable,
      length_m: Number(f.length_m ?? 0),
      vdrop_percent: vdrop,
      breaker_in_a: breakerIn,
      breaker_icu_ka: icuKa,
      rcd_type: rcdType,
      rcd_sensitivity_ma: rcdSens
    });
  }

  const summary = {
    feeders: feederList.length,
    evse: evseList.length,
    blocks: nonConformities.filter(n => n.severity === "BLOCK").length,
    warns: nonConformities.filter(n => n.severity === "WARN").length
  };

  return { ruleset, summary, items, nonConformities };
}
