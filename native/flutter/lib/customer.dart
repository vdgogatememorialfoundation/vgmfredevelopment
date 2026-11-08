import "dart:async";
import "dart:convert";

import "package:flutter/material.dart";
import "package:http/http.dart" as http;
import "package:razorpay_flutter/razorpay_flutter.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:url_launcher/url_launcher.dart";

import "api.dart";
import "theme.dart";

/// Shared state for the customer app: the published site feed, the bag and the signed-in account.
class Store extends ChangeNotifier {
  Store._();
  static final Store i = Store._();
  final api = VgmfApi.instance;
  Map<String, dynamic>? feed;
  String error = "";
  Map<String, int> bag = {};
  List<dynamic> orders = [];

  Future<void> init() async {
    await api.loadSession();
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString("vgmf-bag");
    if (raw != null) bag = Map<String, int>.from(jsonDecode(raw) as Map);
    await refresh();
  }

  Future<void> refresh() async {
    try {
      feed = await api.fetchFeed();
      error = "";
    } catch (err) {
      error = "Could not load the site. Pull down to try again.";
    }
    notifyListeners();
    if (api.session != null) unawaited(loadOrders());
  }

  List<Map<String, dynamic>> list(String key) => ((feed?[key] as List?) ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  Map<String, dynamic> map(String key) => feed?[key] is Map ? Map<String, dynamic>.from(feed![key] as Map) : {};
  bool on(String id) => moduleOn(feed, id);

  Map<String, dynamic>? book(String id) => list("books").where((b) => str(b["id"]) == id).firstOrNull;
  int get bagCount => bag.values.fold(0, (a, b) => a + b);
  double get bagTotal => bag.entries.fold(0, (sum, e) => sum + ((book(e.key)?["price"] as num?)?.toDouble() ?? 0) * e.value);

  Future<void> setQty(String id, int qty) async {
    if (qty <= 0) {
      bag.remove(id);
    } else {
      bag[id] = qty.clamp(1, 20);
    }
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("vgmf-bag", jsonEncode(bag));
  }

  Map<String, String> get headers => {
        "accept": "application/json",
        "content-type": "application/json",
        if (api.session != null) "authorization": "Bearer ${api.session!.token}",
      };

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(Uri.parse("${api.base}$path"), headers: headers, body: jsonEncode(body));
    try {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    } catch (_) {
      return {"ok": false, "error": "HTTP ${res.statusCode}"};
    }
  }

  Future<void> loadOrders() async {
    try {
      final res = await http.get(Uri.parse("${api.base}/api/mobile/orders"), headers: headers);
      final data = jsonDecode(res.body) as Map;
      if (data["ok"] == true) orders = (data["orders"] as List?) ?? [];
      notifyListeners();
    } catch (_) {}
  }
}

String money(dynamic v) => "₹${((v as num?)?.toDouble() ?? 0).toStringAsFixed(0)}";
String plain(String html) => html.replaceAll(RegExp(r"<br\s*/?>|</p>", caseSensitive: false), "\n").replaceAll(RegExp(r"<[^>]+>"), "").replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").trim();
String day(dynamic iso) {
  final d = DateTime.tryParse(str(iso))?.toLocal();
  if (d == null) return "";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return "${d.day} ${m[d.month - 1]} ${d.year}";
}

Future<void> openExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
}

void push(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

class CustomerApp extends StatefulWidget {
  const CustomerApp({super.key});
  @override
  State<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends State<CustomerApp> {
  var tab = 0;
  @override
  void initState() {
    super.initState();
    Store.i.init();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final s = Store.i;
        final site = s.map("site");
        final pages = [const HomeTab(), const ArticlesPage(), const EventsTab(), const ShopTab(), const MoreTab()];
        return Scaffold(
          appBar: AppBar(
            backgroundColor: Colors.white,
            foregroundColor: VgmfColors.ink,
            surfaceTintColor: Colors.white,
            shape: const Border(bottom: BorderSide(color: VgmfColors.border)),
            titleSpacing: 12,
            title: Row(children: [
              if (imageProvider(str(site["logoUrl"])) != null) Padding(padding: const EdgeInsets.only(right: 10), child: Image(image: imageProvider(str(site["logoUrl"]))!, height: 34)),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(str(site["name"], "Vaidya Gogate Memorial Foundation").replaceAll(RegExp("Memorial Foundation", caseSensitive: false), "").trim(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const Text("MEMORIAL FOUNDATION", style: TextStyle(fontSize: 10, letterSpacing: 1.6, color: VgmfColors.gold)),
              ])),
            ]),
            actions: [
              IconButton(
                onPressed: () => push(context, const BagPage()),
                icon: Badge(isLabelVisible: s.bagCount > 0, label: Text("${s.bagCount}"), child: const Icon(Icons.shopping_bag_outlined)),
              ),
            ],
          ),
          body: s.feed == null && s.error.isEmpty ? const Center(child: CircularProgressIndicator()) : pages[tab],
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (i) => setState(() => tab = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), label: "Home"),
              NavigationDestination(icon: Icon(Icons.article_outlined), label: "Articles"),
              NavigationDestination(icon: Icon(Icons.event_outlined), label: "Events"),
              NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: "Shop"),
              NavigationDestination(icon: Icon(Icons.menu), label: "More"),
            ],
          ),
        );
      },
    );
  }
}

