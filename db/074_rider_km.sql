-- How far each delivery partner rides each day (India time), added up from the location their phone
-- sends while on duty. Shown in the Delivery Partner app and on the Riders page.

create table shop_rider_km (
  rider_id int not null references shop_rider (id) on delete cascade,
  day      date not null,
  metres   int not null default 0,
  primary key (rider_id, day)
);
