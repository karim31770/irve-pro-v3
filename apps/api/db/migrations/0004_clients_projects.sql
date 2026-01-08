-- Enrichit le client (coordonnées)
alter table client add column if not exists contact_name text;
alter table client add column if not exists phone text;
alter table client add column if not exists email text;

alter table client add column if not exists address_line1 text;
alter table client add column if not exists address_line2 text;
alter table client add column if not exists postal_code text;
alter table client add column if not exists city text;
alter table client add column if not exists country text default 'FR';

-- Lien projet -> client (nullable pour compat rétro)
alter table project add column if not exists client_id uuid references client(id) on delete set null;

create index if not exists idx_project_tenant_client on project(tenant_id, client_id);
