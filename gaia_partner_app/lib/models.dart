import 'dart:ui' show Color;

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

class Product {
  Product({
    required this.sku,
    required this.name,
    required this.category,
    required this.subCategory,
    required this.mrp,
    required this.price,
    this.size,
    this.description,
    this.image,
    this.images = const [],
  });

  final String sku;
  final String name;
  final String category;
  final String subCategory;
  final String? size;
  final String? description;
  final String? image;

  /// Every photo of the product; falls back to just [image] on an older backend.
  final List<String> images;
  final double mrp;
  final double price;

  List<String> get gallery => images.isNotEmpty ? images : [if (image != null && image!.isNotEmpty) image!];
  int get offPercent => mrp > price ? ((mrp - price) / mrp * 100).round() : 0;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        sku: j['sku'] as String,
        name: j['name'] as String,
        category: (j['category'] as String?) ?? '',
        subCategory: (j['subCategory'] as String?) ?? '',
        size: j['size'] as String?,
        description: j['description'] as String?,
        image: j['image'] as String?,
        images: [for (final i in (j['images'] as List?) ?? const []) if (i is String && i.isNotEmpty) i],
        mrp: _num(j['mrp']),
        price: _num(j['price']),
      );
}

class MenuCategory {
  MenuCategory({required this.name, required this.count, this.image});
  final String name;
  final int count;
  final String? image;

  factory MenuCategory.fromJson(Map<String, dynamic> j) => MenuCategory(
        name: j['name'] as String,
        count: (j['count'] as num).toInt(),
        image: j['image'] as String?,
      );
}

class DeliveryRule {
  const DeliveryRule({this.fee = 0, this.freeAbove = 0});
  final double fee;

  /// Free delivery from this subtotal up; 0 = never free.
  final double freeAbove;

  double forSubtotal(double subtotal) {
    if (subtotal <= 0) return 0;
    if (freeAbove > 0 && subtotal >= freeAbove) return 0;
    return fee;
  }
}

class Catalog {
  Catalog({required this.rule, required this.categories, required this.products});
  final DeliveryRule rule;
  final List<MenuCategory> categories;
  final List<Product> products;

