create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

-- Tenants
create table if not exists tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default ACTIVE check (status in (ACTIVE,SUSPENDED)),
  created_at timestamptz not null default now()
);

-- Users (global, pas tenantés)
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Membership (lie user <-> tenant)
create table if not exists membership (
  tenant_id uuid not null references tenant(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role text not null check (role in (ADMIN,MANAGER,TECH,ACCOUNTING)),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Entités métier (tenantées)
create table if not exists client (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists site (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid references client(id) on delete set null,
  name text not null,
  address_line1 text,
  postal_code text,
  city text,
  country text default FR,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists project (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid references client(id) on delete set null,
  site_id uuid references site(id) on delete set null,
  name text not null,
  status text not null default DRAFT check (status in (DRAFT,IN_PROGRESS,DONE,ARCHIVED)),
  created_at timestamptz not null default now()
);

-- Audit minimal (tenanté)
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_user_id uuid references app_user(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default {}::jsonb,
  created_at timestamptz not null default now()
);

-- Index
create index if not exists idx_membership_user on membership(user_id);
create index if not exists idx_client_tenant on client(tenant_id);
create index if not exists idx_site_tenant on site(tenant_id);
create index if not exists idx_project_tenant on project(tenant_id);

-- -----------------------------
-- RLS: on force pour éviter le bypass par le owner
-- -----------------------------
alter table client enable row level security;
alter table site enable row level security;
alter table project enable row level security;
alter table audit_log enable row level security;

alter table client force row level security;
alter table site force row level security;
alter table project force row level security;
alter table audit_log force row level security;

-- helper: récupère tenant_id depuis setting (safe si non défini)
-- nullif(...,) protège les casts
create policy tenant_isolation_client on client
  using (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid)
  with check (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid);

create policy tenant_isolation_site on site
  using (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid)
  with check (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid);

create policy tenant_isolation_project on project
  using (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid)
  with check (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid);

create policy tenant_isolation_audit on audit_log
  using (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid)
  with check (tenant_id = nullif(current_setting(app.tenant_id, true), )::uuid);
