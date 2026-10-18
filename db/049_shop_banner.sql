-- The banner carousel at the top of the Gaia app's home screen.
-- A banner is either an uploaded poster (image) or a designed card (title, subtitle, colour)
-- that can point at a product. Highest priority shows first; only active banners inside
-- their start/end window are shown.

create table shop_banner (
  id          serial primary key,
  title       text not null default '',
  subtitle    text,
  cta         text,                                   -- button text, e.g. "Order now"
  sku_code    text,                                   -- tapping opens this product (its photo shows on a designed card)
  bg_color    text not null default '#7EAEF5' check (bg_color ~ '^#[0-9A-Fa-f]{6}$'),
  image       bytea,                                  -- uploaded poster; when set it fills the whole banner
  image_mime  text,
  priority    int not null default 0,
  active      boolean not null default true,
  starts_at   date,
  ends_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (image is null or image_mime is not null)
);
create index shop_banner_show_ix on shop_banner (active, priority desc);

-- something to show on day one: the brand promise and the products worth pushing
insert into shop_banner (title, subtitle, cta, sku_code, bg_color, priority) values
  ('Farm-fresh goodness at your doorstep', 'Antibiotic free. Untouched by hand.', null, null, '#7EAEF5', 100),
  ('Quality products curated for your healthy routine', 'Gaia Toned Milk, packed fresh every morning', 'Order milk', '1003', '#4A86E0', 90),
  ('Pure Desi Ghee, slow-cooked the traditional way', null, 'Shop ghee', '1031', '#7EAEF5', 80),
  ('Soft, fresh paneer, rich in protein', null, 'Add paneer', '1005', '#4A86E0', 70),
  ('Pin your exact doorstep for perfectly timed delivery', 'Drop a pin on the map at checkout', null, null, '#7EAEF5', 60);
