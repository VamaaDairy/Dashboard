import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

/// A problem the user can read: the server's message, plus per-field messages for the form.
class ApiException implements Exception {
  ApiException(this.message, {this.fields = const {}});
  final String message;
  final Map<String, String> fields;

  @override
  String toString() => message;
}

/// The dashboard backend's /api/shop endpoints.
class Api {
  Api({http.Client? client, String base = apiBase}) : _http = client ?? http.Client(), _base = base;

  final http.Client _http;
  final String _base;

  static const _timeout = Duration(seconds: 20);
  static const _json = {'content-type': 'application/json'};

  Uri _u(String path) => Uri.parse('$_base/api/shop$path');

  Future<Catalog> catalog() async => Catalog.fromJson(await _send(() => _http.get(_u('/catalog'))));

  /// The home-screen carousel, highest priority first.
  Future<List<ShopBanner>> banners() async {
    final j = await _send(() => _http.get(_u('/banners')));
    return ((j['banners'] as List?) ?? []).map((e) => ShopBanner.fromJson(e as Map<String, dynamic>, base: _base)).toList();
  }

  /// Places an order for the signed-in customer ([token] from sign-in; the backend requires it).
  Future<Order> placeOrder({
    required String token,
    required Customer customer,
    String? notes,
    required List<CartLine> lines,
  }) async {
    final body = jsonEncode({
      'name': customer.name,
      'phone': customer.phone,
      'address': customer.address,
      'pincode': customer.pincode.isEmpty ? null : customer.pincode,
      'lat': customer.lat,
      'lng': customer.lng,
      'notes': (notes == null || notes.trim().isEmpty) ? null : notes.trim(),
      // only what was chosen: the server looks the prices up itself
      'lines': [for (final l in lines) {'sku': l.sku, 'qty': l.qty}],
    });
    return Order.fromJson(await _send(() => _http.post(_u('/orders'), headers: {..._json, 'authorization': 'Bearer $token'}, body: body)));
  }

  Future<Order> order(String accessKey) async => Order.fromJson(await _send(() => _http.get(_u('/orders/$accessKey'))));