class Section extends StatelessWidget {
  const Section(this.title, {super.key, this.action});
  final String title;
  final VoidCallback? action;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 8),
        child: Row(children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: VgmfColors.ink))),
          if (action != null) TextButton(onPressed: action, child: const Text("See all")),
        ]),
      );
}

class Tile extends StatelessWidget {
  const Tile({super.key, required this.title, this.subtitle = "", this.kicker = "", this.image, this.onTap, this.trailing});
  final String title, subtitle, kicker;
  final String? image;
  final VoidCallback? onTap;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final img = imageProvider(image);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (img != null) Padding(padding: const EdgeInsets.only(right: 12), child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image(image: img, width: 72, height: 72, fit: BoxFit.cover))),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (kicker.isNotEmpty) Text(kicker.toUpperCase(), style: const TextStyle(fontSize: 10.5, letterSpacing: 1, fontWeight: FontWeight.w700, color: VgmfColors.gold)),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5, color: VgmfColors.ink)),
              if (subtitle.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: VgmfColors.muted))),
            ])),
            ?trailing,
          ]),
        ),
      ),
    );
  }
}

Widget refreshable(List<Widget> children) => RefreshIndicator(
      onRefresh: Store.i.refresh,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
        if (Store.i.error.isNotEmpty) Card(color: const Color(0xFFFFF3F0), child: Padding(padding: const EdgeInsets.all(12), child: Text(Store.i.error))),
        ...children,
      ]),
    );

/// Full-screen flyer with the close button above the image so it never covers the artwork.
void showFlyer(BuildContext context, Map<String, dynamic> flyer) {
  final img = imageProvider(str(flyer["image"]));
  showDialog(
    context: context,
    builder: (context) => Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(12),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
        IconButton.filled(
          style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink),
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close),
          tooltip: "Close",
        ),
        const SizedBox(height: 8),
        if (img != null) ClipRRect(borderRadius: BorderRadius.circular(16), child: InteractiveViewer(child: Image(image: img, fit: BoxFit.contain))),
      ]),
    ),
  );
}

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});
  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  final pager = PageController();
  Timer? timer;
  var page = 0;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 6), (_) {
      final n = flyers.length;
      if (n < 2 || !pager.hasClients) return;
      page = (page + 1) % n;
      pager.animateToPage(page, duration: const Duration(milliseconds: 450), curve: Curves.easeOut);
    });
  }

  List<Map<String, dynamic>> get flyers => Store.i.list("flyers").where((f) => str(f["image"]).isNotEmpty && f["isMobile"] != false).toList();

  @override
  void dispose() {
    timer?.cancel();
    pager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = Store.i;
    final site = s.map("site");
    final shlokas = ((site["shlokas"] as List?) ?? []).map((e) => str(e)).where((e) => e.isNotEmpty).toList();
    return refreshable([
      if (site["shlokaBar"] == true && shlokas.isNotEmpty) Card(color: VgmfColors.paper, child: Padding(padding: const EdgeInsets.all(10), child: Text(shlokas.first, textAlign: TextAlign.center, style: const TextStyle(color: VgmfColors.burgundy, fontWeight: FontWeight.w600)))),
      if (flyers.isNotEmpty)
        AspectRatio(
          aspectRatio: 4 / 5,
          child: PageView(controller: pager, onPageChanged: (p) => page = p, children: [
            for (final f in flyers)
              GestureDetector(
                onTap: () => showFlyer(context, f),
                child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: ClipRRect(borderRadius: BorderRadius.circular(18), child: Image(image: imageProvider(str(f["image"]))!, fit: BoxFit.cover))),
              ),
          ]),
        ),
      Padding(padding: const EdgeInsets.only(top: 14), child: Text(str(site["tagline"]), style: const TextStyle(fontSize: 21, height: 1.3, fontWeight: FontWeight.w700, color: VgmfColors.ink))),
      if (s.list("announcements").isNotEmpty) ...[
        const Section("Announcements"),
        for (final a in s.list("announcements").take(4)) Tile(kicker: str(a["category"]), title: str(a["title"]), subtitle: str(a["description"]), onTap: () => push(context, Reader(title: str(a["title"]), body: str(a["description"]), meta: day(a["date"])))),
      ],
      if (s.on("events") && s.list("events").isNotEmpty) ...[
        const Section("Upcoming events"),
        for (final e in s.list("events").take(3)) eventTile(context, e),
      ],
      if (s.on("shop") && s.list("books").isNotEmpty) ...[
        const Section("Publications"),
        for (final b in s.list("books").take(4)) bookTile(context, b),
      ],
      if (s.on("articles") && s.list("articles").isNotEmpty) ...[
        Section("Articles", action: () => push(context, const ArticlesPage())),
        for (final a in s.list("articles").take(4)) articleTile(context, a),
      ],
      if (s.on("notices") && s.list("notices").isNotEmpty) ...[
        const Section("Notice board"),
        for (final n in s.list("notices").take(4)) Tile(kicker: day(n["date"]), title: str(n["title"]), subtitle: str(n["description"]), onTap: () => push(context, Reader(title: str(n["title"]), body: str(n["description"]), meta: day(n["date"])))),
      ],
      if (s.on("clinics") && s.list("clinics").isNotEmpty) ...[
        const Section("Clinics"),
        for (final c in s.list("clinics").where((c) => c["hidden"] != true)) Tile(kicker: str(c["city"]), title: str(c["name"]), subtitle: [str(c["doctor"]), str(c["address"]), str(c["timings"])].where((x) => x.isNotEmpty).join("\n")),
      ],
      if (s.list("seminarReviews").isNotEmpty) ...[
        const Section("Seminar voices"),
        for (final r in s.list("seminarReviews").take(3)) Tile(kicker: "${"★" * ((r["rating"] as num?)?.toInt() ?? 5)} · ${str(r["event"])}", title: str(r["name"]), subtitle: str(r["text"])),
      ],
    ]);
  }
}