  factory Catalog.fromJson(Map<String, dynamic> j) {
    final shop = (j['shop'] as Map<String, dynamic>?) ?? {};
    return Catalog(
      rule: DeliveryRule(fee: _num(shop['deliveryFee']), freeAbove: _num(shop['freeDeliveryAbove'])),
      categories: ((j['categories'] as List?) ?? []).map((e) => MenuCategory.fromJson(e as Map<String, dynamic>)).toList(),
      products: ((j['products'] as List?) ?? []).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class CartLine {
  CartLine({required this.sku, required this.name, required this.price, required this.qty, this.image, this.size});
  final String sku;
  final String name;
  final double price;
  final String? image;
  final String? size;
  final int qty;

  double get total => price * qty;

  CartLine withQty(int q) => CartLine(sku: sku, name: name, price: price, image: image, size: size, qty: q);

  Map<String, dynamic> toJson() => {'sku': sku, 'name': name, 'price': price, 'image': image, 'size': size, 'qty': qty};

  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        sku: j['sku'] as String,
        name: j['name'] as String,
        price: _num(j['price']),
        image: j['image'] as String?,
        size: j['size'] as String?,
        qty: (j['qty'] as num).toInt(),
      );
}

class GeoPoint {
  const GeoPoint(this.lat, this.lng);
  final double lat;
  final double lng;
}

/// A place the customer picked (search result, map pin or current location).
class PickedLocation {
  const PickedLocation({required this.lat, required this.lng, required this.address, this.pincode});
  final double lat;
  final double lng;
  final String address;
  final String? pincode;
}

class PlaceSuggestion {
  const PlaceSuggestion({required this.title, required this.address, required this.lat, required this.lng});
  final String title;
  final String address;
  final double lat;
  final double lng;

  factory PlaceSuggestion.fromJson(Map<String, dynamic> j) => PlaceSuggestion(
        title: (j['title'] as String?) ?? '',
        address: (j['address'] as String?) ?? '',
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
      );
}

/// Driving route between two points: the line to draw plus distance and time.
class RouteStep {
  const RouteStep(this.text, this.distanceM, this.maneuver);
  final String text;
  final double distanceM;
  final String maneuver;

  String get distance => distanceM < 1000 ? '${distanceM.round()} m' : '${(distanceM / 1000).toStringAsFixed(1)} km';
}

class RoutePath {
  const RoutePath({required this.points, this.distanceM, this.durationS, this.steps = const []});
  final List<RouteStep> steps;
  final List<GeoPoint> points;
  final double? distanceM;
  final double? durationS;

  String get eta {
    final s = durationS;
    if (s == null || s <= 0) return '';
    final m = (s / 60).ceil();
    return m < 60 ? '$m min' : '${m ~/ 60} h ${m % 60} min';
  }

  String get distance {
    final d = distanceM;
    if (d == null || d <= 0) return '';
    return d < 1000 ? '${d.round()} m' : '${(d / 1000).toStringAsFixed(1)} km';
  }

  factory RoutePath.fromJson(Map<String, dynamic> j) => RoutePath(
        points: ((j['points'] as List?) ?? []).map((p) => GeoPoint((p[0] as num).toDouble(), (p[1] as num).toDouble())).toList(),
        distanceM: (j['distanceM'] as num?)?.toDouble(),
        durationS: (j['durationS'] as num?)?.toDouble(),
        steps: ((j['steps'] as List?) ?? [])
            .map((t) => RouteStep(t['text'] as String, (t['distanceM'] as num).toDouble(), (t['maneuver'] as String?) ?? ''))
            .toList(),
      );
}

class MapConfig {
  const MapConfig({required this.enabled, this.styleUrl, this.stylePath});
  final bool enabled;

  /// Ola's own style URL (its tiles come back 401 unless the key is added to each request).
  final String? styleUrl;

  /// The ready-to-draw style on our backend, with the key on every tile URL. Newer backends only.
  final String? stylePath;
}

/// A distributor (or a salesman booking for distributors) signed in to the app.
class DistProfile {
  const DistProfile({required this.kind, required this.name, required this.phone});
  final String kind; // 'distributor' | 'salesman' | 'retailer'
  final String name;
  final String phone;
  bool get isSalesman => kind == 'salesman';
  bool get isRetailer => kind == 'retailer';

  /// What the sign-in is called on screen.
  String get label => isSalesman ? 'Sales officer' : isRetailer ? 'Retailer' : 'Distributor';
}

/// A distributor an order can be placed for.
class DistFirm {
  const DistFirm({
    required this.uid,
    required this.name,
    required this.code,
    this.city,
    this.channel,
    this.type,
    this.firmClass,
    this.active = true,
    this.servedBy,
    this.route,
    this.erpCode,
    this.createdAt,
    this.contactPerson,
    this.phone,
    this.landline,
    this.email,
    this.address,
    this.area,
    this.district,
    this.state,
    this.pincode,
    this.lat,
    this.lng,
    this.gstin,
    this.pan,
    this.licenceNo,
    this.creditLimit,
    this.salesOfficer,
    this.salesOfficerPhone,
  });
  final String uid;
  final String name;
  final String code;
  final String? city;
  final String? channel;
  final String? type;
  final String? firmClass;
  final bool active;
  final String? servedBy;
  final String? route;
  final String? erpCode;
  final DateTime? createdAt;
  final String? contactPerson;
  final String? phone;
  final String? landline;
  final String? email;
  final String? address;
  final String? area;
  final String? district;
  final String? state;
  final String? pincode;
  final double? lat;
  final double? lng;
  final String? gstin;
  final String? pan;
  final String? licenceNo;
  final double? creditLimit;
  final String? salesOfficer;
  final String? salesOfficerPhone;

  bool get hasLocation => lat != null && lng != null && !(lat == 0 && lng == 0);

  /// Address, area, city, district and state on one line (no repeats), then the pincode.
  String get fullAddress {
    final parts = <String>[];
    for (final p in [address, area, city, district, state]) {
      final t = p?.trim() ?? '';
      if (t.isNotEmpty && !parts.any((x) => x.toLowerCase() == t.toLowerCase())) parts.add(t);
    }
    final pin = pincode?.trim() ?? '';
    return [parts.join(', '), if (pin.isNotEmpty) pin].where((x) => x.isNotEmpty).join(' - ');
  }

  factory DistFirm.fromJson(Map<String, dynamic> j) {
    String? s(String k) {
      final v = j[k]?.toString().trim();
      return v == null || v.isEmpty ? null : v;
    }

    double? n(String k) => j[k] is num ? (j[k] as num).toDouble() : double.tryParse(j[k]?.toString() ?? '');

    return DistFirm(
      uid: j['uid'] as String,
      name: j['name'] as String,
      code: (j['code'] as String?) ?? '',
      city: s('city'),
      channel: s('channel'),
      type: s('type'),
      firmClass: s('class'),
      active: j['active'] != false,
      servedBy: s('servedBy'),
      route: s('route'),
      erpCode: s('erpCode'),
      createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? '')?.toLocal(),
      contactPerson: s('contactPerson'),
      phone: s('phone'),
      landline: s('landline'),
      email: s('email'),
      address: s('address'),
      area: s('area'),
      district: s('district'),
      state: s('state'),
      pincode: s('pincode'),
      lat: n('lat'),
      lng: n('lng'),
      gstin: s('gstin'),
      pan: s('pan'),
      licenceNo: s('licenceNo'),
      creditLimit: n('creditLimit'),
      salesOfficer: s('salesOfficer'),
      salesOfficerPhone: s('salesOfficerPhone'),
    );
  }
}

class DistOrderLine {
  const DistOrderLine({required this.name, required this.qty, required this.rate, required this.amount, this.sku = ''});
  final String sku;
  final String name;
  final double qty;
  final double rate;
  final double amount;
}

/// A primary order the signed-in distributor / salesman placed.
class DistOrder {
  const DistOrder({required this.orderId, required this.date, required this.distributor, required this.status, required this.qty, required this.total, required this.lines, this.reason});
  final int orderId;
  final DateTime date;
  final String distributor;
  final String status;
  final double qty;
  final double total;
  final List<DistOrderLine> lines;

