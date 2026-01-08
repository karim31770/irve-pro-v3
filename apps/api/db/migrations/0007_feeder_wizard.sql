alter table feeder add column if not exists install_method text;         -- INDOOR/OUTDOOR/UNDERGROUND/PARKING (simple)
alter table feeder add column if not exists cable_type text;             -- ex: U1000_R2V
alter table feeder add column if not exists conductors text;             -- ex: 3G / 5G
alter table feeder add column if not exists cable_section_source text;   -- AUTO/USER
