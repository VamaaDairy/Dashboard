import 'package:flutter/foundation.dart';

import '../api.dart';
import '../models.dart';

/// Whether maps are switched on at the backend, and the style to draw them with. Loaded once.
class MapState extends ChangeNotifier {
  MapState(this._api);
  final Api _api;

  MapConfig? config;
  bool _loading = false;

  /// What the map widget draws with: a URL of the keyed style on our backend, or the keyed style
  /// JSON itself (built on the phone for an older backend). Empty until loaded.
  String _style = '';

  bool get enabled => config?.enabled == true && _style.isNotEmpty;
  String get styleUrl => _style;

  Future<void> load() async {
    if (_loading || config != null) return;
    _loading = true;
    try {
      final c = await _api.mapConfig();
      if (c.enabled && c.stylePath != null) {
        _style = _api.absolute(c.stylePath!);
      } else if (c.enabled && c.styleUrl != null) {
        _style = await _api.keyedOlaStyle(c.styleUrl!) ?? '';
      }
      config = c;
    } catch (_) {
      config = const MapConfig(enabled: false); // maps are a bonus; the app still works without
    }
    _loading = false;
    notifyListeners();
  }
}
