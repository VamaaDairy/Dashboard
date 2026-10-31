-- The Delivery Partner app signs in two kinds of partner: delivery boys (D2C home deliveries) and
-- transporters (who will carry distributors' orders route by route). Both live here; a transporter
-- also has the vehicle number. Delivery boys are the only ones offered D2C orders.

alter table shop_rider add column kind text not null default 'delivery' check (kind in ('delivery', 'transporter'));
alter table shop_rider add column vehicle_no text;
