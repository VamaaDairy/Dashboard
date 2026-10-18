// ignore_for_file: avoid_print
// Runs the app's own API client against a real backend:
//   dart run tool/live_check.dart http://localhost:3001
// Reads the menu, places one clearly-marked test order, looks it up again two ways.
// The test order is left in the database - delete it (name "ZZ LiveCheck") afterwards.
import 'package:gaia_shop/api.dart';
import 'package:gaia_shop/models.dart';

Future<void> main(List<String> args) async {
  final api = Api(base: args.isNotEmpty ? args.first : 'http://localhost:3001');

  final cat = await api.catalog();
  print('menu: ${cat.products.length} products in ${cat.categories.length} categories; '
      'delivery fee ${cat.rule.fee}, free above ${cat.rule.freeAbove}');
  print('  with a photo: ${cat.products.where((p) => p.image != null).length}');
  final first = cat.products.first;
  print('  first: ${first.name} (${first.sku}) ${first.price}');

  final order = await api.placeOrder(
    customer: const Customer(name: 'ZZ LiveCheck', phone: '9876543210', address: 'Test address, Raipur, Chhattisgarh', pincode: '492001'),
    notes: 'live check',
    lines: [CartLine(sku: cat.products[0].sku, name: '', price: 0, qty: 2), CartLine(sku: cat.products[1].sku, name: '', price: 0, qty: 1)],
  );
  print('placed ${order.orderNo}: ${order.itemCount} items, total ${order.total}, status "${order.statusLabel}"');
  print('  server priced it: ${order.items.map((i) => '${i.name} ${i.qty}x${i.unitPrice}').join(', ')}');

  final again = await api.order(order.accessKey);
  print('looked up by key: ${again.orderNo} ${again.status}');
  final many = await api.orders([order.accessKey, 'f' * 32]);
  print('lookup of 2 keys (1 unknown): ${many.length} order(s)');

  try {
    await api.placeOrder(customer: const Customer(name: 'x', phone: '1', address: 'y'), lines: []);
  } on ApiException catch (e) {
    print('bad order refused as expected: "${e.message}" fields=${e.fields.keys.toList()}');
  }
}
