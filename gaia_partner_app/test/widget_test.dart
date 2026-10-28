import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gaia_partner/api.dart';
import 'package:gaia_partner/main.dart';
import 'package:gaia_partner/models.dart';
import 'package:gaia_partner/store/cart.dart';
import 'package:gaia_partner/store/core.dart';
import 'package:gaia_partner/store/distributor.dart';
import 'package:gaia_partner/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

Product _p(String sku, double price) => Product(sku: sku, name: sku, category: 'c', subCategory: 's', mrp: price, price: price);

void main() {
  group('rupees', () {
    test('uses Indian digit grouping and drops empty paise', () {
      expect(rupees(30), '₹30');
      expect(rupees(1234567), '₹12,34,567');
      expect(rupees(99.5), '₹99.50');
    });
  });

  group('CartStore', () {
    late SharedPreferences prefs;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });
    ProviderContainer box() => ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs), vaultProvider.overrideWithValue(TokenVault.memory())]);

    test('adds, counts and totals', () {
      final c = box();
      final cart = c.read(cartProvider.notifier);
      cart.add(_p('a', 30));
      cart.add(_p('a', 30));
      cart.add(_p('b', 100));
      final s = c.read(cartProvider);
      expect(s.count, 3);
      expect(s.subtotal, 160);
    });

    test('quantity can go down to zero, which removes the line, and is capped', () {
      final c = box();
      final cart = c.read(cartProvider.notifier)..add(_p('a', 10));
      cart.setQty('a', 0);
      expect(c.read(cartProvider).isEmpty, true);
      cart.add(_p('a', 10));
      cart.setQty('a', 999999);
      expect(c.read(cartProvider).qtyOf('a'), 100000); // partners order in cases
    });

    test('survives closing the app', () {
      box().read(cartProvider.notifier).add(_p('a', 10));
      expect(box().read(cartProvider).qtyOf('a'), 1);
    });

    test('syncWith drops items no longer sold and refreshes prices', () {
      final c = box();
      c.read(cartProvider.notifier)
        ..add(_p('a', 10))
        ..add(_p('gone', 5))
        ..syncWith([_p('a', 12)]);
      expect(c.read(cartProvider).qtyOf('gone'), 0);
      expect(c.read(cartProvider).subtotal, 12);
    });
  });

  group('distributor menu', () {
    test('stays the same menu until a dealer price changes', () async {
      SharedPreferences.setMockInitialValues({'gaia_dist_kind_v1': 'distributor', 'gaia_dist_name_v1': 'Bhog', 'gaia_dist_phone_v1': '9827012345'});
      final prefs = await SharedPreferences.getInstance();
      var milk = 26;
      final c = ProviderContainer(overrides: [
        prefsProvider.overrideWithValue(prefs),
        vaultProvider.overrideWithValue(TokenVault.memory({TokenVault.distributor: 'd' * 64})),
        apiProvider.overrideWithValue(Api(
            client: MockClient((r) async {
              if (r.url.path.endsWith('/me')) return http.Response(jsonEncode({'distributors': [{'uid': 'f1', 'name': 'Bhog', 'code': 'DB1'}]}), 200);
              if (r.url.path.endsWith('/orders')) return http.Response(jsonEncode({'orders': []}), 200);
              return http.Response(jsonEncode({'products': [
                {'sku': '1003', 'name': 'Milk', 'category': 'Milk', 'subCategory': 'Milk', 'mrp': 30, 'price': milk},
              ]}), 200);
            }),
            base: 'http://test')),
      ]);
      addTearDown(c.dispose);
      c.listen(menuProvider, (_, __) {});
      final store = c.read(distributorProvider.notifier);
      await store.start(); // one distributor: chosen and priced straight away
      final first = c.read(menuProvider).catalog;
      expect(first!.products.single.price, 26);

      await store.loadOrders(); // unrelated changes leave the menu alone
      await store.refreshPrices(minGap: Duration.zero); // same prices
      expect(identical(c.read(menuProvider).catalog, first), true);

      milk = 27; // the dealer price changes
      await store.refreshPrices(minGap: Duration.zero);
      expect(identical(c.read(menuProvider).catalog, first), false);
      expect(c.read(menuProvider).catalog!.products.single.price, 27);
    });
  });

  group('sign in', () {
    testWidgets('a signed-out phone opens on the sign-in, with all three kinds of login', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(GaiaApp(prefs: prefs, vault: TokenVault.memory(), api: Api(client: MockClient((r) async => http.Response('{}', 200)), base: 'http://test')));
      await tester.pumpAndSettle();
      expect(find.text('Distributor'), findsWidgets);
      expect(find.text('Retailer'), findsOneWidget);
      expect(find.text('Sales officer'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
      // nothing from the shopper or delivery apps is here
      expect(find.text('Delivery partner'), findsNothing);
      expect(find.text('Calendar'), findsNothing);
    });

    testWidgets('a wrong PIN shows the message from the server', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final api = Api(client: MockClient((r) async => http.Response(jsonEncode({'error': 'Wrong mobile number or PIN.'}), 401)), base: 'http://test');
      await tester.pumpWidget(GaiaApp(prefs: prefs, vault: TokenVault.memory(), api: api));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Mobile number'), '9827012345');
      await tester.enterText(find.widgetWithText(TextField, 'PIN'), '1234');
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('Wrong mobile number or PIN.'), findsOneWidget);
    });
  });
}
