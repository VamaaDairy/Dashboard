import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Runs in its own isolate when a notification arrives with the app closed. The system tray shows
/// "notification" messages by itself; this only has to bring Firebase up for data-only messages.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

/// Firebase Cloud Messaging: permission, the phone's push token, and showing notifications that
/// arrive while the app is open (Android does not draw those by itself).
///
/// Everything here is best effort: with no Firebase config in the build (or no Play Services) the
/// app simply runs without notifications.
class Push {
  Push._();

  /// Everyone gets this topic, so a campaign can be sent from the Firebase console to all phones.
  static const allTopic = 'all';

  static const _channel = AndroidNotificationChannel(
    'gaia_default',
    'Gaia updates',
    description: 'Orders, deliveries and offers from Gaia',
    importance: Importance.high,
  );

  static final _local = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  /// True once Firebase is up; token calls do nothing before that.
  static bool get ready => _ready;

  /// The latest push token, once known.
  static String? token;

  /// Fires with each new token (first one, and whenever Firebase rotates it).
  static final _tokens = StreamController<String>.broadcast();
  static Stream<String> get onToken => _tokens.stream;

  /// Called with a notification's data when the user taps it (app was closed or in the background).
  static void Function(Map<String, dynamic> data)? onOpen;

  static Future<void> init() async {
    if (kIsWeb) return;
    try {
      await Firebase.initializeApp();
      _ready = true;
    } catch (e) {
      debugPrint('Push disabled (Firebase not configured): $e');
      return;
    }
    try {
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
      final fm = FirebaseMessaging.instance;

      // Android 13+ and iOS ask the user here
      await fm.requestPermission();
      // iOS: show alerts and sound even while the app is open
      await fm.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
        onDidReceiveNotificationResponse: (r) => _opened(r.payload),
      );
      await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(_channel);

      FirebaseMessaging.onMessage.listen(_showForeground);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => onOpen?.call(m.data));
      final first = await fm.getInitialMessage(); // the tap that launched the app
      if (first != null) scheduleMicrotask(() => onOpen?.call(first.data));

      // the classic FCM registration token: what firebase-admin's send({token}) and the console's
      // "send test message" expect (the newer onRegistered gives an installation id instead)
      // ignore: deprecated_member_use
      fm.onTokenRefresh.listen(_gotToken);
      // ignore: deprecated_member_use
      final t = await fm.getToken();
      if (t != null) _gotToken(t);
      await fm.subscribeToTopic(allTopic);
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }

  static void _gotToken(String t) {
    token = t;
    _tokens.add(t);
  }

  static void _opened(String? payload) {
    if (payload == null || payload.isEmpty) return;
    onOpen?.call({'payload': payload});
  }

  static Future<void> _showForeground(RemoteMessage m) async {
    final n = m.notification;
    if (n == null) return;
    await _local.show(
      id: n.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(_channel.id, _channel.name, channelDescription: _channel.description, importance: Importance.high, priority: Priority.high),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: m.data['orderKey'] as String?,
    );
  }

  /// Subscribe/unsubscribe to a topic (e.g. 'riders', 'distributors'). No-op without Firebase.
  static Future<void> subscribe(String topic) async {
    if (!_ready) return;
    try {
      await FirebaseMessaging.instance.subscribeToTopic(topic);
    } catch (_) {}
  }

  static Future<void> unsubscribe(String topic) async {
    if (!_ready) return;
    try {
      await FirebaseMessaging.instance.unsubscribeFromTopic(topic);
    } catch (_) {}
  }
}
