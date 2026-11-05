-- The dump tank and the ghee section's tanks, 5000 L each.
insert into tank (scenario_id, code, name, capacity_litre, sort_order)
select s.id, t.code, t.name, 5000,
       (select coalesce(max(sort_order), 0) from tank where scenario_id = s.id) + t.n
from (select id from scenario order by (status = 'active') desc, created_at desc limit 1) s
cross join (values
  (1, 'dump_tank', 'Dump Tank'),
  (2, 'ghee_melting_tank', 'Ghee Melting Tank'),
  (3, 'prestratification_tank', 'Prestratification Tank'),
  (4, 'ghee_boiler', 'Ghee Boiler'),
  (5, 'setting_tank', 'Setting Tank'),
  (6, 'ghee_baking_tank', 'Ghee Baking Tank')
) as t (n, code, name)
on conflict (scenario_id, code) do nothing;
