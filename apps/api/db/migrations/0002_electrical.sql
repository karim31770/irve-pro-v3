create extension if not exists pgcrypto;

create table if not exists electrical_context (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  earthing_system text not null,           -- TT / TN_S / TN_C / IT
  supply_phase text not null,              -- MONO_230 / TRI_400
  nominal_voltage_v integer not null,      -- 230 / 400
  prospective_sc_ik_a integer,             -- Ik amont (optionnel)
  voltage_drop_limit_percent numeric(6,2) not null default 3.00,
  ambient_temp_c numeric(6,2) not null default 30.00,
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id)
);

create table if not exists evse (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  name text not null,
  evse_type text not null,                 -- AC / DC
  phase text not null,                     -- MONO / TRI
  max_power_kw numeric(10,3) not null,
  max_current_a numeric(10,3),             -- optionnel si connu
  has_6ma_dc_detection boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists feeder (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  evse_id uuid references evse(id) on delete set null,
  name text not null,
  length_m numeric(10,2) not null default 0,
  cable_mm2 numeric(10,3),                 -- section (optionnel)
  conductor_material text not null default CU, -- CU / AL
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists calculation_run (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  inputs_json jsonb not null,
  outputs_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists non_conformity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  calculation_run_id uuid not null references calculation_run(id) on delete cascade,
  severity text not null,                  -- INFO / WARN / BLOCK
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ctx_proj on electrical_context(tenant_id, project_id);
create index if not exists idx_evse_proj on evse(tenant_id, project_id);
create index if not exists idx_feeder_proj on feeder(tenant_id, project_id);
create index if not exists idx_calc_proj on calculation_run(tenant_id, project_id);
