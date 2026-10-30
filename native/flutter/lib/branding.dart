import "dart:convert";
import "dart:typed_data";

import "package:http/http.dart" as http;

import "flavor.dart";

class Branding {
  const Branding({required this.name, this.logoBytes});

  final String name;
  final Uint8List? logoBytes;

  static Future<Branding> fetch(Flavor flavor) async {
    final uri = Uri.parse("${siteUrl.replaceAll(RegExp(r"/$"), "")}/api/mobile/feed?t=${DateTime.now().millisecondsSinceEpoch}");
    final response = await http.get(uri, headers: {"accept": "application/json"});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError("Feed ${response.statusCode}");
    }
    final decoded = jsonDecode(response.body);
    final root = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    final feed = root["feed"] is Map<String, dynamic> ? root["feed"] as Map<String, dynamic> : root;
    final mobile = feed["mobile"] is Map<String, dynamic> ? feed["mobile"] as Map<String, dynamic> : <String, dynamic>{};
    final apps = mobile["apps"] is Map<String, dynamic> ? mobile["apps"] as Map<String, dynamic> : <String, dynamic>{};
    final brand = apps[flavor.id] is Map<String, dynamic> ? apps[flavor.id] as Map<String, dynamic> : <String, dynamic>{};
    final site = feed["site"] is Map<String, dynamic> ? feed["site"] as Map<String, dynamic> : <String, dynamic>{};
    final name = _text(brand["name"]) ?? _text(site["name"]) ?? flavor.displayName;
    final logo = _text(brand["logoUrl"]) ?? _text(site["logoUrl"]);
    return Branding(name: name, logoBytes: await _logo(logo));
  }

  static String? _text(dynamic value) {
    if (value is! String) return null;
    final text = value.trim();
    return text.isEmpty ? null : text;
  }

  static Future<Uint8List?> _logo(String? value) async {
    if (value == null || value.isEmpty) return null;
    try {
      if (value.startsWith("data:image")) {
        final comma = value.indexOf(",");
        if (comma < 0) return null;
        return base64Decode(value.substring(comma + 1));
      }
      final uri = Uri.parse(value.startsWith("http") ? value : "$siteUrl$value");
      final response = await http.get(uri);
      if (response.statusCode >= 200 && response.statusCode < 300) return response.bodyBytes;
    } catch (_) {}
    return null;
  }
}
