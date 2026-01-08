create table if not exists calculation_run (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references project(id) on delete cascade,

  ruleset_name text not null,
  ruleset_version text not null,

  inputs_json jsonb not null,
  outputs_json jsonb not null,

  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists non_conformity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null references calculation_run(id) on delete cascade,

  severity text not null,         -- INFO/WARN/BLOCK
  code text not null,
  standard_ref text,
  clause_ref text,
  message text not null,
  meta jsonb not null default jsonb_build_object(),

  created_at timestamptz not null default now()
);

create index if not exists idx_calc_run_tenant_project on calculation_run(tenant_id, project_id, created_at desc);
create index if not exists idx_nc_run on non_conformity(run_id);
