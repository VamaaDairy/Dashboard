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
  });

  final String sku;
  final String name;
  final String category;
  final String subCategory;
  final String? size;
  final String? description;
  final String? image;
  final double mrp;
  final double price;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        sku: j['sku'] as String,
        name: j['name'] as String,
        category: (j['category'] as String?) ?? '',
        subCategory: (j['subCategory'] as String?) ?? '',
        size: j['size'] as String?,
        description: j['description'] as String?,
        image: j['image'] as String?,
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
class RoutePath {
  const RoutePath({required this.points, this.distanceM, this.durationS});
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