Widget eventTile(BuildContext context, Map<String, dynamic> e) => Tile(
      kicker: [str(e["mode"]), day(e["startDate"])].where((x) => x.isNotEmpty).join(" · "),
      title: str(e["name"]),
      subtitle: str(e["shortDescription"], str(e["venue"])),
      image: str(e["bannerUrl"]),
      onTap: () => push(context, EventPage(e)),
    );

Widget articleTile(BuildContext context, Map<String, dynamic> a) => Tile(
      kicker: str(a["category"]),
      title: str(a["title"]),
      subtitle: str(a["excerpt"]),
      onTap: () => push(context, Reader(title: str(a["title"]), body: plain(str(a["content"], str(a["excerpt"]))), meta: [str(a["author"]), day(a["date"])].where((x) => x.isNotEmpty).join(" · "))),
    );

Widget bookTile(BuildContext context, Map<String, dynamic> b) {
  final media = (b["media"] as List?) ?? [];
  final cover = media.isNotEmpty && media.first is Map ? str((media.first as Map)["url"], str((media.first as Map)["src"])) : str(b["coverImage"]);
  return Tile(
    kicker: str(b["category"]),
    title: str(b["title"]),
    subtitle: "${str(b["author"])}\n${money(b["price"])} · ${str(b["stockStatus"]) == "out_of_stock" ? "Out of stock" : "In stock"}",
    image: cover,
    onTap: () => push(context, BookPage(b)),
  );
}

class Reader extends StatelessWidget {
  const Reader({super.key, required this.title, required this.body, this.meta = ""});
  final String title, body, meta;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis)),
        body: ListView(padding: const EdgeInsets.all(18), children: [
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: VgmfColors.ink)),
          if (meta.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(meta, style: const TextStyle(color: VgmfColors.muted))),
          const SizedBox(height: 14),
          SelectableText(body, style: const TextStyle(fontSize: 16, height: 1.6)),
        ]),
      );
}

class EventsTab extends StatelessWidget {
  const EventsTab({super.key});
  @override
  Widget build(BuildContext context) {
    final events = Store.i.list("events");
    return refreshable([
      const Section("Events & seminars"),
      if (events.isEmpty) const Text("No events are published right now.", style: TextStyle(color: VgmfColors.muted)),
      for (final e in events) eventTile(context, e),
    ]);
  }
}

class EventPage extends StatelessWidget {
  const EventPage(this.e, {super.key});
  final Map<String, dynamic> e;
  @override
  Widget build(BuildContext context) {
    final url = str(e["registrationUrl"], str(e["sourceUrl"]));
    final banner = imageProvider(str(e["bannerUrl"]));
    final speakers = ((e["speakers"] as List?) ?? []).whereType<Map>().toList();
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: const Text("Event")),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        if (banner != null) ClipRRect(borderRadius: BorderRadius.circular(14), child: Image(image: banner)),
        const SizedBox(height: 12),
        Text(str(e["name"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: VgmfColors.ink)),
        const SizedBox(height: 6),
        Text([day(e["startDate"]), if (str(e["endDate"]).isNotEmpty && day(e["endDate"]) != day(e["startDate"])) "to ${day(e["endDate"])}", str(e["venue"]), str(e["mode"])].where((x) => x.isNotEmpty).join(" · "), style: const TextStyle(color: VgmfColors.muted)),
        if ((e["fee"] as num?) != null && (e["fee"] as num) > 0) Padding(padding: const EdgeInsets.only(top: 6), child: Text("Fee ${money(e["fee"])}", style: const TextStyle(fontWeight: FontWeight.w700, color: VgmfColors.burgundy))),
        const SizedBox(height: 12),
        Text(plain(str(e["description"], str(e["shortDescription"]))), style: const TextStyle(fontSize: 15.5, height: 1.55)),
        if (((e["schedule"] as List?) ?? []).isNotEmpty) ...[
          const Section("Schedule"),
          for (final it in ((e["schedule"] as List?) ?? []).whereType<Map>()) Tile(kicker: day(it["time"]), title: str(it["title"]), subtitle: str(it["speaker"], str(it["description"]))),
        ],
        if (speakers.isNotEmpty) ...[const Section("Speakers"), for (final sp in speakers) Tile(title: str(sp["name"]), subtitle: str(sp["title"], str(sp["designation"])))],
        if (str(e["termsConditions"]).isNotEmpty) ...[const Section("Terms"), Text(plain(str(e["termsConditions"])))],
        if (url.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 18), child: FilledButton(onPressed: () => openExternal(url), child: const Text("Register"))),
      ]),
    );
  }
}

