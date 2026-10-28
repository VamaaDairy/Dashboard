import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;
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

/// The dashboard backend: the shop catalogue (/api/shop) and the partner endpoints (/api/distributor).
class Api {
  Api({http.Client? client, String base = apiBase}) : _http = client ?? http.Client(), _base = base;

  final http.Client _http;
  final String _base;

  static const _timeout = Duration(seconds: 20);
  static const _json = {'content-type': 'application/json'};

  Uri _u(String path) => Uri.parse('$_base/api/shop$path');

  Future<Catalog> catalog() async => Catalog.fromJson(await _send(() => _http.get(_u('/catalog'))));

  /// GET a shop endpoint, skipping the download when what the phone has is still current:
  /// with [etag] the server answers 304 (no body) if nothing changed.
  Future<({String? raw, String? etag, bool unchanged})> fetchFresh(String path, {String? etag}) async {
    final http.Response r;
    try {
      r = await _http.get(_u(path), headers: {if (etag != null) 'if-none-match': etag}).timeout(_timeout);
    } on TimeoutException {
      throw ApiException('The server is taking too long. Please try again.');
    } catch (_) {
      throw ApiException('Could not reach the server. Check your internet connection.');
    }
    if (r.statusCode == 304) return (raw: null, etag: etag, unchanged: true);
    if (r.statusCode < 200 || r.statusCode >= 300) throw ApiException('Something went wrong (${r.statusCode}). Please try again.');
    return (raw: utf8.decode(r.bodyBytes), etag: r.headers['etag'], unchanged: false);
  }

  List<ShopBanner> parseBanners(Map<String, dynamic> j) =>
      ((j['banners'] as List?) ?? []).map((e) => ShopBanner.fromJson(e as Map<String, dynamic>, base: _base)).toList();

  /// The home-screen carousel, highest priority first.
  Future<List<ShopBanner>> banners() async {
    final j = await _send(() => _http.get(_u('/banners')));
    return ((j['banners'] as List?) ?? []).map((e) => ShopBanner.fromJson(e as Map<String, dynamic>, base: _base)).toList();
  }

  /// Tells the backend which phone to push to for this signed-in session ([token] is the sign-in token). Best effort.
  Future<void> registerPushToken(String token, String pushToken) async {
    try {
      await _http
          .post(_u('/push/register'), headers: _bearer(token), body: jsonEncode({'token': pushToken, 'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android'}))
          .timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  Map<String, String> _bearer(String token) => {..._json, 'authorization': 'Bearer $token'};

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

  // ---- distributors / salesmen (primary orders) ----

  Uri _d(String path, [Map<String, String>? q]) => Uri.parse('$_base/api/distributor$path').replace(queryParameters: q);

  Future<({String token, DistProfile profile})> distLogin(String phone, String pin, String kind) async {
    final j = await _send(() => _http.post(_d('/login'), headers: _json, body: jsonEncode({'phone': phone, 'pin': pin, 'kind': kind})));
    final l = j['login'] as Map<String, dynamic>;
    return (token: j['token'] as String, profile: DistProfile(kind: l['kind'] as String, name: l['name'] as String, phone: l['phone'] as String));
  }

  /// The distributors this login can order for, and the states a profile can be set to.
  Future<({List<DistFirm> firms, List<String> states})> distFirms(String token) async {
    final j = await _send(() => _http.get(_d('/me'), headers: _bearer(token)));
    return (
      firms: ((j['distributors'] as List?) ?? []).map((e) => DistFirm.fromJson(e as Map<String, dynamic>)).toList(),
      states: ((j['states'] as List?) ?? []).map((e) => '$e').toList(),
    );
  }

  /// Saves changed details of a distributor into the dashboard's Customer Masters; returns the saved profile
  /// and the (possibly new) sign-in number. Only the keys in [changes] are touched.
  Future<({DistFirm firm, String name, String phone})> distSaveFirm(String token, String firmUid, Map<String, Object?> changes) async {
    final j = await _send(() => _http.patch(_d('/me'), headers: {..._json, ..._bearer(token)}, body: jsonEncode({'firmUid': firmUid, ...changes})));
    final l = j['login'] as Map<String, dynamic>;
    return (firm: DistFirm.fromJson(j['firm'] as Map<String, dynamic>), name: l['name'] as String, phone: l['phone'] as String);
  }

  /// The shop catalogue at [firmUid]'s dealer price.
  /// With the [etag] of the list the phone already has, an unchanged list comes back as `raw == null`.
  Future<({String? raw, String? etag})> distProducts(String token, String firmUid, {String? etag}) async {
    http.Response? res;
    final j = await _send(() async => res = await _http.get(_d('/products', {'firm': firmUid}), headers: {..._bearer(token), if (etag != null) 'if-none-match': etag}));
    if (res!.statusCode == 304) return (raw: null, etag: etag);
    return (raw: jsonEncode(j), etag: res!.headers['etag']);
  }

  static List<Product> parseProducts(String raw) =>
      ((jsonDecode(raw) as Map<String, dynamic>)['products'] as List? ?? []).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();

  Future<List<DistOrder>> distOrders(String token) async {
    final j = await _send(() => _http.get(_d('/orders'), headers: _bearer(token)));
    return ((j['orders'] as List?) ?? []).map((e) => DistOrder.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Places the order; returns the order number.
  Future<int> distPlaceOrder(String token, {required String firmUid, required Map<String, int> qty, String? notes}) async {
    final j = await _send(() => _http.post(
          _d('/orders'),
          headers: _bearer(token),
          body: jsonEncode({
            'firmUid': firmUid,
            if (notes != null && notes.isNotEmpty) 'notes': notes,
            'lines': [for (final e in qty.entries) {'sku': e.key, 'qty': e.value}],
          }),
        ));
    return (j['orderId'] as num).toInt();
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
    if (r.statusCode == 304) return body; // only asked for with If-None-Match: the caller keeps what it has

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
