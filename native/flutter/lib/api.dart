import "dart:convert";
import "dart:typed_data";

import "package:flutter/material.dart";
import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";

import "flavor.dart";

class Session {
  const Session({required this.token, required this.email, required this.name});
  final String token;
  final String email;
  final String name;

  Map<String, dynamic> toJson() => {"token": token, "email": email, "name": name};

  static Session? fromJson(Map<String, dynamic>? json) {
    if (json == null || json["token"] == null) return null;
    return Session(token: "${json["token"]}", email: "${json["email"] ?? ""}", name: "${json["name"] ?? ""}");
  }
}

class VgmfApi {
  VgmfApi._();
  static final VgmfApi instance = VgmfApi._();

  String base = siteUrl.replaceAll(RegExp(r"/$"), "");
  Session? session;

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString("vgmf-session");
    if (raw == null) return;
    session = Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> saveSession(Session? next) async {
    session = next;
    final prefs = await SharedPreferences.getInstance();
    if (next == null) {
      await prefs.remove("vgmf-session");
    } else {
      await prefs.setString("vgmf-session", jsonEncode(next.toJson()));
    }
  }

  Map<String, String> get _headers {
    final headers = {"accept": "application/json", "content-type": "application/json"};
    if (session != null) headers["authorization"] = "Bearer ${session!.token}";
    return headers;
  }

  Future<Map<String, dynamic>> _parse(http.Response response) async {
    try {
      final decoded = jsonDecode(response.body);
      return decoded is Map<String, dynamic> ? decoded : {"ok": false, "error": "Unexpected response"};
    } catch (_) {
      return {"ok": false, "error": response.body.isEmpty ? "HTTP ${response.statusCode}" : response.body};
    }
  }

  Future<Map<String, dynamic>> fetchFeed() async {
    final urls = ["$base/api/mobile/feed?t=${DateTime.now().millisecondsSinceEpoch}", "$base/app-feed.json"];
    Object? last;
    for (final url in urls) {
      try {
        final data = await _parse(await http.get(Uri.parse(url), headers: {"accept": "application/json"}));
        final feed = data["feed"] is Map<String, dynamic> ? data["feed"] as Map<String, dynamic> : data;
        if (feed["site"] is Map) {
          final mobile = feed["mobile"];
          final api = mobile is Map ? mobile["apiBaseUrl"] : null;
          if (api is String && api.startsWith("http")) base = api.replaceAll(RegExp(r"/$"), "");
          return feed;
        }
        last = data["error"] ?? "Feed missing";
      } catch (error) {
        last = error;
      }
    }
    throw Exception("$last");
  }

  Future<void> sendOtp(String email, String name) async {
    final data = await _parse(await http.post(Uri.parse("$base/api/mobile/otp"), headers: _headers, body: jsonEncode({"action": "send", "email": email, "name": name})));
    if (data["ok"] != true) throw Exception(data["error"] ?? "Could not send the code.");
  }

  Future<Session> verifyOtp(String email, String code, String name) async {
    final data = await _parse(await http.post(Uri.parse("$base/api/mobile/otp"), headers: _headers, body: jsonEncode({"action": "verify", "email": email, "code": code, "name": name})));
    if (data["ok"] != true || data["token"] == null) throw Exception(data["error"] ?? "That code is not valid.");
    final next = Session(token: "${data["token"]}", email: "${data["email"] ?? email}", name: "${data["name"] ?? name}");
    await saveSession(next);
    return next;
  }

  Future<List<dynamic>> tickets() async {
    final data = await _parse(await http.get(Uri.parse("$base/api/mobile/tickets"), headers: _headers));
    if (data["ok"] != true) throw Exception(data["error"] ?? "Could not load tickets.");
    return (data["tickets"] as List?) ?? [];
  }

  Future<void> createTicket({required String name, required String email, required String subject, required String body, String? phone}) async {
    final data = await _parse(await http.post(Uri.parse("$base/api/mobile/tickets"), headers: _headers, body: jsonEncode({"name": name, "email": email, "phone": phone, "subject": subject, "body": body})));
    if (data["ok"] != true) throw Exception(data["error"] ?? "Could not create the ticket.");
  }

  Future<List<dynamic>> orders() async {
    final data = await _parse(await http.get(Uri.parse("$base/api/mobile/orders"), headers: _headers));
    if (data["ok"] != true) throw Exception(data["error"] ?? "Could not load orders.");
    return (data["orders"] as List?) ?? [];
  }

  Future<void> placeOrder({required List<Map<String, dynamic>> items, String? name, String? email, String? phone}) async {
    final data = await _parse(await http.post(Uri.parse("$base/api/mobile/orders"), headers: _headers, body: jsonEncode({"items": items, "name": name, "email": email, "phone": phone})));
    if (data["ok"] != true) throw Exception(data["error"] ?? "Could not place the order.");
  }

  Future<Map<String, dynamic>> verifyCertificate(String number) async {
    return _parse(await http.get(Uri.parse("$base/api/certificates/verify?number=${Uri.encodeQueryComponent(number)}"), headers: {"accept": "application/json"}));
  }
}

ImageProvider? imageProvider(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  final text = value.trim();
  try {
    if (text.startsWith("data:image")) {
      final comma = text.indexOf(",");
      if (comma < 0) return null;
      return MemoryImage(Uint8List.fromList(base64Decode(text.substring(comma + 1))));
    }
    final uri = text.startsWith("http") ? text : "${VgmfApi.instance.base}$text";
    return NetworkImage(uri);
  } catch (_) {
    return null;
  }
}

String str(dynamic value, [String fallback = ""]) {
  if (value == null) return fallback;
  final text = "$value".trim();
  return text.isEmpty ? fallback : text;
}

bool moduleOn(Map<String, dynamic>? feed, String id) {
  if (feed == null) return true;
  final visibility = feed["visibility"];
  final mobile = feed["mobile"];
  final modules = mobile is Map ? mobile["modules"] : null;
  if (visibility is Map && visibility[id] == false) return false;
  if (modules is Map && modules[id] == false) return false;
  return true;
}
