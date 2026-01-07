create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists membership (
  tenant_id uuid not null references tenant(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

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
  country text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists project (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid references client(id) on delete set null,
  site_id uuid references site(id) on delete set null,
  name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_user_id uuid references app_user(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default jsonb_build_object(),
  created_at timestamptz not null default now()
);

create index if not exists idx_membership_user on membership(user_id);
create index if not exists idx_client_tenant on client(tenant_id);
create index if not exists idx_site_tenant on site(tenant_id);
create index if not exists idx_project_tenant on project(tenant_id);
