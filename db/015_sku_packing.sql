-- =====================================================================
-- SKUs and what was packed into them each day
--
-- A bulk batch (Toned Milk, Paneer, Desi Ghee...) is packed into SKUs: the
-- pouches, cups, jars and buckets that are sold. `sku` is the 53-line list
-- from the stock app - code, name, category, the case it is counted in
-- (CRT / CBX / PCS / KG) and pieces per case. Each SKU can be linked to the
-- bulk product it is filled from, with how much of that bulk product one
-- piece holds (in the bulk product's own unit), so a day's packing can be
-- checked against that day's yield.
--
-- `sku_pack_day` is one SKU on one day: full cases plus loose pieces.
-- =====================================================================

create table sku (
  id                uuid primary key default gen_random_uuid(),
  scenario_id       uuid not null references scenario(id) on delete cascade,
  code              text not null,                 -- the SKU code used by the stock app, e.g. 1003
  name              text not null,
  category          text not null,
  case_unit         text not null default 'PCS',   -- what a case is called: CRT, CBX, PCS, KG
  pcs_per_case      int not null default 1 check (pcs_per_case > 0),
  shelf_life_days   int,
  bulk_product_id   uuid references bulk_product(id) on delete set null,
  bulk_qty_per_pc   numeric(20, 4) check (bulk_qty_per_pc >= 0),   -- kg or L of the bulk product in one piece
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  unique (scenario_id, code)
);

create table sku_pack_day (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  sku_id       uuid not null references sku(id) on delete cascade,
  day          date not null,
  cases        numeric(20, 3) not null default 0 check (cases >= 0),
  loose_pcs    numeric(20, 3) not null default 0 check (loose_pcs >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sku_id, day)
);

create index on sku_pack_day (scenario_id, day desc);

create trigger sku_pack_day_touch before update on sku_pack_day
  for each row execute function touch_updated_at();

-- The 53 SKUs, in the stock app's order. bulk = the bulk product code it is
-- filled from (null where it isn't certain - set it on the page); per_pc =
-- kg or L of that bulk product in one piece. Ghee jars are sold by volume but
-- ghee is made by weight: 1 L of ghee is taken as 0.91 kg.
with seed (ord, code, name, category, case_unit, pcs, shelf, bulk, per_pc) as (values
  ( 1, '1003', 'Gaia Doodh Toned 500ml- Pkt',                    'Milk',       'CRT', 24,   2, 'toned_milk',             0.5),
  ( 2, '999',  'Gaia Cow Milk 500 ML (Crt)',                     'Milk',       'CRT', 24,   2, 'cow_milk',               0.5),
  ( 3, '1042', 'Gaia Maxx UHT 110ml',                            'UHT Milk',   'CBX', 40,  90, null,                     0.11),
  ( 4, '1045', 'Gaia Maxx UHT 400ml',                            'UHT Milk',   'CBX', 20,  90, null,                     0.4),
  ( 5, '1050', 'Gaia Premium Milk UHT Tetra Pack 1 Ltr',         'UHT Milk',   'CBX', 12, 180, null,                     1),
  ( 6, '1051', 'Gaia Lite Milk UHT Tetra Pack 1Ltr',             'UHT Milk',   'CBX', 12, 180, null,                     1),
  ( 7, '1052', 'Gaia Gold Milk UHT Tetra Pack 1Ltr',             'UHT Milk',   'CBX', 12, 180, null,                     1),
  ( 8, '1012', 'Gaia Dahi (Crt) 200 Gms 60 Pkt',                 'Dahi',       'CRT', 60,  17, null,                     0.2),
  ( 9, '1013', 'Gaia Dahi 400 Gms (Crt) 30 Pkt',                 'Dahi',       'CRT', 30,  17, null,                     0.4),
  (10, '1014', 'Gaia Dahi 1 Kg- 12 Packets',                     'Dahi',       'CRT', 12,  17, null,                     1),
  (11, '1015', 'Gaia Dahi 5kg Pouch (2pcs)',                     'Dahi',       'CRT',  2,  17, null,                     5),
  (12, '1047', 'Gaia Dahi Bucket 5 Kg',                          'Dahi',       'PCS',  1,  17, null,                     5),
  (13, '1016', 'Gaia Dahi Bucket 15 Kg',                         'Dahi',       'PCS',  1,  17, null,                     15),
  (14, '1056', 'Gaia Dahi Cup 200 Gms Box(6Pc)',                 'Dahi',       'CBX',  6,  17, null,                     0.2),
  (15, '1011', 'Gaia Dahi (Cup) 200 Gms',                        'Dahi',       'CBX', 30,  17, null,                     0.2),
  (16, '1010', 'Gaia Mishti Doi 80g',                            'Dahi',       'CBX', 12,   5, 'misti_doi',              0.08),
  (17, '1026', 'Gaia Premium Sweet Dahi (Lychee) Cup 90 Gms',    'Dahi',       'CBX', 12,   7, 'sweet_dahi_lychee',      0.09),
  (18, '1027', 'Gaia Premium Sweet Dahi (Muskmelon) Cup 90 Gms', 'Dahi',       'PCS',  1,   7, 'sweet_dahi_muskmelon',   0.09),
  (19, '1020', 'Gaia Kadhi Dahi (Crt) 200 Gm 60 Pkt',            'Kadhi Dahi', 'CRT', 60,  17, 'kadhi_dahi',             0.2),
  (20, '1019', 'Gaia Kadhi Dahi 1 Kg Crt (12 Pcs)',              'Kadhi Dahi', 'CRT', 12,  17, 'kadhi_dahi',             1),
  (21, '1021', 'Gaia Kadhi Dahi 5kg Pouch (2 Pcs)',              'Kadhi Dahi', 'CRT',  2,  17, 'kadhi_dahi',             5),
  (22, '1018', 'Gaia Kadhi Dahi Bucket 1.5 KG',                  'Kadhi Dahi', 'PCS',  1,  17, 'kadhi_dahi',             1.5),
  (23, '1022', 'Gaia Kadhi Dahi Bucket 15 Kg',                   'Kadhi Dahi', 'PCS',  1,  17, 'kadhi_dahi',             15),
  (24, '1023', 'Gaia Plain Lassi 180 Ml (Glass Cup 10)',         'Lassi',      'CBX', 10,  12, 'sweet_lassi',            0.18),
  (25, '1024', 'Mango Lassi 180 Ml - 10Pcs',                     'Lassi',      'CBX', 10,  12, 'sweet_lassi_mango',      0.18),
  (26, '1046', 'Gaia Masala Chaas 180 ML Glass',                 'Lassi',      'CBX', 10,  12, 'masala_chaach',          0.18),
  (27, '1028', 'Gaia Sweet Lassi 180ml Pouch',                   'Lassi',      'CRT', 24,   3, 'sweet_lassi',            0.18),
  (28, '1049', 'Strawberry Lassi 180 Ml - 10 Pcs',               'Lassi',      'CBX', 10,   3, 'sweet_lassi_strawberry', 0.18),
  (29, '1005', 'Gaia Paneer 200gms',                             'Paneer',     'PCS',  1,  18, 'paneer',                 0.2),
  (30, '1006', 'Gaia Paneer 500Gms',                             'Paneer',     'PCS',  1,  18, 'paneer',                 0.5),
  (31, '1007', 'Gaia Paneer 1kg',                                'Paneer',     'PCS',  1,  18, 'paneer',                 1),
  (32, '1008', 'Loose 1 Kg',                                     'Paneer',     'PCS',  1,   5, 'paneer',                 1),
  (33, '1009', 'Loose 5 Kg',                                     'Paneer',     'PCS',  1,   5, 'paneer',                 5),
  (34, '1055', 'Gaia Premium Desi Ghee 20ml',                    'Ghee',       'CBX',100, 240, 'desi_ghee',              0.0182),
  (35, '1029', 'Gaia Ghee 200 ML Jar',                           'Ghee',       'CBX', 24, 240, 'desi_ghee',              0.182),
  (36, '1030', 'Gaia Ghee 500 ML Jar',                           'Ghee',       'CBX', 12, 240, 'desi_ghee',              0.455),
  (37, '1031', 'Gaia Ghee 1 Ltr Jar',                            'Ghee',       'CBX', 12, 240, 'desi_ghee',              0.91),
  (38, '1038', 'Gaia Ghee Ceka Pack 1ltr',                       'Ghee',       'CBX', 12, 240, 'desi_ghee',              0.91),
  (39, '1053', 'Gaia Premium Desi Ghee Ceka Pack 900ml',         'Ghee',       'CBX', 12, 240, 'desi_ghee',              0.819),
  (40, '1032', 'Gaia Ghee 5 Ltr.Jar',                            'Ghee',       'CBX',  4, 240, 'desi_ghee',              4.55),
  (41, '1039', 'Gaia Cow Ghee 200 Ml Jar',                       'Ghee',       'CBX', 24, 240, 'cow_ghee',               0.182),
  (42, '1040', 'Gaia Cow Ghee 500 Ml Jar',                       'Ghee',       'CBX', 12, 240, 'cow_ghee',               0.455),
  (43, '1041', 'Gaia Cow Ghee 1Ltr Jar',                         'Ghee',       'CBX', 12, 240, 'cow_ghee',               0.91),
  (44, '1054', 'Gaia Pure Cow Ghee Ceka Pack 900ml',             'Ghee',       'CBX', 12, 240, 'cow_ghee',               0.819),
  (45, '1037', 'Gaia Cow Ghee Ceka Pack 1ltr',                   'Ghee',       'CBX', 12, 240, 'cow_ghee',               0.91),
  (46, '1033', 'Gaia Ghee 15 Kilogram',                          'Ghee',       'PCS',  1, 240, 'desi_ghee',              15),
  (47, '1048', 'Gaia Shahi Rabdi 80g (1cup*12pcs)',              'Rabdi',      'CBX', 12,  12, 'rabadi',                 0.08),
  (48, '1043', 'Gaia Shrikhand KE 80g',                          'Shrikhand',  'CBX', 12,  30, 'shrikhand',              0.08),
  (49, '1044', 'Gaia Shrikhand KE 80g-Box (6Pc)',                'Shrikhand',  'CBX',  6,   7, 'shrikhand',              0.08),
  (50, '1034', 'Gaia Peda 200 Gm Pcs',                           'Peda',       'CBX', 20,  40, 'peda',                   0.2),
  (51, '1035', 'Gaia Kesar Peda 200 Gm Pcs',                     'Peda',       'CBX', 20,  40, 'kesar_peda',             0.2),
  (52, '1058', 'Khowa White (Unsweetened)',                      'Khowa',      'KG',   1,   5, 'khowa',                  1),
  (53, '1059', 'Khowa Brown (Unsweetened)',                      'Khowa',      'KG',   1,   5, 'khowa',                  1)
)
insert into sku (scenario_id, code, name, category, case_unit, pcs_per_case, shelf_life_days,
                 bulk_product_id, bulk_qty_per_pc, sort_order)
select s.id, seed.code, seed.name, seed.category, seed.case_unit, seed.pcs, seed.shelf,
       bp.id, seed.per_pc, seed.ord
  from scenario s
  cross join seed
  left join bulk_product bp on bp.scenario_id = s.id and bp.code = seed.bulk
on conflict (scenario_id, code) do nothing;
