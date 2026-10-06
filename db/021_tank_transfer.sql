-- =====================================================================
-- Moving milk from one tank to another
--
-- Raw milk comes into RMST1/2 and is moved on to the PMST / HMST /
-- coagulation tanks before production draws it. A transfer is a pair of
-- ordinary movements, both tagged source = 'transfer':
--   - an 'out' on the tank it leaves (at that tank's blend, like any draw)
--   - an 'in' on the tank it goes to, with transfer_of pointing at that 'out'
-- The 'in' carries exactly the fat, SNF and ₹/L the 'out' left at, and is
-- weighted-averaged into the receiving tank like any other addition. When
-- the source tank is recomputed (say a backdated collection changed its
-- blend), the engine copies the new blend onto the 'in' and recomputes the
-- receiving tank too. Deleting the 'out' deletes the 'in' with it.
-- =====================================================================

alter table tank_movement
  add column transfer_of uuid references tank_movement(id) on delete cascade;

create unique index tank_movement_transfer_of_key on tank_movement (transfer_of) where transfer_of is not null;
