-- Puissance dispo (pour délesteur)
alter table electrical_context add column if not exists available_power_kw numeric(10,3);
alter table electrical_context add column if not exists main_breaker_in_a integer;
