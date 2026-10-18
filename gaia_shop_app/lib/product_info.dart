import 'package:flutter/material.dart';

import 'models.dart';

/// What the product page says about a product beyond name and price: a short story,
/// highlights, typical nutrition and how to store it. Footprints has none of this yet,
/// so it lives here by category (a product's own description from the server wins).
///
/// Nutrition figures are typical values for the kind of product, not lab values for a
/// batch - the page says so and points to the pack.
class ProductInfo {
  const ProductInfo({required this.about, required this.highlights, required this.nutrition, required this.storage, this.per = '100 g'});

  final String about;
  final List<Highlight> highlights;

  /// (label, value) rows, e.g. ('Protein', '3.3 g').
  final List<(String, String)> nutrition;
  final String storage;

  /// What the nutrition values are per: '100 g' or '100 ml'.
  final String per;
}

class Highlight {
  const Highlight(this.icon, this.label);
  final IconData icon;
  final String label;
}

const _chilled = 'Keep refrigerated at or below 4°C. Once opened, use within 2 days.';
const _pasteurised = Highlight(Icons.local_fire_department_outlined, 'Pasteurised');
const _antibiotic = Highlight(Icons.verified_outlined, 'Antibiotic free');
const _untouched = Highlight(Icons.back_hand_outlined, 'Untouched by hand');
const _protein = Highlight(Icons.fitness_center, 'Rich in protein');
const _calcium = Highlight(Icons.health_and_safety_outlined, 'Source of calcium');
const _veg = Highlight(Icons.eco_outlined, '100% vegetarian');

const _milk = ProductInfo(
  per: '100 ml',
  about: 'Fresh Gaia milk, collected from our partner farmers, chilled at the village centre and pasteurised and packed at our plant - '
      'so it reaches you fresh every morning. Great for tea, coffee, cereal or a warm glass at bedtime.',
  highlights: [_antibiotic, _untouched, _pasteurised, _calcium],
  nutrition: [('Energy', '64 kcal'), ('Protein', '3.3 g'), ('Fat', '3.5 g'), ('Carbohydrate', '4.7 g'), ('Calcium', '120 mg')],
  storage: 'Keep refrigerated at or below 4°C. Boil before use and consume within 24 hours of opening.',
);

const _uht = ProductInfo(
  per: '100 ml',
  about: 'Gaia UHT milk is heated to ultra-high temperature and sealed in a multi-layer pack, so it stays fresh without refrigeration '
      'until opened. Handy for travel, the office and the store cupboard - no boiling needed.',
  highlights: [_antibiotic, Highlight(Icons.inventory_2_outlined, 'No refrigeration till opened'), Highlight(Icons.local_cafe_outlined, 'Ready to drink'), _calcium],
  nutrition: [('Energy', '62 kcal'), ('Protein', '3.2 g'), ('Fat', '3.0 g'), ('Carbohydrate', '4.9 g'), ('Calcium', '120 mg')],
  storage: 'Store in a cool, dry place away from sunlight. Once opened, refrigerate and use within 2 days.',
);

const _paneer = ProductInfo(
  about: 'Soft, fresh Gaia malai paneer made from pure milk. It holds its shape in curries, tikka and bhurji and stays soft in every bite - '
      'a simple way to add protein to everyday meals.',
  highlights: [_protein, _calcium, Highlight(Icons.restaurant_outlined, 'Soft & fresh'), _veg],
  nutrition: [('Energy', '265 kcal'), ('Protein', '18 g'), ('Fat', '20 g'), ('Carbohydrate', '1.2 g'), ('Calcium', '480 mg')],
  storage: _chilled,
);

const _lowFatPaneer = ProductInfo(
  about: 'Gaia Low Fat Paneer gives you the bite of fresh paneer with less fat - made for people watching their fat intake '
      'without giving up protein.',
  highlights: [Highlight(Icons.trending_down, 'Low fat'), _protein, _calcium, _veg],
  nutrition: [('Energy', '185 kcal'), ('Protein', '22 g'), ('Fat', '10 g'), ('Carbohydrate', '3.0 g'), ('Calcium', '500 mg')],
  storage: _chilled,
);

const _dahi = ProductInfo(
  about: 'Thick, creamy Gaia dahi set from pasteurised milk with live cultures. Enjoy it plain, as raita, or with parathas - '
      'naturally good for digestion.',
  highlights: [Highlight(Icons.spa_outlined, 'Live cultures'), Highlight(Icons.favorite_border, 'Good for digestion'), _calcium, _pasteurised],
  nutrition: [('Energy', '60 kcal'), ('Protein', '3.1 g'), ('Fat', '3.0 g'), ('Carbohydrate', '4.5 g'), ('Calcium', '120 mg')],
  storage: _chilled,
);

const _kadhiDahi = ProductInfo(
  about: 'Gaia Kadhi Dahi is set slightly tangy, just right for kadhi, marinades, dhokla and batters - the sourness cooking needs, '
      'without waiting a day for it.',
  highlights: [Highlight(Icons.soup_kitchen_outlined, 'Made for cooking'), Highlight(Icons.spa_outlined, 'Live cultures'), _pasteurised, _veg],
  nutrition: [('Energy', '50 kcal'), ('Protein', '3.0 g'), ('Fat', '2.0 g'), ('Carbohydrate', '4.5 g'), ('Calcium', '110 mg')],
  storage: _chilled,
);

