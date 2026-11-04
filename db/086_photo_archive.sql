-- Product photos can be archived instead of deleted: an archived photo is no longer shown by any app or list,
-- but stays in Product Master (Archive) and can be restored.
alter table fp_product_image add column if not exists archived_at timestamptz;
create index if not exists fp_product_image_live_ix on fp_product_image (product_uid, imagesno) where archived_at is null;
