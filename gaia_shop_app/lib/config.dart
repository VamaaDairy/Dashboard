/// Where the dashboard backend lives. Change it at build time without touching code:
///   flutter run --dart-define=API_BASE=http://192.168.1.20:3001
/// (use your computer's address when testing on a phone; an Android emulator reaches
/// the computer at http://10.0.2.2:3001).
const String apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://production.vamadairy.in',
);

const String appName = 'Gaia';
const String tagline = 'nourishment for life';