class ShopTab extends StatelessWidget {
  const ShopTab({super.key});
  @override
  Widget build(BuildContext context) {
    final books = Store.i.list("books").where((b) => b["active"] != false).toList();
    return refreshable([
      const Section("Shop"),
      if (books.isEmpty) const Text("No publications are listed right now.", style: TextStyle(color: VgmfColors.muted)),
      for (final b in books) bookTile(context, b),
    ]);
  }
}

class BookPage extends StatelessWidget {
  const BookPage(this.b, {super.key});
  final Map<String, dynamic> b;
  @override
  Widget build(BuildContext context) {
    final out = str(b["stockStatus"]) == "out_of_stock";
    final specs = ((b["specifications"] as List?) ?? []).whereType<Map>().toList();
    final reviews = Store.i.list("productReviews").where((r) => str(r["bookId"], str(r["productId"])) == str(b["id"])).toList();
    final facts = <(String, String)>[("SKU", str(b["sku"])), ("Language", str(b["language"])), ("Pages", str(b["pages"])), ("Binding", str(b["binding"])), ("Edition", str(b["edition"])), ("Publisher", str(b["publisher"], "Vaidya Gogate Memorial Foundation"))].where((f) => f.$2.isNotEmpty).toList();
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text(str(b["title"]))),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        Text(str(b["title"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: VgmfColors.ink)),
        Text(str(b["author"]), style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 10),
        Row(children: [
          Text(money(b["price"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: VgmfColors.burgundy)),
          if ((b["originalPrice"] as num? ?? 0) > (b["price"] as num? ?? 0)) Padding(padding: const EdgeInsets.only(left: 8), child: Text(money(b["originalPrice"]), style: const TextStyle(decoration: TextDecoration.lineThrough, color: VgmfColors.muted))),
        ]),
        Text(out ? "Out of stock" : (b["preorder"] == true ? "Pre-order" : "In stock"), style: TextStyle(color: out ? VgmfColors.burgundy : const Color(0xFF1F6B3A), fontWeight: FontWeight.w600)),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: out
              ? null
              : () {
                  Store.i.setQty(str(b["id"]), (Store.i.bag[str(b["id"])] ?? 0) + 1);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: const Text("Added to bag"), action: SnackBarAction(label: "View bag", onPressed: () => push(context, const BagPage()))));
                },
          child: const Text("Add to bag"),
        ),
        const SizedBox(height: 16),
        Text(plain(str(b["description"])), style: const TextStyle(fontSize: 15.5, height: 1.55)),
        if (facts.isNotEmpty || specs.isNotEmpty) const Section("Details"),
        for (final f in facts) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Text("${f.$1}: ${f.$2}")),
        for (final sp in specs) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Text("${str(sp["label"])}: ${str(sp["value"])}")),
        if (reviews.isNotEmpty) ...[const Section("Reviews"), for (final r in reviews) Tile(kicker: "★" * ((r["rating"] as num?)?.toInt() ?? 5), title: str(r["name"]), subtitle: str(r["text"], str(r["comment"])))],
      ]),
    );
  }
}

class BagPage extends StatefulWidget {
  const BagPage({super.key});
  @override
  State<BagPage> createState() => _BagPageState();
}

class _BagPageState extends State<BagPage> {
  final razorpay = Razorpay();
  final name = TextEditingController(), phone = TextEditingController(text: "+91"), line1 = TextEditingController(), landmark = TextEditingController(), city = TextEditingController(), state = TextEditingController(), pincode = TextEditingController();
  var pickup = false, busy = false;
  String note = "";
  Map<String, dynamic>? pending;

