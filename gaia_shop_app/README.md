# Gaia - the ordering app

A Flutter app (Android + iOS) where customers browse Gaia products with photos, fill a cart and place an order.
It has no database of its own: it talks to the **dashboard backend** (`/api/shop/*` in the parent project), which
reads products from the same database as the dashboard and writes orders into it.

```
Flutter app  ──HTTPS──▶  dashboard backend (Next.js)  ──▶  Postgres (same DB as the dashboard)
                         /api/shop/catalog                   fp_product, fp_product_image, shop_item
                         /api/shop/orders                    shop_order, shop_order_item
                         /api/shop/orders/lookup
                         /api/shop/orders/{key}
```

Orders show up in the dashboard under **Shop orders** (`/shop-orders`), where staff move them
Placed → Confirmed → Out for delivery → Delivered (or Cancelled). The app shows the new status when the customer pulls down on the order.

## Run it

You need the Flutter SDK (https://docs.flutter.dev/get-started/install) and, for a phone build, Android Studio or Xcode.

```bash
cd gaia_shop_app
flutter pub get
flutter run                                   # talks to https://production.vamadairy.in
flutter run --dart-define=API_BASE=http://192.168.1.20:3001   # a dashboard on your own network
```

An Android emulator reaches your computer at `http://10.0.2.2:3001`. Plain `http://` addresses work on Android
debug builds; a release build should use `https`.

## Build for the stores

```bash
flutter build apk --release --dart-define=API_BASE=https://production.vamadairy.in      # Android APK
flutter build appbundle --release --dart-define=API_BASE=https://production.vamadairy.in # Play Store
flutter build ipa --release --dart-define=API_BASE=https://production.vamadairy.in      # needs a Mac
```

App name is **Gaia**, id `com.vamaadairy.gaia_shop`. The icon is still Flutter's default - replace it
(e.g. with the `flutter_launcher_icons` package) before publishing.

## Where things are

| | |
|---|---|
| `lib/config.dart` | backend address (`API_BASE`), app name |
| `lib/theme.dart` | **all colours** - change `Brand.accent` to re-colour the app; `rupees()` formatting |
| `lib/api.dart` | the only file that talks to the backend |
| `lib/models.dart` | Product, Order, CartLine ... as the backend sends them |
| `lib/state/` | catalog, cart (saved on the phone), orders (the phone keeps each order's secret key) |
| `lib/screens/` | menu, product, cart, checkout, order status, my orders |
| `lib/widgets.dart` | ADD / stepper button, cart bar, bill box, veg dot, product image |
| `test/` | cart maths and the whole order flow against a fake backend (`flutter test`) |
| `tool/live_check.dart` | `dart run tool/live_check.dart http://localhost:3001` - runs the app's client against a real backend |

## How it works (and what it does not do yet)

- **Prices are never trusted from the phone.** The app sends only `sku` and `qty`; the backend looks the prices up.
- **No login.** The customer types name, phone and address at checkout (remembered for next time). Each order has a
  secret key kept on the phone, so "My orders" shows only that phone's orders.
- **Payment: cash on delivery only.** Online payment (the dashboard already has Razorpay for WhatsApp orders) is the obvious next step.
- **What is on sale** is decided in the dashboard database: active products with a price, minus anything hidden in
  `shop_item` (bulk packs over ₹2,000 are hidden to start with) - and `shop_item.price` can override the MRP.
- Not built yet: login / OTP, push notifications for status changes, coupons, delivery slots, ratings.
