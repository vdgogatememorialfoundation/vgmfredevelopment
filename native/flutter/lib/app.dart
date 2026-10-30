import "dart:async";

import "package:flutter/material.dart";
import "package:url_launcher/url_launcher.dart";

import "api.dart";
import "flavor.dart";
import "theme.dart";

class CartItem {
  const CartItem({required this.id, required this.title, required this.quantity, required this.price});
  final String id;
  final String title;
  final int quantity;
  final double price;
  CartItem bump() => CartItem(id: id, title: title, quantity: quantity + 1, price: price);
}

class VgmfShell extends StatefulWidget {
  const VgmfShell({super.key, required this.flavor});
  final Flavor flavor;

  @override
  State<VgmfShell> createState() => _VgmfShellState();
}

class _VgmfShellState extends State<VgmfShell> {
  final api = VgmfApi.instance;
  Map<String, dynamic>? feed;
  String error = "";
  String note = "";
  var loading = true;
  var tab = 0;
  String? stack;
  Map<String, dynamic>? selected;
  List<CartItem> cart = [];
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final otpCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final subjectCtrl = TextEditingController();
  final bodyCtrl = TextEditingController();
  final certCtrl = TextEditingController();
  var otpSent = false;
  String certResult = "";
  List<dynamic> tickets = [];
  List<dynamic> orders = [];
  Timer? _heroTimer;
  var heroPage = 0;
  final heroController = PageController();

  Flavor get flavor => widget.flavor;