  @override
  void initState() {
    super.initState();
    name.text = Store.i.api.session?.name ?? "";
    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) async {
      final data = await Store.i.post("/api/mobile/checkout", {"action": "verify", "orderId": str(pending?["id"]), "paymentId": r.paymentId, "razorpayOrderId": r.orderId, "signature": r.signature});
      if (!mounted) return;
      if (data["ok"] == true) {
        for (final id in [...Store.i.bag.keys]) {
          await Store.i.setQty(id, 0);
        }
        await Store.i.loadOrders();
        setState(() => note = "Payment received. Order ${str(pending?["id"])} is placed — track it under Orders.");
      } else {
        setState(() => note = str(data["error"], "We could not confirm the payment."));
      }
      setState(() => busy = false);
    });
    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) => setState(() {
          busy = false;
          note = "Payment was not completed. ${r.message ?? ""}";
        }));
  }

  @override
  void dispose() {
    razorpay.clear();
    super.dispose();
  }

  Future<void> checkout() async {
    final s = Store.i;
    if (s.api.session == null) {
      push(context, const SignInPage());
      return;
    }
    setState(() {
      busy = true;
      note = "";
    });
    final data = await s.post("/api/mobile/checkout", {
      "items": [for (final e in s.bag.entries) {"id": e.key, "quantity": e.value}],
      "name": name.text.trim(),
      "phone": phone.text.trim(),
      "pickup": pickup,
      "line1": line1.text.trim(),
      "landmark": landmark.text.trim(),
      "city": city.text.trim(),
      "state": state.text.trim(),
      "pincode": pincode.text.trim(),
      "countryCode": "IN",
      "country": "India",
    });
    if (data["ok"] != true) {
      setState(() {
        busy = false;
        note = str(data["error"], "Could not start checkout.");
      });
      return;
    }
    pending = Map<String, dynamic>.from(data["order"] as Map);
    razorpay.open({
      "key": data["keyId"],
      "amount": (((data["amount"] as num?) ?? 0) * 100).round(),
      "currency": "INR",
      "order_id": data["razorpayOrderId"],
      "name": "Vaidya Gogate Memorial Foundation",
      "description": "Order ${str(pending?["id"])}",
      "prefill": {"email": s.api.session?.email ?? "", "contact": phone.text.trim(), "name": name.text.trim()},
      "theme": {"color": "#8F2D2D"},
    });
  }

  Widget field(String label, TextEditingController c, [TextInputType? type]) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(controller: c, keyboardType: type, decoration: InputDecoration(labelText: label, border: const OutlineInputBorder(), filled: true, fillColor: Colors.white)),
      );

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final s = Store.i;
        final pickupOn = s.map("orderSettings")["pickupEnabled"] != false;
        return Scaffold(
          appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text("Bag (${s.bagCount})")),
          body: ListView(padding: const EdgeInsets.all(16), children: [
            if (note.isNotEmpty) Card(color: VgmfColors.paper, child: Padding(padding: const EdgeInsets.all(12), child: Text(note))),
            if (s.bag.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Your bag is empty.", textAlign: TextAlign.center)),
            for (final e in s.bag.entries)
              Tile(
                title: str(s.book(e.key)?["title"], "Publication"),
                subtitle: "${money(s.book(e.key)?["price"])} each",
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(onPressed: () => s.setQty(e.key, e.value - 1), icon: const Icon(Icons.remove_circle_outline)),
                  Text("${e.value}"),
                  IconButton(onPressed: () => s.setQty(e.key, e.value + 1), icon: const Icon(Icons.add_circle_outline)),
                ]),
              ),
            if (s.bag.isNotEmpty) ...[
              Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text("Items ${money(s.bagTotal)} · delivery charge is added at payment", style: const TextStyle(fontWeight: FontWeight.w700))),
              if (pickupOn)
                SegmentedButton<bool>(
                  segments: const [ButtonSegment(value: false, label: Text("Home delivery")), ButtonSegment(value: true, label: Text("Store pickup"))],
                  selected: {pickup},
                  onSelectionChanged: (v) => setState(() => pickup = v.first),
                ),
              const SizedBox(height: 12),
              field("Full name", name),
              field("Phone with country code", phone, TextInputType.phone),
              if (!pickup) ...[
                field("Address", line1),
                field("Landmark (optional)", landmark),
                field("City", city),
                field("State", state),
                field("Pincode", pincode, TextInputType.number),
              ],
              FilledButton(onPressed: busy ? null : checkout, child: Text(busy ? "Please wait…" : (s.api.session == null ? "Sign in to pay" : "Pay with Razorpay"))),
            ],
          ]),
        );
      },
    );
  }
}

const _steps = ["Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered"];

int stepOf(String status) {
  switch (status) {
    case "Packed":
    case "Ready to Ship":
    case "To Ship":
      return 1;
    case "Shipped":
      return 2;
    case "Out for Delivery":
      return 3;
    case "Delivered":
      return 4;
    default:
      return 0;
  }
}

class OrdersTab extends StatelessWidget {
  const OrdersTab({super.key});
  @override
  Widget build(BuildContext context) {
    final s = Store.i;
    if (s.api.session == null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text("Sign in to see and track your orders.", textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => push(context, const SignInPage()), child: const Text("Sign in")),
      ])));
    }
    return RefreshIndicator(
      onRefresh: s.loadOrders,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        const Section("My orders"),
        if (s.orders.isEmpty) const Text("No orders yet.", style: TextStyle(color: VgmfColors.muted)),
        for (final o in s.orders.whereType<Map>()) Tile(kicker: day(o["date"]), title: "Order ${str(o["id"])}", subtitle: "${str(o["status"])} · ${money(o["total"])}", onTap: () => push(context, OrderPage(Map<String, dynamic>.from(o)))),
      ]),
    );
  }
}

