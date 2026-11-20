-- A trip's distances, worked out once it has ended (from its GPS and its planned road), so the Trips list and the
-- Dispatch reports don't read every GPS point again: km driven, the planned road's km, km over the plan and km off the
-- planned road. numbers_at: when they were worked out (null: not yet, or the planned road could not be had by road).
alter table dist_trip
  add column if not exists driven_m    int,
  add column if not exists planned_m   int,
  add column if not exists over_plan_m int,
  add column if not exists off_road_m  int,
  add column if not exists numbers_at  timestamptz;