  /// Why the office cancelled the order.
  final String? reason;

  factory DistOrder.fromJson(Map<String, dynamic> j) => DistOrder(
        orderId: (j['orderId'] as num).toInt(),
        date: DateTime.parse(j['date'] as String).toLocal(),
        distributor: (j['distributor'] as String?) ?? '',
        status: (j['status'] as String?) ?? '',
        qty: _num(j['qty']),
        total: _num(j['total']),
        reason: j['reason'] as String?,
        lines: [
          for (final l in (j['lines'] as List?) ?? const [])
            DistOrderLine(sku: (l['sku'] as String?) ?? '', name: (l['name'] as String?) ?? '', qty: _num(l['qty']), rate: _num(l['rate']), amount: _num(l['amount'])),
        ],
      );
}

/// One slide of the home-screen carousel: an uploaded poster, or a designed card
/// (title, subtitle, colour) that can point at a product.
class ShopBanner {
  const ShopBanner({required this.id, required this.title, required this.bgColor, this.subtitle, this.cta, this.sku, this.image});

  final int id;
  final String title;
  final String? subtitle;
  final String? cta;

  /// Tapping opens this product; on a designed card its photo and price show too.
  final String? sku;
  final Color bgColor;

  /// Full URL of an uploaded poster. When set it fills the whole slide.
  final String? image;

  factory ShopBanner.fromJson(Map<String, dynamic> j, {required String base}) {
    final img = j['image'] as String?;
    return ShopBanner(
      id: (j['id'] as num).toInt(),
      title: (j['title'] as String?) ?? '',
      subtitle: j['subtitle'] as String?,
      cta: j['cta'] as String?,
      sku: j['sku'] as String?,
      bgColor: _hex(j['bgColor'] as String?),
      image: img == null ? null : (img.startsWith('http') ? img : '$base$img'),
    );
  }

  static Color _hex(String? s) {
    final v = int.tryParse((s ?? '').replaceFirst('#', ''), radix: 16);
    return v == null ? const Color(0xFF2B3990) : Color(0xFF000000 | v);
  }
}

/// Shown until the server has banners to give (e.g. an older backend without /banners).
/// Keep in step with the seed in db/049_shop_banner.sql.
const defaultBanners = [
  ShopBanner(id: -1, title: 'Farm-fresh goodness at your doorstep', subtitle: 'Antibiotic free. Untouched by hand.', bgColor: Color(0xFF7EAEF5)),
  ShopBanner(id: -2, title: 'Quality products curated for your healthy routine', subtitle: 'Gaia Toned Milk, packed fresh every morning', cta: 'Order milk', sku: '1003', bgColor: Color(0xFF4A86E0)),
  ShopBanner(id: -3, title: 'Pure Desi Ghee, slow-cooked the traditional way', cta: 'Shop ghee', sku: '1031', bgColor: Color(0xFF7EAEF5)),
  ShopBanner(id: -4, title: 'Soft, fresh paneer, rich in protein', cta: 'Add paneer', sku: '1005', bgColor: Color(0xFF4A86E0)),
];
