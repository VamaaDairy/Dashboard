-- GRN images now live in Cloudinary; the row keeps the link and the id needed to delete it.
-- Rows saved before this keep their bytes in `image`.

alter table grn
  add column image_url text,
  add column public_id text,
  alter column image drop not null,
  alter column image_mime drop not null,
  add constraint grn_has_image check (image is not null or image_url is not null);