const _lassi = ProductInfo(
  per: '100 ml',
  about: 'Chilled Gaia lassi, churned from fresh dahi - thick, sweet and refreshing. Best served cold on a hot afternoon.',
  highlights: [Highlight(Icons.ac_unit, 'Serve chilled'), Highlight(Icons.spa_outlined, 'Made from fresh dahi'), Highlight(Icons.local_drink_outlined, 'Ready to drink'), _veg],
  nutrition: [('Energy', '90 kcal'), ('Protein', '2.5 g'), ('Fat', '2.0 g'), ('Carbohydrate', '15 g'), ('Calcium', '90 mg')],
  storage: 'Keep refrigerated at or below 4°C. Shake well and drink soon after opening.',
);

const _chaas = ProductInfo(
  per: '100 ml',
  about: 'Gaia Masala Chaas - light buttermilk with a touch of spices. Cools you down and goes well with any meal.',
  highlights: [Highlight(Icons.ac_unit, 'Serve chilled'), Highlight(Icons.favorite_border, 'Light & cooling'), Highlight(Icons.local_drink_outlined, 'Ready to drink'), _veg],
  nutrition: [('Energy', '25 kcal'), ('Protein', '1.2 g'), ('Fat', '0.8 g'), ('Carbohydrate', '3.0 g'), ('Calcium', '50 mg')],
  storage: 'Keep refrigerated at or below 4°C. Shake well before serving.',
);

const _sweet = ProductInfo(
  about: 'A traditional Gaia sweet made from milk the slow way - rich, creamy and just sweet enough. Perfect for festivals, guests '
      'or an after-dinner treat.',
  highlights: [Highlight(Icons.celebration_outlined, 'Festive favourite'), Highlight(Icons.water_drop_outlined, 'Made from pure milk'), _veg],
  nutrition: [('Energy', '300 kcal'), ('Protein', '8 g'), ('Fat', '15 g'), ('Carbohydrate', '35 g')],
  storage: _chilled,
);

const _peda = ProductInfo(
  about: 'Gaia peda, cooked down from milk and khowa the traditional way. Soft, melt-in-the-mouth and made for sharing.',
  highlights: [Highlight(Icons.celebration_outlined, 'Festive favourite'), Highlight(Icons.water_drop_outlined, 'Made from pure milk'), _veg],
  nutrition: [('Energy', '420 kcal'), ('Protein', '10 g'), ('Fat', '15 g'), ('Carbohydrate', '60 g')],
  storage: 'Store in a cool, dry place or refrigerate. Best consumed within a few days of opening.',
);

const _khowa = ProductInfo(
  about: 'Unsweetened Gaia khowa (mawa), slow-cooked from milk until rich and grainy - the base for gulab jamun, barfi, halwa and peda.',
  highlights: [Highlight(Icons.soup_kitchen_outlined, 'For sweets & cooking'), Highlight(Icons.no_food_outlined, 'Unsweetened'), _protein, _veg],
  nutrition: [('Energy', '420 kcal'), ('Protein', '20 g'), ('Fat', '25 g'), ('Carbohydrate', '25 g')],
  storage: _chilled,
);

const _ghee = ProductInfo(
  about: 'Gaia Desi Ghee is slow-cooked from cream the traditional way for its rich aroma and grainy texture. '
      'A spoon on hot rotis or dal, or use it for tadka and sweets.',
  highlights: [Highlight(Icons.local_fire_department_outlined, 'Slow-cooked'), Highlight(Icons.air, 'Rich aroma'), Highlight(Icons.grain, 'Grainy texture'), _veg],
  nutrition: [('Energy', '897 kcal'), ('Fat', '99.7 g'), ('Protein', '0 g'), ('Carbohydrate', '0 g')],
  storage: 'Store in a cool, dry place away from sunlight. Use a dry spoon. No refrigeration needed.',
);

/// A product's page content: by its category name (as Footprints spells it).
ProductInfo infoFor(Product p) {
  final c = p.category.toLowerCase();
  final n = p.name.toLowerCase();
  final base = switch (c) {
    _ when c.contains('uht') => _uht,
    _ when c.contains('low fat paneer') => _lowFatPaneer,
    _ when c.contains('paneer') => _paneer,
    _ when c.contains('kadhi') => _kadhiDahi,
    _ when c.contains('dahi') || c.contains('curd') => _dahi,
    _ when c.contains('lassi') => _lassi,
    _ when c.contains('chaas') || c.contains('butter milk') => _chaas,
    _ when c.contains('ghee') => _ghee,
    _ when c.contains('peda') => _peda,
    _ when c.contains('khowa') || c.contains('mawa') => _khowa,
    _ when c.contains('rabdi') || c.contains('shrikhand') => _sweet,
    _ when c.contains('milk') => _milk,
    _ => _sweet,
  };
  // cow milk runs richer than toned
  final nutrition = base == _milk && n.contains('cow')
      ? const [('Energy', '67 kcal'), ('Protein', '3.1 g'), ('Fat', '4.0 g'), ('Carbohydrate', '4.7 g'), ('Calcium', '120 mg')]
      : base.nutrition;
  final about = (p.description != null && p.description!.trim().isNotEmpty) ? p.description!.trim() : base.about;
  return ProductInfo(about: about, highlights: base.highlights, nutrition: nutrition, storage: base.storage, per: base.per);
}