class OrderPage extends StatelessWidget {
  const OrderPage(this.o, {super.key});
  final Map<String, dynamic> o;
  @override
  Widget build(BuildContext context) {
    final status = str(o["status"]);
    final pickup = str(o["deliveryMode"]) == "store_pickup";
    final steps = pickup ? ["Ordered", "Ready for pickup", "Picked up"] : _steps;
    final at = pickup ? (status == "Delivered" ? 2 : (status == "Packed" || status == "Ready to Ship" ? 1 : 0)) : stepOf(status);
    final history = ((o["history"] as List?) ?? []).whereType<Map>().toList().reversed.toList();
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text("Order ${str(o["id"])}")),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        Text(status == "Cancelled" ? "Cancelled" : steps[at], style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: VgmfColors.ink)),
        if (str(o["courierName"]).isNotEmpty) Text("${str(o["courierName"])} · AWB ${str(o["trackingId"])}", style: const TextStyle(color: VgmfColors.muted)),
        if (str(o["eta"]).isNotEmpty) Text("Expected ${day(o["eta"])}", style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 16),
        for (var i = 0; i < steps.length; i++)
          Row(children: [
            Column(children: [
              Icon(i <= at ? Icons.check_circle : Icons.radio_button_unchecked, color: i <= at ? const Color(0xFF1F6B3A) : VgmfColors.border),
              if (i < steps.length - 1) Container(width: 3, height: 28, color: i < at ? const Color(0xFF1F6B3A) : VgmfColors.border),
            ]),
            const SizedBox(width: 10),
            Expanded(child: Padding(padding: const EdgeInsets.only(bottom: 26), child: Text(steps[i], style: TextStyle(fontWeight: i == at ? FontWeight.w800 : FontWeight.w500)))),
          ]),
        const Section("Items"),
        for (final it in ((o["items"] as List?) ?? []).whereType<Map>()) Text("${str(it["title"])} × ${str(it["quantity"])} — ${money((it["price"] as num? ?? 0) * (it["quantity"] as num? ?? 1))}"),
        const SizedBox(height: 8),
        Text("Delivery ${money(o["shipping"])} · Total ${money(o["total"])} · ${str(o["paymentStatus"])}", style: const TextStyle(fontWeight: FontWeight.w700)),
        if (history.isNotEmpty) ...[const Section("Updates"), for (final h in history) Tile(kicker: day(h["at"]), title: str(h["status"]), subtitle: str(h["note"]))],
      ]),
    );
  }
}

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});
  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final email = TextEditingController(), code = TextEditingController(), name = TextEditingController();
  var sent = false, busy = false;
  String note = "";

  Future<void> go() async {
    setState(() => busy = true);
    try {
      if (!sent) {
        await Store.i.api.sendOtp(email.text.trim(), name.text.trim());
        setState(() {
          sent = true;
          note = "We emailed you a 6-digit code.";
        });
      } else {
        await Store.i.api.verifyOtp(email.text.trim(), code.text.trim(), name.text.trim());
        await Store.i.loadOrders();
        if (mounted) Navigator.pop(context);
      }
    } catch (err) {
      setState(() => note = "$err".replaceFirst("Exception: ", ""));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: const Text("Sign in")),
        body: ListView(padding: const EdgeInsets.all(18), children: [
          const Text("Use the email on your Foundation account. Your website orders show here too.", style: TextStyle(color: VgmfColors.muted)),
          const SizedBox(height: 14),
          TextField(controller: name, decoration: const InputDecoration(labelText: "Name", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: "Email", border: OutlineInputBorder())),
          if (sent) ...[const SizedBox(height: 10), TextField(controller: code, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "6-digit code", border: OutlineInputBorder()))],
          const SizedBox(height: 14),
          FilledButton(onPressed: busy ? null : go, child: Text(sent ? "Verify and sign in" : "Email me a code")),
          if (note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(note)),
        ]),
      );
}

class ArticlesPage extends StatefulWidget {
  const ArticlesPage({super.key});
  @override
  State<ArticlesPage> createState() => _ArticlesPageState();
}

class _ArticlesPageState extends State<ArticlesPage> {
  var query = "", category = "";
  @override
  Widget build(BuildContext context) {
    final all = Store.i.list("articles");
    final cats = {for (final a in all) str(a["category"])}.where((c) => c.isNotEmpty).toList()..sort();
    final q = query.toLowerCase();
    final shown = all.where((a) => (category.isEmpty || str(a["category"]) == category) && (q.isEmpty || "${str(a["title"])} ${str(a["excerpt"])} ${str(a["author"])}".toLowerCase().contains(q))).toList();
    return Scaffold(
      appBar: Navigator.of(context).canPop() ? AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text("Articles (${shown.length})")) : null,
      body: ListView(padding: const EdgeInsets.all(16), children: [
        TextField(onChanged: (v) => setState(() => query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Search articles", border: OutlineInputBorder(), filled: true, fillColor: Colors.white)),
        const SizedBox(height: 10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          ChoiceChip(label: const Text("All"), selected: category.isEmpty, onSelected: (_) => setState(() => category = "")),
          for (final c in cats) ChoiceChip(label: Text(c), selected: category == c, onSelected: (_) => setState(() => category = c)),
        ]),
        const SizedBox(height: 8),
        for (final a in shown) articleTile(context, a),
      ]),
    );
  }
}

/// Renders an About sub-page (foundation, history, trustees, legacy…) from whatever text fields it publishes.
String aboutText(dynamic node, [int depth = 0]) {
  if (depth > 3) return "";
  if (node is String) return plain(node);
  if (node is List) return node.map((e) => aboutText(e, depth + 1)).where((t) => t.isNotEmpty).join("\n\n");
  if (node is Map) {
    final parts = <String>[];
    node.forEach((k, v) {
      if (RegExp(r"(^id$|image|portrait|photo|url|href|src|slug|revision)", caseSensitive: false).hasMatch("$k")) return;
      final t = aboutText(v, depth + 1);
      if (t.isNotEmpty) parts.add(t);
    });
    return parts.join("\n\n");
  }
  return "";
}

class ListPage extends StatelessWidget {
  const ListPage(this.title, this.children, {super.key});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text(title)),
        body: ListView(padding: const EdgeInsets.all(16), children: children.isEmpty ? [const Text("Nothing is published here yet.")] : children),
      );
}

