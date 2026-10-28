import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import 'core.dart';

/// Whether maps are switched on at the backend, and the style to draw them with.
class MapInfo {
  const MapInfo({this.config, this.style = '', this.loading = false});
  final MapConfig? config;

  /// What the map widget draws with: a URL of the keyed style on our backend, or the keyed style
  /// JSON itself (built on the phone for an older backend). Empty until loaded.
  final String style;
  final bool loading;

  bool get enabled => config?.enabled == true && style.isNotEmpty;

  /// Still finding out (first load, or retrying after no signal) - show "loading", not "not available".
  bool get pending => config == null || loading;
  String get styleUrl => style;
}

final mapProvider = NotifierProvider<MapStore, MapInfo>(MapStore.new);

/// Loaded once per app run; a failed load (no signal) is retried every few seconds.
class MapStore extends Notifier<MapInfo> {
  @override
  MapInfo build() => const MapInfo();

  Future<void> load() async {
    // screens call this from initState, i.e. while the tree is building - change state only after
    await Future<void>.delayed(Duration.zero);
    if (state.loading || state.config != null) return;
    state = MapInfo(loading: true);
    final api = ref.read(apiProvider);
    try {
      final c = await api.mapConfig();
      var style = '';
      if (c.enabled && c.stylePath != null) {
        style = api.absolute(c.stylePath!);
      } else if (c.enabled && c.styleUrl != null) {
        style = await api.keyedOlaStyle(c.styleUrl!) ?? '';
      }
      if (ref.mounted) state = MapInfo(config: c, style: style);
      return;
    } catch (_) {
      // no signal / server hiccup: try again shortly
    }
    if (!ref.mounted) return;
    state = const MapInfo();
    await Future<void>.delayed(const Duration(seconds: 8));
    if (ref.mounted && state.config == null) await load();
  }
}
