-- Delivery vehicles as the plant gave them (2026-11-24): each route's vehicle and the company it goes on behalf of.
--   Bhilai - Balaji Transport CG07DB6697            Raigarh - Roshni Transport CG04QP6247
--   Bilaspur - Mahadev Transport CG06GY103          Raipur 1 - Vamaa Dairy CG04PJ3391
--   Raipur 2 - Khallari Transport CG06GZ1470        Raipur 3 MFS - Vamaa Dairy CG04PJ3392
--   Korba - Raj Patle Transport CG10BS8253
-- The plant's own vehicles go in Vamaa Dairy's name; Korba moves from Mahadev to Raj Patle Transport.

update transporter set name = 'Vamaa Dairy'
 where section = 'delivery' and code = 'plant_own_transport' and scenario_id = (select id from scenario order by (status = 'active') desc, created_at desc limit 1);
update transporter set name = 'Khallari Transport'
 where section = 'delivery' and code = 'khollari_transport' and scenario_id = (select id from scenario order by (status = 'active') desc, created_at desc limit 1);

insert into transporter (scenario_id, section, code, name, sort_order)
select s.id, 'delivery', 'raj_patle_transport', 'Raj Patle Transport',
       (select coalesce(max(sort_order), 0) + 1 from transporter where scenario_id = s.id)
  from (select id from scenario order by (status = 'active') desc, created_at desc limit 1) s
 where exists (select 1 from transporter t where t.scenario_id = s.id and t.section = 'delivery')
on conflict (scenario_id, section, code) do nothing;

update route_order_route r set transporter_id = t.id
  from transporter t
 where r.name = 'Korba' and t.scenario_id = (select id from scenario order by (status = 'active') desc, created_at desc limit 1) and t.section = 'delivery' and t.code = 'raj_patle_transport';

insert into transporter_vehicle (transporter_id, vehicle_no, notes)
select t.id, v.no, v.route
  from (values ('balaji_transport', 'CG07DB6697', 'Bhilai'),
               ('roshni_transport', 'CG04QP6247', 'Raigarh'),
               ('mahadev_transport', 'CG06GY103', 'Bilaspur'),
               ('plant_own_transport', 'CG04PJ3391', 'Raipur 1'),
               ('khollari_transport', 'CG06GZ1470', 'Raipur 2'),
               ('plant_own_transport', 'CG04PJ3392', 'Raipur 3 MFS'),
               ('raj_patle_transport', 'CG10BS8253', 'Korba')) v (code, no, route)
  join transporter t on t.code = v.code and t.section = 'delivery' and t.scenario_id = (select id from scenario order by (status = 'active') desc, created_at desc limit 1)
on conflict (transporter_id, vehicle_no) do nothing;