  @override
  void initState() {
    super.initState();
    api.loadSession().then((_) => refresh());
    _heroTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      final flyers = list("flyers");
      if (!mounted || flyers.length < 2 || stack != null) return;
      heroPage = (heroPage + 1) % flyers.length;
      if (heroController.hasClients) {
        heroController.animateToPage(heroPage, duration: const Duration(milliseconds: 420), curve: Curves.easeOut);
      }
    });
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    heroController.dispose();
    nameCtrl.dispose();
    emailCtrl.dispose();
    otpCtrl.dispose();
    phoneCtrl.dispose();
    subjectCtrl.dispose();
    bodyCtrl.dispose();
    certCtrl.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    setState(() {
      error = "";
      loading = true;
    });
    try {
      final next = await api.fetchFeed();
      if (!mounted) return;
      setState(() {
        feed = next;
        loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        error = "$err";
        loading = false;
      });
    }
  }

  List<dynamic> list(String key) => (feed?[key] as List?) ?? const [];

  Map<String, dynamic> map(String key) => feed?[key] is Map ? Map<String, dynamic>.from(feed![key] as Map) : {};

  bool on(String id) => moduleOn(feed, id);

  List<({String id, String label, IconData icon})> get tabs => flavor.tabs.where((tab) => on(tab.id)).toList();

  String get appName {
    final apps = map("mobile")["apps"];
    final brand = apps is Map ? apps[flavor.id] : null;
    final branded = brand is Map ? str(brand["name"]) : "";
    return branded.isNotEmpty ? branded : str(map("site")["name"], flavor.displayName);
  }

  String? get logoUrl {
    final apps = map("mobile")["apps"];
    final brand = apps is Map ? apps[flavor.id] : null;
    final branded = brand is Map ? str(brand["logoUrl"]) : "";
    if (branded.isNotEmpty) return branded;
    final site = str(map("site")["logoUrl"]);
    return site.isEmpty ? null : site;
  }

  void open(String next, [Map<String, dynamic>? item]) {
    setState(() {
      stack = next;
      selected = item;
      note = "";
    });
  }

  void goTab(int index) {
    setState(() {
      tab = index;
      stack = null;
      selected = null;
    });
  }

  void addToCart(Map<String, dynamic> book) {
    final id = str(book["id"]);
    setState(() {
      final found = cart.indexWhere((item) => item.id == id);
      if (found >= 0) {
        cart = [...cart]..[found] = cart[found].bump();
      } else {
        cart = [...cart, CartItem(id: id, title: str(book["title"], "Book"), quantity: 1, price: (book["price"] as num?)?.toDouble() ?? 0)];
      }
      note = "Added to bag.";
    });
  }

  Future<void> launch(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String money(dynamic value) => "₹${((value as num?)?.toDouble() ?? 0).toStringAsFixed(0)}";

  @override
  Widget build(BuildContext context) {
    final visible = tabs;
    final current = visible.isEmpty ? "home" : visible[tab.clamp(0, visible.length - 1)].id;
    return Scaffold(
      backgroundColor: VgmfColors.cream,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              name: appName,
              logo: logoUrl,
              kicker: flavor.id == "customer" ? "Vaidya Gogate" : flavor.displayName,
              bagCount: cart.fold<int>(0, (sum, item) => sum + item.quantity),
              onBag: flavor.id == "customer" ? () => open("cart") : null,
              onRefresh: refresh,
            ),
            if (error.isNotEmpty) _Banner(text: error, tone: VgmfColors.burgundy),
            if (note.isNotEmpty) _Banner(text: note, tone: VgmfColors.ink),
            Expanded(
              child: RefreshIndicator(
                color: VgmfColors.gold,
                onRefresh: refresh,
                child: loading && feed == null
                    ? ListView(children: const [_Splash()])
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                        children: [
                          if (stack != null)
                            TextButton.icon(
                              onPressed: () => setState(() {
                                stack = null;
                                selected = null;
                              }),
                              icon: const Icon(Icons.arrow_back_rounded, size: 18),
                              label: const Text("Back"),
                            ),
                          ..._body(stack ?? current),
                          const SizedBox(height: 18),
                          Text(
                            feed?["publishedAt"] != null
                                ? "Updated ${str(feed!["publishedAt"])}"
                                : "Pull to refresh after Admin publishes the live site.",
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: VgmfColors.muted, fontSize: 12),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: visible.length < 2
          ? null
          : NavigationBar(
              selectedIndex: tab.clamp(0, visible.length - 1),
              onDestinationSelected: goTab,
              destinations: [
                for (final item in visible) NavigationDestination(icon: Icon(item.icon), label: item.label),
              ],
            ),
    );
  }

  List<Widget> _body(String screen) {
    if (screen == "home") return _home();
    if (screen == "events") return _cards("Events", list("events"), (item) => str(item["name"]), (item) => "${str(item["city"])} · ${str(item["startDate"]).padRight(10).substring(0, 10)}", "event");
    if (screen == "event" && selected != null) return _event(selected!);
    if (screen == "shop") return _shop();
    if (screen == "book" && selected != null) return _book(selected!);
    if (screen == "cart") return _cart();
    if (screen == "clinics") return _cards("Clinics", list("clinics"), (item) => str(item["name"]), (item) => str(item["city"]), "clinic");
    if (screen == "clinic" && selected != null) return _clinic(selected!);
    if (screen == "articles") return _cards("Articles", list("articles"), (item) => str(item["title"]), (item) => str(item["excerpt"]), "article");
    if (screen == "article" && selected != null) return _article(selected!);
    if (screen == "videos") return _videos();
    if (screen == "gallery") return _gallery();
    if (screen == "notices") return _cards("Notice board", list("notices"), (item) => str(item["title"]), (item) => str(item["description"]), null);
    if (screen == "about") return _about();
    if (screen == "support") return _support();
    if (screen == "certificates") return _certificates();
    if (screen == "account") return _account();
    return [Text("Unknown screen", style: Theme.of(context).textTheme.titleMedium)];
  }

  List<Widget> _home() {
    final site = map("site");
    final flags = map("flags");
    final flyers = list("flyers").where((item) => str(item["image"]).isNotEmpty).toList();
    final more = <(String, String)>[
      ("articles", "Articles"),
      ("videos", "Videos"),
      ("gallery", "Gallery"),
      ("notices", "Notices"),
      ("about", "About"),
      ("support", "Support"),
      ("certificates", "Certificates"),
    ].where((item) => on(item.$1)).toList();
    return [
      if (flyers.isNotEmpty) _Hero(items: flyers, controller: heroController, onPage: (page) => heroPage = page),
      const SizedBox(height: 12),
      Text(str(site["tagline"], "Preserving Ayurveda. Advancing knowledge."), style: const TextStyle(fontSize: 22, height: 1.3, fontWeight: FontWeight.w700, color: VgmfColors.ink)),
      if (flavor.id == "admin") ..._deskStats(),
      const SizedBox(height: 14),
      ...list("announcements").take(3).map((item) => _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(str(item["category"], "Notice").toUpperCase(), style: const TextStyle(color: VgmfColors.gold, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
            const SizedBox(height: 6),
            Text(str(item["title"]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: VgmfColors.ink)),
            if (str(item["description"]).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(str(item["description"]), style: const TextStyle(color: VgmfColors.muted))),
          ]))),
      if (more.isNotEmpty) ...[
        const Padding(padding: EdgeInsets.only(top: 8, bottom: 10), child: Text("Explore", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: VgmfColors.ink))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final item in more)
            ActionChip(
              label: Text(item.$2),
              backgroundColor: VgmfColors.paper,
              side: const BorderSide(color: VgmfColors.border),
              onPressed: () => open(item.$1),
            ),
        ]),
      ],
      if (on("events")) ...[
        const Padding(padding: EdgeInsets.only(top: 16, bottom: 8), child: Text("Events", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: VgmfColors.ink))),
        if (list("events").isEmpty) const _Empty("Events appear here after Admin publishes."),
        ...list("events").take(3).map((item) => _Card(onTap: () => open("event", Map<String, dynamic>.from(item as Map)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(item["name"]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text(str(item["shortDescription"], str(item["city"])), style: const TextStyle(color: VgmfColors.muted)),
            ]))),
      ],
      if (flags["supportUs"] == true)
        _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(str(flags["supportUsTitle"], "Support the Foundation"), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 6),
          Text(str(flags["supportUsText"]), style: const TextStyle(color: VgmfColors.muted)),
        ])),
    ];
  }

  List<Widget> _deskStats() {
    final tiles = [
      ("Events", list("events").length, Icons.event_rounded),
      ("Shop", list("books").length, Icons.menu_book_rounded),
      ("Clinics", list("clinics").length, Icons.local_hospital_rounded),
      ("Notices", list("notices").length, Icons.campaign_rounded),
    ];
    return [
      const Padding(padding: EdgeInsets.only(top: 16, bottom: 8), child: Text("Desk", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      Row(children: [
        for (final tile in tiles)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: VgmfColors.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(tile.$3, color: flavor.accent, size: 18),
                  const SizedBox(height: 8),
                  Text("${tile.$2}", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(tile.$1, style: const TextStyle(fontSize: 11, color: VgmfColors.muted)),
                ]),
              ),
            ),
          ),
      ]),
    ];
  }

  List<Widget> _cards(String title, List<dynamic> items, String Function(dynamic) heading, String Function(dynamic) subtitle, String? detail) {
    return [
      Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: VgmfColors.ink)),
      const SizedBox(height: 10),
      if (items.isEmpty) _Empty("$title appear here after Admin publishes."),
      ...items.map((item) => _Card(
            onTap: detail == null ? null : () => open(detail, Map<String, dynamic>.from(item as Map)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(heading(item), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              if (subtitle(item).trim().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle(item), style: const TextStyle(color: VgmfColors.muted))),
            ]),
          )),
    ];
  }

  List<Widget> _event(Map<String, dynamic> item) {
    final url = str(item["registrationUrl"]);
    return [
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(str(item["name"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(str(item["shortDescription"]), style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 10),
        Text(str(item["description"])),
        if (str(item["venue"]).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(str(item["venue"]), style: const TextStyle(color: VgmfColors.muted))),
        if (url.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 16), child: FilledButton(onPressed: () => launch(url), child: const Text("Register"))),
      ])),
    ];
  }

  List<Widget> _article(Map<String, dynamic> item) {
    return [
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(str(item["title"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text(str(item["author"]), style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 10),
        Text(str(item["content"], str(item["excerpt"]))),
      ])),
    ];
  }

  List<Widget> _shop() {
    final books = list("books");
    return [
      const Text("Publications", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      if (books.isEmpty) const _Empty("Books appear here after Admin publishes."),
      ...books.map((item) {
        final cover = imageProvider(str(item["coverImage"]));
        return _Card(
          onTap: () => open("book", Map<String, dynamic>.from(item as Map)),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: cover == null
                  ? Container(width: 64, height: 80, color: VgmfColors.paper, child: const Icon(Icons.menu_book_rounded, color: VgmfColors.gold))
                  : Image(image: cover, width: 64, height: 80, fit: BoxFit.cover),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(item["title"]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text(str(item["author"]), style: const TextStyle(color: VgmfColors.muted)),
              Text(money(item["price"]), style: const TextStyle(color: VgmfColors.burgundy, fontWeight: FontWeight.w800)),
            ])),
          ]),
        );
      }),
    ];
  }

  List<Widget> _book(Map<String, dynamic> item) {
    final cover = imageProvider(str(item["coverImage"]));
    return [
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (cover != null) ClipRRect(borderRadius: BorderRadius.circular(12), child: Image(image: cover, height: 180, width: double.infinity, fit: BoxFit.cover)),
        const SizedBox(height: 12),
        Text(str(item["title"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text(str(item["author"]), style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 8),
        Text(str(item["description"])),
        const SizedBox(height: 8),
        Text(money(item["price"]), style: const TextStyle(color: VgmfColors.burgundy, fontWeight: FontWeight.w800, fontSize: 18)),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => addToCart(item), child: const Text("Add to bag")),
      ])),
    ];
  }

  List<Widget> _cart() {
    final total = cart.fold<double>(0, (sum, item) => sum + item.price * item.quantity);
    return [
      const Text("Bag", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      if (cart.isEmpty) const Text("Your bag is empty.", style: TextStyle(color: VgmfColors.muted)),
      ...cart.map((item) => _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text("${item.quantity} × ${money(item.price)}", style: const TextStyle(color: VgmfColors.muted)),
          ]))),
      if (cart.isNotEmpty) Text("Total ${money(total)}", style: const TextStyle(color: VgmfColors.burgundy, fontWeight: FontWeight.w800, fontSize: 18)),
      if (cart.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: FilledButton(
            onPressed: () async {
              try {
                if (api.session == null) {
                  open("account");
                  setState(() => note = "Sign in with email OTP to place the order.");
                  return;
                }
                await api.placeOrder(items: [
                  for (final item in cart) {"id": item.id, "title": item.title, "quantity": item.quantity, "price": item.price},
                ], name: api.session?.name, email: api.session?.email);
                setState(() {
                  cart = [];
                  note = "Order placed. Status updates by email.";
                });
              } catch (err) {
                setState(() => note = "$err");
              }
            },
            child: const Text("Place order"),
          ),
        ),
    ];
  }

  List<Widget> _clinic(Map<String, dynamic> item) {
    final phone = str(item["phone"]);
    return [
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(str(item["name"]), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text(str(item["address"]), style: const TextStyle(color: VgmfColors.muted)),
        const SizedBox(height: 8),
        Text(str(item["about"])),
        if (phone.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: FilledButton(onPressed: () => launch("tel:$phone"), child: const Text("Call clinic"))),
      ])),
    ];
  }

  List<Widget> _videos() {
    final items = list("videos");
    return [
      const Text("Videos", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      if (items.isEmpty) const _Empty("Videos appear here after Admin publishes."),
      ...items.map((item) => _Card(
            onTap: () {
              final url = str(item["youtubeUrl"], str(item["src"]));
              if (url.isNotEmpty) launch(url);
            },
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(item["title"]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text(str(item["description"]), style: const TextStyle(color: VgmfColors.muted)),
            ]),
          )),
    ];
  }

  List<Widget> _gallery() {
    final items = list("gallery");
    return [
      const Text("Gallery", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      if (items.isEmpty) const _Empty("Gallery photos appear here after Admin publishes."),
      ...items.map((item) {
        final photo = imageProvider(str(item["src"]));
        return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (photo != null) ClipRRect(borderRadius: BorderRadius.circular(12), child: Image(image: photo, height: 160, width: double.infinity, fit: BoxFit.cover)),
          const SizedBox(height: 8),
          Text(str(item["title"]), style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(str(item["caption"]), style: const TextStyle(color: VgmfColors.muted)),
        ]));
      }),
    ];
  }

  List<Widget> _about() {
    final about = map("about");
    final sections = (about["sections"] as List?) ?? const [];
    return [
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(str(about["title"], "About the Foundation"), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(str(about["intro"])),
        ...sections.map((section) => Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(str(section["title"]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 6),
                Text(str(section["body"])),
              ]),
            )),
        if (str(map("site")["address"]).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 16), child: Text(str(map("site")["address"]), style: const TextStyle(color: VgmfColors.muted))),
      ])),
    ];
  }

  List<Widget> _support() {
    return [
      const Text("Support ticket", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      _Field(label: "Your name", controller: nameCtrl),
      _Field(label: "Email", controller: emailCtrl, keyboard: TextInputType.emailAddress),
      _Field(label: "Phone (optional)", controller: phoneCtrl, keyboard: TextInputType.phone),
      _Field(label: "Subject", controller: subjectCtrl),
      _Field(label: "Message", controller: bodyCtrl, maxLines: 4),
      FilledButton(
        onPressed: () async {
          try {
            await api.createTicket(
              name: nameCtrl.text,
              email: emailCtrl.text.isEmpty ? (api.session?.email ?? "") : emailCtrl.text,
              phone: phoneCtrl.text,
              subject: subjectCtrl.text,
              body: bodyCtrl.text,
            );
            subjectCtrl.clear();
            bodyCtrl.clear();
            setState(() => note = "Ticket opened. We will email updates.");
          } catch (err) {
            setState(() => note = "$err");
          }
        },
        child: const Text("Send ticket"),
      ),
      if (str(map("site")["email"]).isNotEmpty)
        TextButton(onPressed: () => launch("mailto:${str(map("site")["email"])}"), child: Text(str(map("site")["email"]))),
    ];
  }

  List<Widget> _certificates() {
    return [
      const Text("Certificate verification", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      _Field(label: "Certificate number", controller: certCtrl),
      FilledButton(
        onPressed: () async {
          final result = await api.verifyCertificate(certCtrl.text);
          setState(() {
            if (result["verified"] == true) {
              final certificate = result["certificate"] is Map ? result["certificate"] as Map : {};
              certResult = "Verified${result["sourceLabel"] != null ? " (${result["sourceLabel"]})" : ""}. ${str(certificate["holderName"] ?? certificate["name"])}";
            } else {
              certResult = str(result["error"], "This certificate could not be verified.");
            }
          });
        },
        child: const Text("Verify"),
      ),
      if (certResult.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(certResult)),
    ];
  }

  List<Widget> _account() {
    final session = api.session;
    if (session != null) {
      return [
        const Text("Signed in", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(session.name.isEmpty ? session.email : session.name, style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () async {
            await api.saveSession(null);
            setState(() {
              otpSent = false;
              note = "Signed out.";
            });
          },
          child: const Text("Sign out"),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () async {
            try {
              final nextTickets = await api.tickets();
              final nextOrders = await api.orders();
              setState(() {
                tickets = nextTickets;
                orders = nextOrders;
              });
            } catch (err) {
              setState(() => note = "$err");
            }
          },
          child: const Text("Refresh tickets & orders"),
        ),
        ...tickets.map((item) => _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(item["subject"]), style: const TextStyle(fontWeight: FontWeight.w700)),
              Text("${str(item["id"])} · ${str(item["status"])}", style: const TextStyle(color: VgmfColors.muted)),
            ]))),
        ...orders.map((item) => _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("Order ${str(item["id"])}", style: const TextStyle(fontWeight: FontWeight.w700)),
              Text("${str(item["status"])} · ${money(item["total"])}", style: const TextStyle(color: VgmfColors.muted)),
            ]))),
      ];
    }
    return [
      const Text("Email sign-in", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      const Text("A 6-digit code is sent to your email.", style: TextStyle(color: VgmfColors.muted)),
      const SizedBox(height: 12),
      _Field(label: "Name", controller: nameCtrl),
      _Field(label: "Email", controller: emailCtrl, keyboard: TextInputType.emailAddress),
      if (otpSent) _Field(label: "Email code", controller: otpCtrl, keyboard: TextInputType.number),
      FilledButton(
        onPressed: () async {
          try {
            if (!otpSent) {
              await api.sendOtp(emailCtrl.text, nameCtrl.text);
              setState(() {
                otpSent = true;
                note = "Check your email for the 6-digit code.";
              });
              return;
            }
            await api.verifyOtp(emailCtrl.text, otpCtrl.text, nameCtrl.text);
            setState(() => note = "Signed in.");
          } catch (err) {
            setState(() => note = "$err");
          }
        },
        child: Text(otpSent ? "Verify email code" : "Send email code"),
      ),
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.logo, required this.kicker, required this.bagCount, required this.onRefresh, this.onBag});
  final String name;
  final String? logo;
  final String kicker;
  final int bagCount;
  final VoidCallback onRefresh;
  final VoidCallback? onBag;

  @override
  Widget build(BuildContext context) {
    final mark = imageProvider(logo);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
      child: Row(children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: VgmfColors.paper,
          backgroundImage: mark,
          child: mark == null ? Image.asset("assets/mark.png", width: 28, height: 28) : null,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(kicker.toUpperCase(), style: const TextStyle(color: VgmfColors.gold, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: VgmfColors.ink)),
          ]),
        ),
        if (onBag != null)
          TextButton(
            onPressed: onBag,
            child: Text("Bag $bagCount", style: const TextStyle(color: VgmfColors.burgundy, fontWeight: FontWeight.w800)),
          ),
        IconButton(onPressed: onRefresh, icon: const Icon(Icons.refresh_rounded, color: VgmfColors.ink)),
      ]),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.items, required this.controller, required this.onPage});
  final List<dynamic> items;
  final PageController controller;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 168,
      child: PageView.builder(
        controller: controller,
        itemCount: items.length,
        onPageChanged: onPage,
        itemBuilder: (context, index) {
          final item = items[index];
          final photo = imageProvider(str(item["image"]));
          return Padding(
            padding: const EdgeInsets.only(right: 4),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Stack(fit: StackFit.expand, children: [
                if (photo != null) Image(image: photo, fit: BoxFit.cover) else Container(color: VgmfColors.ink),
                const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xCC0B1F3A), Color(0x000B1F3A)]))),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 14,
                  child: Text(str(item["title"]), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: VgmfColors.border),
      ),
      child: child,
    );
    if (onTap == null) return body;
    return InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: body);
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller, this.keyboard, this.maxLines = 1});
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboard;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: VgmfColors.border)),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.tone});
  final String text;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: tone.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
      child: Text(text, style: TextStyle(color: tone, fontWeight: FontWeight.w600)),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(label, style: const TextStyle(color: VgmfColors.muted)));
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 80),
      child: Column(children: [
        CircularProgressIndicator(color: VgmfColors.gold),
        SizedBox(height: 16),
        Text("Loading the Foundation app…", style: TextStyle(color: VgmfColors.muted)),
      ]),
    );
  }
}
