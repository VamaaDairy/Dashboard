-- =====================================================================
-- Per-user access control
--
-- is_active : a deactivated user can't sign in, and a session they already
--             hold stops working on the next request.
-- access    : what a non-owner may open, as {"<resource key>": "view"|"edit"}.
--             A resource that is missing means no access. Owners ignore this
--             column and can do everything (the keys live in src/lib/access.ts).
-- =====================================================================

alter table app_user
  add column if not exists is_active boolean not null default true,
  add column if not exists access    jsonb   not null default '{}'::jsonb;

-- The account that manages everyone else must be an owner.
update app_user set role = 'owner' where lower(email) = 'darshan@vamaadairy.com';