  Future<List<Order>> orders(List<String> accessKeys) async {
    if (accessKeys.isEmpty) return [];
    final j = await _send(() => _http.post(_u('/orders/lookup'), headers: _json, body: jsonEncode({'keys': accessKeys})));
    return ((j['orders'] as List?) ?? []).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ---- customer sign-in (mobile number + 5-digit PIN) ----

  /// [signUp] creates the account (needs [name]; refused if the number already has one),
  /// otherwise signs in to an existing one. Returns the session token and the saved account.
  Future<({String token, Customer customer})> customerLogin(String phone, String pin, {String name = '', bool signUp = false}) async {
    final j = await _send(() => _http.post(_u('/customer/login'),
        headers: _json, body: jsonEncode({'phone': phone, 'pin': pin, 'name': name, 'mode': signUp ? 'signup' : 'signin'})));
    return (token: j['token'] as String, customer: Customer.fromJson(j['customer'] as Map<String, dynamic>));
  }

  /// The signed-in account, with the address it last ordered to.
  Future<Customer> customerMe(String token) async {
    final j = await _send(() => _http.get(_u('/customer/me'), headers: {'authorization': 'Bearer $token'}));
    return Customer.fromJson(j['customer'] as Map<String, dynamic>);
  }

  Future<List<Order>> customerOrders(String token) async {
    final j = await _send(() => _http.get(_u('/customer/orders'), headers: {'authorization': 'Bearer $token'}));
    return ((j['orders'] as List?) ?? []).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ---- maps (the backend talks to Ola Maps; the key never reaches the phone) ----

  Future<MapConfig> mapConfig() async {
    final j = await _send(() => _http.get(_u('/geo/config')));
    return MapConfig(enabled: j['enabled'] == true, styleUrl: j['styleUrl'] as String?, stylePath: j['stylePath'] as String?);
  }

  /// Full URL of something on the backend, e.g. the map style.
  String absolute(String path) => '$_base$path';

  /// Ola's style made drawable on the phone, for backends that don't serve /geo/style yet:
  /// the key from [styleUrl] is put on every tile, font and icon URL (Ola refuses them without it).
  Future<String?> keyedOlaStyle(String styleUrl) async {
    final key = Uri.parse(styleUrl).queryParameters['api_key'];
    if (key == null || key.isEmpty) return null;
    String withKey(String u) => '$u${u.contains('?') ? '&' : '?'}api_key=$key';
    Future<Map<String, dynamic>?> get(String u) async {
      try {
        final r = await _http.get(Uri.parse(u.contains('api_key=') ? u : withKey(u))).timeout(_timeout);
        if (r.statusCode != 200) return null;
        final d = jsonDecode(utf8.decode(r.bodyBytes));
        return d is Map<String, dynamic> ? d : null;
      } catch (_) {
        return null;
      }
    }

    final style = await get(styleUrl);
    if (style == null) return null;
    final sources = (style['sources'] as Map?)?.cast<String, dynamic>() ?? {};
    await Future.wait(sources.entries.toList().map((e) async {
      final src = (e.value as Map).cast<String, dynamic>();
      final url = src['url'];
      if (url is! String) return;
      final tj = await get(url);
      final tiles = tj?['tiles'];
      if (tj == null || tiles is! List) return;
      sources[e.key] = {
        for (final kv in src.entries) if (kv.key != 'url') kv.key: kv.value,
        'tiles': [for (final t in tiles) withKey('$t')],
        if (tj['minzoom'] != null) 'minzoom': tj['minzoom'],
        if (tj['maxzoom'] != null) 'maxzoom': tj['maxzoom'],
        if (tj['attribution'] != null) 'attribution': tj['attribution'],
      };
    }));
    style['sources'] = sources;
    if (style['sprite'] is String) style['sprite'] = withKey(style['sprite'] as String);
    if (style['glyphs'] is String) style['glyphs'] = withKey(style['glyphs'] as String);
    return jsonEncode(style);
  }

  Future<List<PlaceSuggestion>> searchPlaces(String q, {GeoPoint? near}) async {
    final qs = {'q': q, if (near != null) 'lat': '${near.lat}', if (near != null) 'lng': '${near.lng}'};
    final j = await _send(() => _http.get(_u('/geo/autocomplete').replace(queryParameters: qs)));
    return ((j['suggestions'] as List?) ?? []).map((e) => PlaceSuggestion.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PickedLocation?> reverse(double lat, double lng) async {
    final j = await _send(() => _http.get(_u('/geo/reverse').replace(queryParameters: {'lat': '$lat', 'lng': '$lng'})));
    final a = j['address'] as String?;
    return a == null ? null : PickedLocation(lat: lat, lng: lng, address: a, pincode: j['pincode'] as String?);
  }

  Future<RoutePath> route(GeoPoint from, GeoPoint to) async {
    final j = await _send(() => _http.get(_u('/geo/route').replace(queryParameters: {'from': '${from.lat},${from.lng}', 'to': '${to.lat},${to.lng}'})));
    return RoutePath.fromJson(j);
  }

  // ---- delivery riders ----

  Uri _r(String path) => Uri.parse('$_base/api/rider$path');
  Map<String, String> _auth(String token) => {..._json, 'authorization': 'Bearer $token'};

  Future<({String token, RiderProfile rider})> riderLogin(String phone, String pin) async {
    final j = await _send(() => _http.post(_r('/login'), headers: _json, body: jsonEncode({'phone': phone, 'pin': pin})));
    final r = j['rider'] as Map<String, dynamic>;
    return (token: j['token'] as String, rider: RiderProfile(name: r['name'] as String, phone: r['phone'] as String));
  }

  /// Finished deliveries, grouped by day (newest first, last 60 days).
  Future<List<DeliveryDay>> riderHistory(String token) async {
    final j = await _send(() => _http.get(_r('/history'), headers: _auth(token)));
    return ((j['days'] as List?) ?? []).map((e) => DeliveryDay.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Order>> riderOrders(String token) async {
    final j = await _send(() => _http.get(_r('/orders'), headers: _auth(token)));
    return ((j['orders'] as List?) ?? []).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> riderPickup(String token, int id) async {
    await _send(() => _http.post(_r('/orders/$id/pickup'), headers: _auth(token)));
  }

  Future<void> riderDeliver(String token, int id, String otp) async {
    await _send(() => _http.post(_r('/orders/$id/deliver'), headers: _auth(token), body: jsonEncode({'otp': otp})));
  }

  Future<void> riderLocation(String token, double lat, double lng) async {
    await _send(() => _http.post(_r('/location'), headers: _auth(token), body: jsonEncode({'lat': lat, 'lng': lng})));
  }

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    final http.Response r;
    try {
      r = await call().timeout(_timeout);
    } on TimeoutException {
      throw ApiException('The server is taking too long. Please try again.');
    } catch (_) {
      throw ApiException('Could not reach the server. Check your internet connection.');
    }

    Map<String, dynamic> body = {};
    try {
      final decoded = jsonDecode(utf8.decode(r.bodyBytes));
      if (decoded is Map<String, dynamic>) body = decoded;
    } catch (_) {
      // not JSON - handled below
    }

    if (r.statusCode >= 200 && r.statusCode < 300) return body;

    final fields = <String, String>{};
    final raw = body['fields'];
    if (raw is Map) raw.forEach((k, v) => fields['$k'] = '$v');
    final msg = body['error'] is String
        ? body['error'] as String
        : r.statusCode == 429
            ? 'Too many requests. Please wait a minute.'
            : 'Something went wrong (${r.statusCode}). Please try again.';
    throw ApiException(msg, fields: fields);
  }
}
