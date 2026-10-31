-- Customers rate their delivery partner out of 5 stars after an order is delivered (Gaia Dairy app, on the
-- order screen), with an optional note. The rider sees their average in the Delivery Partner app; the
-- Riders page shows it per rider.

alter table shop_order add column rider_rating smallint check (rider_rating between 1 and 5);
alter table shop_order add column rider_rating_note text;
alter table shop_order add column rated_at timestamptz;
