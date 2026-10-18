import 'package:flutter/foundation.dart';

import '../api.dart';
import '../models.dart';

/// Whether maps are switched on at the backend, and the style to draw them with. Loaded once.
class MapState extends ChangeNotifier {
  MapState(this._api);
  final Api _api;

  MapConfig? config;
  bool _loading = false;

  bool get enabled => config?.enabled == true && config?.styleUrl != null;
  String get styleUrl => config?.styleUrl ?? '';

  Future<void> load() async {
    if (_loading || config != null) return;
    _loading = true;
    try {
      config = await _api.mapConfig();
    } catch (_) {
      config = const MapConfig(enabled: false); // maps are a bonus; the app still works without
    }
    _loading = false;
    notifyListeners();
  }
}
