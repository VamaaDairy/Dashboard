-- Proof of delivery at a truck stop, and full details for distributors who sign up in the Gaia Distributors app.
--
-- fp_booking_order.delivery_code  a 4-digit code made with every order, shown to the buyer in the Gaia Distributors app.
--                                 The transporter enters it at the stop, or takes a photo instead (one of the two).
-- dist_trip_stop.proof            how a delivered stop was proved: 'code' and / or 'photo' (e.g. 'code+photo').
-- dist_firm_request.area/pan/licence_no  the master details a distributor gives when it signs up itself.

alter table fp_booking_order add column if not exists delivery_code text;
update fp_booking_order set delivery_code = lpad((floor(random() * 10000))::int::text, 4, '0') where delivery_code is null;
alter table fp_booking_order alter column delivery_code set default lpad((floor(random() * 10000))::int::text, 4, '0');

alter table dist_trip_stop add column if not exists proof text;

alter table dist_firm_request add column if not exists area text;
alter table dist_firm_request add column if not exists pan text;
alter table dist_firm_request add column if not exists licence_no text;
