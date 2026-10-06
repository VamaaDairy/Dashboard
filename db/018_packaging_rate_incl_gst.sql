-- =====================================================================
-- Packaging is priced with GST already in
--
-- Packing items are bought and entered at their GST-inclusive price, so the
-- packaging master keeps one rate per unit (incl. GST) instead of a base rate,
-- a GST % and a computed total. The GST and total columns are switched off
-- for packaging (nothing in the cost model reads them), and the rate is
-- labelled as including GST.
-- =====================================================================

update field_def f set is_active = false
  from object_class c
 where c.id = f.class_id and c.code = 'packaging' and f.key in ('gst_pct', 'rate_with_gst');

update field_def f set label = 'Rate per unit (incl. GST)'
  from object_class c
 where c.id = f.class_id and c.code = 'packaging' and f.key = 'rate';
