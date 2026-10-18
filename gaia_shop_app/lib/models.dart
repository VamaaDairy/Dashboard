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
  int qty;

  double get total => price * qty;

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

class OrderItem {
  OrderItem({required this.sku, required this.name, required this.qty, required this.unitPrice, required this.lineTotal, this.image});
  final String sku;
  final String name;
  final String? image;
  final int qty;
  final double unitPrice;
  final double lineTotal;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        sku: j['sku'] as String,
        name: j['name'] as String,
        image: j['image'] as String?,
        qty: (j['qty'] as num).toInt(),
        unitPrice: _num(j['unitPrice']),
        lineTotal: _num(j['lineTotal']),
      );
}

class Order {
  Order({
    required this.orderNo,
    required this.accessKey,
    required this.status,
    required this.statusLabel,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.createdAt,
    required this.name,
    required this.phone,
    required this.address,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.items,
    this.pincode,
    this.notes,
    this.id,
    this.lat,
    this.lng,
    this.deliveryOtp,
    this.rider,
  });

  /// Only riders get the id (to act on the order).
  final int? id;
  final double? lat;
  final double? lng;
  /// The code the customer reads out at the door (never sent to riders).
  final String? deliveryOtp;
  final RiderInfo? rider;

  bool get hasPin => lat != null && lng != null;
  bool get isOpen => status == 'placed' || status == 'confirmed' || status == 'out_for_delivery';

  final String orderNo;
  final String accessKey;
  final String status;
  final String statusLabel;
  final String paymentMethod;
  final String paymentStatus;
  final DateTime createdAt;
  final String name;
  final String phone;
  final String address;
  final String? pincode;
  final String? notes;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final List<OrderItem> items;

  int get itemCount => items.fold(0, (s, i) => s + i.qty);

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        orderNo: j['orderNo'] as String,
        accessKey: j['accessKey'] as String,
        status: j['status'] as String,
        statusLabel: (j['statusLabel'] as String?) ?? (j['status'] as String),
        paymentMethod: (j['paymentMethod'] as String?) ?? 'cod',
        paymentStatus: (j['paymentStatus'] as String?) ?? 'pending',
        createdAt: DateTime.parse(j['createdAt'] as String).toLocal(),
        name: j['name'] as String,
        phone: j['phone'] as String,
        address: j['address'] as String,
        pincode: j['pincode'] as String?,
        notes: j['notes'] as String?,
        subtotal: _num(j['subtotal']),
        deliveryFee: _num(j['deliveryFee']),
        total: _num(j['total']),
        items: ((j['items'] as List?) ?? []).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
        id: (j['id'] as num?)?.toInt(),
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        deliveryOtp: j['deliveryOtp'] as String?,
        rider: j['rider'] is Map<String, dynamic> ? RiderInfo.fromJson(j['rider'] as Map<String, dynamic>) : null,
      );
}

/// What the customer types at checkout; also remembered for next time.
class Customer {
  const Customer({this.name = '', this.phone = '', this.address = '', this.pincode = '', this.lat, this.lng});
  final double? lat;
  final double? lng;
  final String name;
  final String phone;
  final String address;
  final String pincode;

  Map<String, dynamic> toJson() => {'name': name, 'phone': phone, 'address': address, 'pincode': pincode, 'lat': lat, 'lng': lng};

  factory Customer.fromJson(Map<String, dynamic> j) => Customer(
        name: (j['name'] as String?) ?? '',
        phone: (j['phone'] as String?) ?? '',
        address: (j['address'] as String?) ?? '',
        pincode: (j['pincode'] as String?) ?? '',
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
      );
}

/// The rider on a customer's order. Position is only filled once the order is out for delivery.
class RiderInfo {
  const RiderInfo({required this.name, required this.phone, this.lat, this.lng, this.locationAt});
  final String name;
  final String phone;
  final double? lat;
  final double? lng;
  final DateTime? locationAt;

  bool get hasPosition => lat != null && lng != null;

  factory RiderInfo.fromJson(Map<String, dynamic> j) => RiderInfo(
        name: (j['name'] as String?) ?? 'Delivery partner',
        phone: (j['phone'] as String?) ?? '',
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        locationAt: j['locationAt'] is String ? DateTime.tryParse(j['locationAt'] as String)?.toLocal() : null,
      );
}

/// A point on the map.
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
  const MapConfig({required this.enabled, this.styleUrl});
  final bool enabled;
  final String? styleUrl;
}

/// A signed-in delivery rider.
class RiderProfile {
  const RiderProfile({required this.name, required this.phone});
  final String name;
  final String phone;
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
  ShopBanner(id: -5, title: 'Pin your exact doorstep for perfectly timed delivery', subtitle: 'Drop a pin on the map at checkout', bgColor: Color(0xFF7EAEF5)),
];