class CertificatePage extends StatefulWidget {
  const CertificatePage({super.key});
  @override
  State<CertificatePage> createState() => _CertificatePageState();
}

class _CertificatePageState extends State<CertificatePage> {
  final number = TextEditingController();
  String result = "";
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: const Text("Verify a certificate")),
        body: ListView(padding: const EdgeInsets.all(18), children: [
          TextField(controller: number, decoration: const InputDecoration(labelText: "Certificate or ticket number", border: OutlineInputBorder())),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              final r = await Store.i.api.verifyCertificate(number.text.trim());
              final c = r["certificate"] is Map ? r["certificate"] as Map : {};
              setState(() => result = r["verified"] == true || r["valid"] == true ? "Verified · ${str(c["name"], str(c["holderName"]))} · ${str(c["event"])} ${str(c["sourceLabel"], str(r["sourceLabel"]))}" : str(r["error"], "No issued certificate matches that number."));
            },
            child: const Text("Verify"),
          ),
          if (result.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 14), child: Text(result, style: const TextStyle(fontSize: 16))),
        ]),
      );
}

class MoreTab extends StatelessWidget {
  const MoreTab({super.key});
  @override
  Widget build(BuildContext context) {
    final s = Store.i;
    final about = s.map("about");
    final policies = s.map("policies");
    final session = s.api.session;
    Widget link(String label, IconData icon, VoidCallback onTap) => Card(child: ListTile(leading: Icon(icon, color: VgmfColors.burgundy), title: Text(label), trailing: const Icon(Icons.chevron_right), onTap: onTap));
    return refreshable([
      Card(child: ListTile(
        leading: const Icon(Icons.person_outline, color: VgmfColors.burgundy),
        title: Text(session == null ? "Sign in" : (session.name.isEmpty ? session.email : session.name)),
        subtitle: session == null ? null : Text(session.email),
        trailing: session == null ? const Icon(Icons.chevron_right) : TextButton(onPressed: () async {
          await s.api.saveSession(null);
          s.orders = [];
          await s.refresh();
        }, child: const Text("Sign out")),
        onTap: session == null ? () => push(context, const SignInPage()) : null,
      )),
      if (s.on("about"))
        link("About the Foundation", Icons.info_outline, () => push(context, ListPage(str(about["title"], "About"), [
              Tile(title: str(about["title"], "About"), subtitle: plain(str(about["intro"])), onTap: () => push(context, Reader(title: str(about["title"], "About"), body: plain(str(about["intro"]))))),
              for (final key in ["foundation", "history", "trustees", "legacy", "anagha", "awards", "scholarship"])
                if (about[key] is Map)
                  Tile(
                    title: str((about[key] as Map)["title"], key),
                    subtitle: plain(str((about[key] as Map)["intro"])),
                    image: str((about[key] as Map)["portrait"]),
                    onTap: () => push(context, Reader(title: str((about[key] as Map)["title"], key), body: aboutText(Map.from(about[key] as Map)..remove("title")))),
                  ),
            ]))),
      link("My orders & tracking", Icons.local_shipping_outlined, () => push(context, const Scaffold(body: SafeArea(child: OrdersTab())))),
      link("Support tickets", Icons.support_agent, () => push(context, s.api.session == null ? const SignInPage() : const TicketsPage())),
      if (s.on("clinics")) link("Clinics", Icons.local_hospital_outlined, () => push(context, ListPage("Clinics", [for (final c in s.list("clinics").where((c) => c["hidden"] != true)) Tile(kicker: str(c["city"]), title: str(c["name"]), subtitle: [str(c["doctor"]), str(c["address"]), str(c["timings"]), str(c["phone"])].where((x) => x.isNotEmpty).join("\n"))]))),
      if (s.on("notices")) link("Notice board", Icons.campaign_outlined, () => push(context, ListPage("Notice board", [for (final n in s.list("notices")) Tile(kicker: day(n["date"]), title: str(n["title"]), subtitle: str(n["description"]))]))),
      if (s.on("videos")) link("Videos", Icons.play_circle_outline, () => push(context, ListPage("Videos", [for (final v in s.list("videos")) Tile(title: str(v["title"]), subtitle: str(v["description"]), onTap: () => openExternal(str(v["youtubeUrl"], str(v["src"]))))]))),
      if (s.on("gallery")) link("Gallery", Icons.photo_library_outlined, () => push(context, ListPage("Gallery", [for (final g in s.list("gallery")) if (imageProvider(str(g["src"])) != null) GestureDetector(onTap: () => showFlyer(context, {"image": g["src"]}), child: Card(clipBehavior: Clip.antiAlias, child: Image(image: imageProvider(str(g["src"]))!)))]))),
      if (s.on("certificates")) link("Verify a certificate", Icons.verified_outlined, () => push(context, const CertificatePage())),
      link("FAQ", Icons.help_outline, () => push(context, ListPage("FAQ", [for (final f in s.list("faqs")) Tile(title: str(f["question"], str(f["q"])), subtitle: str(f["answer"], str(f["a"])))]))),
      for (final p in [("privacy", "Privacy policy"), ("terms", "Terms"), ("shipping", "Shipping policy"), ("returns", "Return policy"), ("refund", "Refund policy"), ("cancellation", "Cancellation policy")])
        if (policies[p.$1] != null) link(p.$2, Icons.policy_outlined, () {
          final v = policies[p.$1];
          push(context, Reader(title: p.$2, body: plain(v is Map ? str(v["body"], str(v["content"])) : str(v))));
        }),
      Padding(padding: const EdgeInsets.only(top: 16), child: Text("${str(s.map("site")["address"])}\n${str(s.map("site")["email"])} · ${str(s.map("site")["phone"])}", textAlign: TextAlign.center, style: const TextStyle(color: VgmfColors.muted))),
    ]);
  }
}

