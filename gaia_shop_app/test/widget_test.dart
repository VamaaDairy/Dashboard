import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gaia_shop/api.dart';
import 'package:gaia_shop/main.dart';
import 'package:gaia_shop/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gaia_shop/store/cart.dart';
import 'package:gaia_shop/store/core.dart';
import 'package:gaia_shop/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _catalog = {
  'shop': {'name': 'Gaia', 'deliveryFee': 20, 'freeDeliveryAbove': 200},
  'categories': [
    {'name': 'Milk', 'image': null, 'count': 1},
    {'name': 'Paneer', 'image': null, 'count': 1},
  ],
  'products': [
    {'sku': '1003', 'name': 'Gaia Toned Milk 500 ml', 'category': 'Milk', 'subCategory': 'Milk', 'size': null, 'mrp': 30, 'price': 30, 'description': null, 'image': null},
    {'sku': '1005', 'name': 'Gaia Paneer 200 g', 'category': 'Paneer', 'subCategory': 'Paneer', 'size': '200 g', 'mrp': 110, 'price': 100, 'description': 'Soft, fresh paneer', 'image': null},
  ],
};

/// A phone-shaped screen tall enough to show the whole short menu without scrolling.
void _tallPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 4200);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
}

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
    ProviderContainer box() => ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]);

    test('adds, counts, totals and applies the delivery rule', () {
      final c = box();
      final cart = c.read(cartProvider.notifier)..setRule(const DeliveryRule(fee: 20, freeAbove: 200));
      cart.add(_p('a', 30));
      cart.add(_p('a', 30));
      cart.add(_p('b', 100));
      var s = c.read(cartProvider);
      expect(s.count, 3);
      expect(s.subtotal, 160);
      expect(s.delivery, 20);
      expect(s.total, 180);
      expect(s.toFreeDelivery, 40);
      cart.add(_p('b', 100));
      s = c.read(cartProvider);
      expect(s.delivery, 0); // 260 is over the free-delivery line
      expect(s.toFreeDelivery, 0);
    });

    test('quantity can go down to zero, which removes the line, and is capped', () {
      final c = box();
      final cart = c.read(cartProvider.notifier)..add(_p('a', 10));
      cart.setQty('a', 0);
      expect(c.read(cartProvider).isEmpty, true);
      cart.add(_p('a', 10));
      cart.setQty('a', 999);
      expect(c.read(cartProvider).qtyOf('a'), CartStore.maxPerItem);
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

  group('the whole order flow', () {
    testWidgets('browse, add, check out and see the placed order', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();

      Map<String, dynamic>? sentBody;
      final server = MockClient((req) async {
        final path = req.url.path;
        if (path == '/api/shop/catalog') return http.Response(jsonEncode(_catalog), 200, headers: {'content-type': 'application/json'});
        if (path == '/api/shop/geo/config') return http.Response(jsonEncode({'enabled': false}), 200, headers: {'content-type': 'application/json'});
        if (path == '/api/shop/banners') return http.Response(jsonEncode({'banners': []}), 200, headers: {'content-type': 'application/json'});
        if (path == '/api/shop/orders' && req.method == 'POST') {
          sentBody = jsonDecode(req.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'orderNo': 'GS-000042',
              'accessKey': 'a' * 32,
              'status': 'placed',
              'statusLabel': 'Order placed',
              'paymentMethod': 'cod',
              'paymentStatus': 'pending',
              'createdAt': '2026-10-17T10:00:00.000Z',
              'name': 'Asha Verma',
              'phone': '9876543210',
              'address': 'Flat 4, Test Colony, Raipur',
              'pincode': null,
              'notes': null,
              'subtotal': 130,
              'deliveryFee': 20,
              'total': 150,
              'items': [
                {'sku': '1003', 'name': 'Gaia Toned Milk 500 ml', 'image': null, 'qty': 1, 'unitPrice': 30, 'lineTotal': 30},
                {'sku': '1005', 'name': 'Gaia Paneer 200 g', 'image': null, 'qty': 1, 'unitPrice': 100, 'lineTotal': 100},
              ],
            }),
            201,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      });

      _tallPhone(tester);
      await tester.pumpWidget(GaiaApp(prefs: prefs, vault: TokenVault.memory({TokenVault.customer: 'c' * 64}), api: Api(client: server, base: 'http://test')));
      await tester.pumpAndSettle();

      // the menu is there
      expect(find.text('Gaia Toned Milk 500 ml'), findsOneWidget);
      expect(find.text('Gaia Paneer 200 g'), findsOneWidget);
      expect(find.text('ADD'), findsNWidgets(2));

      // ADD both: the button turns into a stepper and the cart bar appears
      await tester.tap(find.text('ADD').first);
      await tester.pump();
      await tester.tap(find.text('ADD').first);
      await tester.pump();
      expect(find.text('View cart'), findsOneWidget);
      expect(find.text('₹150'), findsWidgets); // 130 + 20 delivery, on the cart bar

      // cart, with the bill and the "add more for free delivery" hint
      await tester.tap(find.text('View cart'));
      await tester.pumpAndSettle();
      expect(find.text('Bill details'), findsOneWidget);
      expect(find.textContaining('more for FREE delivery', findRichText: true), findsOneWidget);

      // checkout: an empty form is refused
      await tester.tap(find.text('Checkout'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Place order'));
      await tester.pumpAndSettle();
      expect(find.text('Please enter your name'), findsOneWidget);
      expect(sentBody, isNull);

      // fill it in and place the order
      await tester.enterText(find.widgetWithText(TextFormField, 'Your name'), 'Asha Verma');
      await tester.enterText(find.widgetWithText(TextFormField, 'Mobile number'), '98765 43210');
      await tester.enterText(find.widgetWithText(TextFormField, 'Full address'), 'Flat 4, Test Colony, Raipur');
      await tester.tap(find.textContaining('Place order'));
      await tester.pumpAndSettle();

      // only sku + qty went to the server - never a price
      expect(sentBody, isNotNull);
      expect(sentBody!['lines'], [
        {'sku': '1003', 'qty': 1},
        {'sku': '1005', 'qty': 1},
      ]);
      expect(sentBody!['name'], 'Asha Verma');

      // confirmation, and the cart is empty again
      expect(find.text('Order placed!'), findsOneWidget);
      expect(find.text('GS-000042'), findsOneWidget);
      expect(ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]).read(cartProvider).isEmpty, true); // what is saved on the phone
    });

    testWidgets('a server error is shown, and the order is kept in the cart', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final server = MockClient((req) async {
        if (req.url.path == '/api/shop/catalog') return http.Response(jsonEncode(_catalog), 200);
        if (req.url.path == '/api/shop/geo/config') return http.Response(jsonEncode({'enabled': false}), 200);
        return http.Response(jsonEncode({'error': 'Some items in your cart are no longer available. Please review your cart.'}), 409);
      });

      _tallPhone(tester);
      await tester.pumpWidget(GaiaApp(prefs: prefs, vault: TokenVault.memory({TokenVault.customer: 'c' * 64}), api: Api(client: server, base: 'http://test')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ADD').first);
      await tester.pump();
      await tester.tap(find.text('View cart'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Checkout'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Your name'), 'Asha Verma');
      await tester.enterText(find.widgetWithText(TextFormField, 'Mobile number'), '9876543210');
      await tester.enterText(find.widgetWithText(TextFormField, 'Full address'), 'Flat 4, Test Colony, Raipur');
      await tester.tap(find.textContaining('Place order'));
      await tester.pumpAndSettle();

      expect(find.textContaining('no longer available'), findsOneWidget);
      expect(ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]).read(cartProvider).count, 1);
    });

    testWidgets('no connection shows a retry instead of a blank screen', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final server = MockClient((req) async => throw http.ClientException('offline'));

      await tester.pumpWidget(GaiaApp(prefs: prefs, vault: TokenVault.memory({TokenVault.customer: 'c' * 64}), api: Api(client: server, base: 'http://test')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Could not reach the server'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });
  });
}
