-- Document numbers for orders, vouchers and payments raised from the portal.
create sequence if not exists fp_order_seq;
create sequence if not exists fp_voucher_seq;
select setval('fp_order_seq', greatest(1, coalesce((select max(order_id) from fp_booking_order), 0)) + 100);
select setval('fp_voucher_seq', 1000);