String errText(Object e) => "$e".replaceFirst("Exception: ", "");

class TicketsPage extends StatefulWidget {
  const TicketsPage({super.key});
  @override
  State<TicketsPage> createState() => _TicketsPageState();
}

class _TicketsPageState extends State<TicketsPage> {
  List<Map<String, dynamic>> tickets = [];
  var loading = true;
  var error = "";

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final list = await Store.i.api.tickets();
      if (!mounted) return;
      setState(() {
        tickets = list.whereType<Map>().map((t) => Map<String, dynamic>.from(t)).toList();
        loading = false;
        error = "";
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = errText(e);
        });
      }
    }
  }

  Future<void> create() async {
    final subject = TextEditingController(), body = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("New support ticket"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: subject, decoration: const InputDecoration(labelText: "Subject")),
          TextField(controller: body, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: "How can we help?")),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text("Submit")),
        ],
      ),
    );
    final session = Store.i.api.session;
    if (ok != true || session == null || subject.text.trim().isEmpty || body.text.trim().isEmpty) return;
    try {
      await Store.i.api.createTicket(name: session.name.isEmpty ? session.email : session.name, email: session.email, subject: subject.text.trim(), body: body.text.trim());
      await load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errText(e))));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: const Text("Support tickets")),
        floatingActionButton: FloatingActionButton.extended(onPressed: create, icon: const Icon(Icons.add), label: const Text("New ticket")),
        body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (loading) const Center(child: CircularProgressIndicator()),
            if (error.isNotEmpty) Text(error, style: const TextStyle(color: VgmfColors.burgundy)),
            if (!loading && tickets.isEmpty && error.isEmpty) const Text("No tickets yet. Tap New ticket to ask the Foundation team.", style: TextStyle(color: VgmfColors.muted)),
            for (final t in tickets)
              Tile(
                kicker: "${str(t["status"])} · ${day(t["updatedAt"] ?? t["createdAt"])}",
                title: "#${str(t["id"])} — ${str(t["subject"])}",
                subtitle: "${((t["responses"] as List?) ?? []).length} replies · tap to open",
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TicketThreadPage(t)));
                  load();
                },
              ),
          ]),
        ),
      );
}

class TicketThreadPage extends StatefulWidget {
  const TicketThreadPage(this.ticket, {super.key});
  final Map<String, dynamic> ticket;
  @override
  State<TicketThreadPage> createState() => _TicketThreadPageState();
}

class _TicketThreadPageState extends State<TicketThreadPage> {
  late Map<String, dynamic> t = widget.ticket;
  final reply = TextEditingController();
  var sending = false;

  Future<void> reload() async {
    final list = await Store.i.api.tickets();
    final fresh = list.whereType<Map>().where((x) => str(x["id"]) == str(t["id"])).toList();
    if (fresh.isNotEmpty && mounted) setState(() => t = Map<String, dynamic>.from(fresh.first));
  }

  Future<void> send() async {
    final text = reply.text.trim();
    if (text.isEmpty) return;
    setState(() => sending = true);
    try {
      final next = await Store.i.api.replyTicket(str(t["id"]), text);
      if (!mounted) return;
      reply.clear();
      setState(() => t = next);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errText(e))));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Widget bubble(String from, dynamic at, String text, bool mine) => Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.all(12),
          constraints: const BoxConstraints(maxWidth: 320),
          decoration: BoxDecoration(
            color: mine ? const Color(0xFFEAF1FB) : const Color(0xFFFFF8EC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE6DCC8)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("$from · ${day(at)}", style: const TextStyle(fontSize: 11, color: VgmfColors.muted)),
            const SizedBox(height: 4),
            Text(text),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final name = str(t["name"]);
    final responses = ((t["responses"] as List?) ?? []).whereType<Map>().toList();
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: VgmfColors.ink, title: Text("Ticket #${str(t["id"])}")),
      body: Column(children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Text(str(t["subject"]), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              Text("Status: ${str(t["status"])}", style: const TextStyle(color: VgmfColors.muted)),
              const SizedBox(height: 10),
              bubble("You", t["createdAt"], str(t["body"]), true),
              for (final r in responses) bubble(str(r["from"]) == name ? "You" : str(r["from"]), r["at"], str(r["text"]), str(r["from"]) == name),
            ]),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
            child: Row(children: [
              Expanded(child: TextField(controller: reply, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: "Write a reply", border: OutlineInputBorder(), filled: true, fillColor: Colors.white))),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: sending ? null : send, icon: const Icon(Icons.send), tooltip: "Send"),
            ]),
          ),
        ),
      ]),
    );
  }
}
