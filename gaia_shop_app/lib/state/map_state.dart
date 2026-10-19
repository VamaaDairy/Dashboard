import 'package:flutter/foundation.dart';

import '../api.dart';
import '../models.dart';

/// Whether maps are switched on at the backend, and the style to draw them with.
/// Loaded once; a failed load (no signal) is tried again the next time a map is shown.
class MapState extends ChangeNotifier {
  MapState(this._api);
  final Api _api;

  MapConfig? config;
  bool _loading = false;

  /// What the map widget draws with: a URL of the keyed style on our backend, or the keyed style
  /// JSON itself (built on the phone for an older backend). Empty until loaded.
  String _style = '';

  bool get enabled => config?.enabled == true && _style.isNotEmpty;

  /// Still finding out (first load, or retrying after no signal) - show "loading", not "not available".
  bool get pending => config == null || _loading;
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
      _loading = false;
      notifyListeners();
      return;
    } catch (_) {
      // no signal / server hiccup: leave config unset so the next map on screen tries again
    }
    _loading = false;
    notifyListeners();
    await Future<void>.delayed(const Duration(seconds: 8));
    if (config == null) await load();
  }
}
