# Gaia Partners - the trade ordering app

A Flutter app (Android + iOS) for **distributors, retailers and sales officers** to place primary orders at their
dealer prices. The consumer app (`../gaia_shop_app`) keeps the D2C shop and the delivery-partner login.

It has no database of its own: it talks to the dashboard backend - `/api/distributor/*` for sign-in, dealer prices,
orders and profile edits, and `/api/shop/catalog` + `/api/shop/banners` for the menu and banners.

## Run it

```bash
cd gaia_partner_app
flutter pub get
flutter run                                              # talks to https://production.vamadairy.in
flutter run --dart-define=API_BASE=http://192.168.1.20:3001
flutter test
```

## Build

```bash
flutter build apk --release --dart-define=API_BASE=https://production.vamadairy.in
```

App name **Gaia Partners**, id `com.vamaadairy.gaia_partner` (iOS `com.vamaadairy.gaiaPartner`).

## Before publishing

- **Push notifications**: register this app in the Firebase project (`gaia-458cb`) as Android `com.vamaadairy.gaia_partner`
  and iOS `com.vamaadairy.gaiaPartner`, then replace `android/app/google-services.json` and
  `ios/Runner/GoogleService-Info.plist` with the downloaded files. (Until then the Android file carries a copy of the
  Gaia app's entry so the build works, but notifications will not reach this app.)
- Release builds are still signed with the debug key - add a signing config of its own.

## How it works

- Sign-in: mobile number + PIN given by Gaia; the chips on the sign-in screen pick distributor / retailer / sales officer.
- A signed-out phone always opens on the sign-in; a signed-in one opens on the menu at dealer prices.
- A sales officer picks which distributor to order for first; a distributor or retailer is chosen straight away.
- Placing the cart creates a primary order (no delivery fee, quantities in cases, no cap).
