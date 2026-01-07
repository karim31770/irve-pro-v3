create table if not exists electrical_context (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references project(id) on delete cascade,

  earthing_system text,
  supply_phase text,
  nominal_voltage_v integer,
  prospective_sc_ik_a integer,

  ambient_temp_c numeric(6,2),
  voltage_drop_limit_percent numeric(6,2),

  created_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists evse (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references project(id) on delete cascade,

  name text not null,
  evse_type text not null,        -- AC/DC
  phase text not null,            -- MONO/TRI
  max_power_kw numeric(10,3) not null,
  max_current_a numeric(10,3),
  has_6mA_dc_detection boolean not null default false,

  manufacturer text,
  model text,

  created_at timestamptz not null default now()
);

create table if not exists feeder (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references project(id) on delete cascade,

  name text not null,
  evse_id uuid references evse(id) on delete set null,

  length_m numeric(10,2) not null default 0,
  cable_section_mm2 numeric(10,3),
  notes text,

  created_at timestamptz not null default now()
);

create index if not exists idx_ctx_tenant_project on electrical_context(tenant_id, project_id);
create index if not exists idx_evse_tenant_project on evse(tenant_id, project_id);
create index if not exists idx_feeder_tenant_project on feeder(tenant_id, project_id);
