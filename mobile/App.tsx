import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createTicket,
  fetchFeed,
  getSession,
  listOrders,
  listTickets,
  loadSession,
  placeOrder,
  saveSession,
  sendEmailOtp,
  type Feed,
  verifyCertificate,
  verifyEmailOtp,
} from "./src/api";
import { colors } from "./src/theme";

type Tab = "home" | "events" | "shop" | "clinics" | "account";
type Screen =
  | Tab
  | "articles"
  | "videos"
  | "gallery"
  | "notices"
  | "about"
  | "support"
  | "certificates"
  | "event"
  | "article"
  | "book"
  | "clinic"
  | "cart";

type CartItem = { id: string; title: string; quantity: number; price: number };

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "events", label: "Events" },
  { id: "shop", label: "Shop" },
  { id: "clinics", label: "Clinics" },
  { id: "account", label: "Account" },
];

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function money(value: unknown) {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function enabled(feed: Feed | null, id: string) {
  if (!feed) return true;
  if (feed.visibility[id] === false) return false;
  if (feed.mobile.modules[id] === false) return false;
  return true;
}

function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.card}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: "email-address" | "numeric" | "phone-pad" | "default";
  secret?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        secureTextEntry={secret}
        keyboardType={keyboard ?? "default"}
        style={styles.input}
      />
    </View>
  );
}

export default function App() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cert, setCert] = useState("");
  const [certResult, setCertResult] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const session = getSession();

  const refresh = useCallback(async () => {
    setError("");
    try {
      const next = await fetchFeed();
      setFeed(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession().then(() => refresh());
  }, [refresh]);

  const open = (next: Screen, item?: Record<string, unknown>) => {
    setSelected(item ?? null);
    setScreen(next);
    setNote("");
  };

  const addToCart = (book: Record<string, unknown>) => {
    const id = str(book.id);
    const title = str(book.title, "Book");
    const price = Number(book.price) || 0;
    setCart((current) => {
      const found = current.find((item) => item.id === id);
      if (found) return current.map((item) => (item.id === id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { id, title, quantity: 1, price }];
    });
    setNote("Added to bag.");
  };

  const site = feed?.site;
  const about = feed?.about as { title?: string; intro?: string; sections?: { title: string; body: string }[] } | null;
  const brand = (feed?.mobile as { apps?: Record<string, { name?: string; logoUrl?: string }> } | undefined)?.apps?.customer;
  const logoUrl = brand?.logoUrl || site?.logoUrl;
  const appName = brand?.name || site?.name || "Memorial Foundation";

  const moreLinks = useMemo(
    () =>
      (
        [
          ["articles", "Articles"],
          ["videos", "Videos"],
          ["gallery", "Gallery"],
          ["notices", "Notices"],
          ["about", "About"],
          ["support", "Support"],
          ["certificates", "Certificates"],
        ] as [Screen, string][]
      ).filter(([id]) => enabled(feed, id)),
    [feed]
  );

  const visibleTabs = TABS.filter((tab) => enabled(feed, tab.id));

  const header = (
    <View style={styles.header}>
      {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} /> : <View style={styles.badge} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>Vaidya Gogate</Text>
        <Text style={styles.title}>{appName}</Text>
      </View>
      <Pressable onPress={() => open("cart")} style={styles.cartBtn}>
        <Text style={styles.cartText}>Bag {cart.reduce((sum, item) => sum + item.quantity, 0)}</Text>
      </Pressable>
    </View>
  );

  const empty = (label: string) => (
    <Text style={styles.muted}>{label} Appear here after Admin → Mobile app → Publish to app.</Text>
  );

  let bodyView: ReactNode = null;

  if (loading && !feed) {
    bodyView = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.burgundy} />
        <Text style={styles.muted}>Loading the Foundation app…</Text>
      </View>
    );
  } else if (screen === "home") {
    bodyView = (
      <>
        <Text style={styles.hero}>{site?.tagline}</Text>
        {feed?.announcements?.slice(0, 3).map((item) => (
          <Card key={str(item.id)}>
            <Text style={styles.kicker}>{str(item.category, "Notice")}</Text>
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.description)}</Text>
          </Card>
        ))}
        <Text style={styles.section}>Explore</Text>
        <View style={styles.grid}>
          {moreLinks.map(([id, label]) => (
            <Pressable key={id} onPress={() => open(id)} style={styles.tile}>
              <Text style={styles.tileText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {enabled(feed, "events") ? (
          <>
            <Text style={styles.section}>Events</Text>
            {feed?.events.slice(0, 3).map((item) => (
              <Card key={str(item.id)} onPress={() => open("event", item)}>
                <Text style={styles.cardTitle}>{str(item.name)}</Text>
                <Text style={styles.muted}>{str(item.shortDescription) || str(item.city)}</Text>
              </Card>
            ))}
            {!feed?.events.length ? empty("Events") : null}
          </>
        ) : null}
        {feed?.flags.supportUs ? (
          <Card>
            <Text style={styles.cardTitle}>{feed.flags.supportUsTitle || "Support the Foundation"}</Text>
            <Text style={styles.muted}>{feed.flags.supportUsText}</Text>
          </Card>
        ) : null}
      </>
    );
  } else if (screen === "events") {
    bodyView = (
      <>
        <Text style={styles.section}>Events</Text>
        {feed?.events.map((item) => (
          <Card key={str(item.id)} onPress={() => open("event", item)}>
            <Text style={styles.cardTitle}>{str(item.name)}</Text>
            <Text style={styles.muted}>
              {str(item.city)} {str(item.startDate) ? `· ${str(item.startDate).slice(0, 10)}` : ""}
            </Text>
          </Card>
        ))}
        {!feed?.events.length ? empty("Events") : null}
      </>
    );
  } else if (screen === "event" && selected) {
    bodyView = (
      <Card>
        <Text style={styles.cardTitle}>{str(selected.name)}</Text>
        <Text style={styles.muted}>{str(selected.shortDescription)}</Text>
        <Text style={styles.body}>{str(selected.description)}</Text>
        {selected.venue ? <Text style={styles.muted}>{str(selected.venue)}</Text> : null}
        {selected.registrationUrl ? (
          <Pressable onPress={() => void Linking.openURL(str(selected.registrationUrl))} style={styles.primary}>
            <Text style={styles.primaryText}>Register</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else if (screen === "articles") {
    bodyView = (
      <>
        <Text style={styles.section}>Articles</Text>
        {feed?.articles.map((item) => (
          <Card key={str(item.id)} onPress={() => open("article", item)}>
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.excerpt)}</Text>
          </Card>
        ))}
        {!feed?.articles.length ? empty("Articles") : null}
      </>
    );
  } else if (screen === "article" && selected) {
    bodyView = (
      <Card>
        <Text style={styles.cardTitle}>{str(selected.title)}</Text>
        <Text style={styles.muted}>{str(selected.author)}</Text>
        <Text style={styles.body}>{str(selected.content)}</Text>
      </Card>
    );
  } else if (screen === "shop") {
    bodyView = (
      <>
        <Text style={styles.section}>Publications</Text>
        {feed?.books.map((item) => (
          <Card key={str(item.id)} onPress={() => open("book", item)}>
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.author)}</Text>
            <Text style={styles.price}>{money(item.price)}</Text>
          </Card>
        ))}
        {!feed?.books.length ? empty("Books") : null}
      </>
    );
  } else if (screen === "book" && selected) {
    bodyView = (
      <Card>
        {selected.coverImage ? <Image source={{ uri: str(selected.coverImage) }} style={styles.cover} /> : null}
        <Text style={styles.cardTitle}>{str(selected.title)}</Text>
        <Text style={styles.muted}>{str(selected.author)}</Text>
        <Text style={styles.body}>{str(selected.description)}</Text>
        <Text style={styles.price}>{money(selected.price)}</Text>
        <Pressable onPress={() => addToCart(selected)} style={styles.primary}>
          <Text style={styles.primaryText}>Add to bag</Text>
        </Pressable>
      </Card>
    );
  } else if (screen === "cart") {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    bodyView = (
      <>
        <Text style={styles.section}>Bag</Text>
        {cart.map((item) => (
          <Card key={item.id}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>
              {item.quantity} × {money(item.price)}
            </Text>
          </Card>
        ))}
        {!cart.length ? <Text style={styles.muted}>Your bag is empty.</Text> : <Text style={styles.price}>Total {money(total)}</Text>}
        {cart.length ? (
          <Pressable
            style={styles.primary}
            onPress={async () => {
              try {
                if (!getSession()) {
                  open("account");
                  setNote("Sign in with email OTP to place the order.");
                  return;
                }
                const order = await placeOrder({ items: cart, name: getSession()?.name, email: getSession()?.email });
                setCart([]);
                setNote(`Order ${str(order.id)} placed. Status updates by email.`);
              } catch (err) {
                setNote((err as Error).message);
              }
            }}
          >
            <Text style={styles.primaryText}>Place order</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (screen === "clinics") {
    bodyView = (
      <>
        <Text style={styles.section}>Clinics</Text>
        {feed?.clinics.map((item) => (
          <Card key={str(item.id)} onPress={() => open("clinic", item)}>
            <Text style={styles.cardTitle}>{str(item.name)}</Text>
            <Text style={styles.muted}>{str(item.city)}</Text>
          </Card>
        ))}
        {!feed?.clinics.length ? empty("Clinics") : null}
      </>
    );
  } else if (screen === "clinic" && selected) {
    bodyView = (
      <Card>
        <Text style={styles.cardTitle}>{str(selected.name)}</Text>
        <Text style={styles.muted}>{str(selected.address)}</Text>
        <Text style={styles.body}>{str(selected.about)}</Text>
        {selected.phone ? (
          <Pressable onPress={() => void Linking.openURL(`tel:${str(selected.phone)}`)} style={styles.primary}>
            <Text style={styles.primaryText}>Call clinic</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else if (screen === "videos") {
    bodyView = (
      <>
        <Text style={styles.section}>Videos</Text>
        {feed?.videos.map((item) => (
          <Card
            key={str(item.id)}
            onPress={() => {
              const url = str(item.youtubeUrl) || str(item.src);
              if (url) void Linking.openURL(url);
            }}
          >
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.description)}</Text>
          </Card>
        ))}
        {!feed?.videos.length ? empty("Videos") : null}
      </>
    );
  } else if (screen === "gallery") {
    bodyView = (
      <>
        <Text style={styles.section}>Gallery</Text>
        {feed?.gallery.map((item) => (
          <Card key={str(item.id)}>
            {item.src ? <Image source={{ uri: str(item.src) }} style={styles.cover} /> : null}
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.caption)}</Text>
          </Card>
        ))}
        {!feed?.gallery.length ? empty("Gallery") : null}
      </>
    );
  } else if (screen === "notices") {
    bodyView = (
      <>
        <Text style={styles.section}>Notice board</Text>
        {feed?.notices.map((item) => (
          <Card key={str(item.id)}>
            <Text style={styles.cardTitle}>{str(item.title)}</Text>
            <Text style={styles.muted}>{str(item.description)}</Text>
          </Card>
        ))}
        {!feed?.notices.length ? empty("Notices") : null}
      </>
    );
  } else if (screen === "about") {
    bodyView = (
      <Card>
        <Text style={styles.cardTitle}>{about?.title || "About the Foundation"}</Text>
        <Text style={styles.body}>{about?.intro}</Text>
        {about?.sections?.map((section) => (
          <View key={section.title} style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
        {feed?.site.address ? <Text style={[styles.muted, { marginTop: 16 }]}>{feed.site.address}</Text> : null}
      </Card>
    );
  } else if (screen === "support") {
    bodyView = (
      <>
        <Text style={styles.section}>Support ticket</Text>
        <Field label="Your name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
        <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Message" value={body} onChange={setBody} />
        <Pressable
          style={styles.primary}
          onPress={async () => {
            try {
              const ticket = await createTicket({ name, email: email || getSession()?.email || "", phone, subject, body });
              setSubject("");
              setBody("");
              setNote(`Ticket ${str(ticket.id)} opened. We will email updates.`);
            } catch (err) {
              setNote((err as Error).message);
            }
          }}
        >
          <Text style={styles.primaryText}>Send ticket</Text>
        </Pressable>
        {feed?.site.email ? (
          <Pressable onPress={() => void Linking.openURL(`mailto:${feed.site.email}`)}>
            <Text style={styles.link}>{feed.site.email}</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (screen === "certificates") {
    bodyView = (
      <>
        <Text style={styles.section}>Certificate verification</Text>
        <Field label="Certificate number" value={cert} onChange={setCert} />
        <Pressable
          style={styles.primary}
          onPress={async () => {
            const result = await verifyCertificate(cert);
            if (result.verified) {
              const certificate = result.certificate ?? {};
              setCertResult(`Verified${result.sourceLabel ? ` (${result.sourceLabel})` : ""}. ${str(certificate.holderName || certificate.name || "")}`);
            } else {
              setCertResult(result.error || "This certificate could not be verified.");
            }
          }}
        >
          <Text style={styles.primaryText}>Verify</Text>
        </Pressable>
        {certResult ? <Text style={styles.body}>{certResult}</Text> : null}
      </>
    );
  } else if (screen === "account") {
    bodyView = session ? (
      <>
        <Text style={styles.section}>Signed in</Text>
        <Text style={styles.body}>{session.name || session.email}</Text>
        <Pressable
          style={styles.ghost}
          onPress={async () => {
            await saveSession(null);
            setOtpSent(false);
            setOtp("");
            setNote("Signed out.");
            open("account");
          }}
        >
          <Text style={styles.ghostText}>Sign out</Text>
        </Pressable>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            try {
              setTickets(await listTickets());
              setOrders(await listOrders());
            } catch (err) {
              setNote((err as Error).message);
            }
          }}
        >
          <Text style={styles.primaryText}>Refresh tickets & orders</Text>
        </Pressable>
        {tickets.map((item) => (
          <Card key={str(item.id)}>
            <Text style={styles.cardTitle}>{str(item.subject)}</Text>
            <Text style={styles.muted}>
              {str(item.id)} · {str(item.status)}
            </Text>
          </Card>
        ))}
        {orders.map((item) => (
          <Card key={str(item.id)}>
            <Text style={styles.cardTitle}>Order {str(item.id)}</Text>
            <Text style={styles.muted}>
              {str(item.status)} · {money(item.total)}
            </Text>
          </Card>
        ))}
      </>
    ) : (
      <>
        <Text style={styles.section}>Email sign-in</Text>
        <Text style={styles.muted}>A 6-digit code is sent to your email. WhatsApp OTP is not used.</Text>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
        {otpSent ? <Field label="Email code" value={otp} onChange={setOtp} keyboard="numeric" /> : null}
        <Pressable
          style={styles.primary}
          onPress={async () => {
            try {
              if (!otpSent) {
                await sendEmailOtp(email, name);
                setOtpSent(true);
                setNote("Check your email for the 6-digit code. Resend is available after 1 minute.");
                return;
              }
              await verifyEmailOtp(email, otp, name);
              setNote("Signed in.");
              open("account");
            } catch (err) {
              setNote((err as Error).message);
            }
          }}
        >
          <Text style={styles.primaryText}>{otpSent ? "Verify email code" : "Send email code"}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      {header}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && !!feed} onRefresh={() => void refresh()} tintColor={colors.burgundy} />}
      >
        {screen !== "home" && !TABS.some((tab) => tab.id === screen) ? (
          <Pressable onPress={() => open("home")} style={{ marginBottom: 12 }}>
            <Text style={styles.link}>← Home</Text>
          </Pressable>
        ) : null}
        {bodyView}
        <Text style={styles.foot}>
          {feed?.publishedAt ? `Updated ${new Date(feed.publishedAt).toLocaleString("en-IN")}` : "Pull to refresh after the Foundation publishes."}
        </Text>
      </ScrollView>
      <View style={styles.tabs}>
        {visibleTabs.map((tab) => (
          <Pressable key={tab.id} onPress={() => open(tab.id)} style={styles.tab}>
            <Text style={[styles.tabText, screen === tab.id && styles.tabOn]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  logo: { width: 44, height: 44, borderRadius: 22 },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.burgundy },
  kicker: { color: colors.gold, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  cartBtn: { borderWidth: 1, borderColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  cartText: { color: colors.burgundy, fontSize: 12, fontWeight: "700" },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { fontSize: 22, lineHeight: 30, color: colors.ink, marginBottom: 16, fontWeight: "600" },
  section: { fontSize: 20, color: colors.ink, fontWeight: "700", marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 17, color: colors.ink, fontWeight: "700" },
  muted: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  body: { color: colors.ink, marginTop: 10, lineHeight: 22 },
  price: { color: colors.burgundy, fontWeight: "700", marginTop: 8, fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tile: { backgroundColor: colors.paper, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  tileText: { color: colors.burgundy, fontWeight: "700" },
  primary: { marginTop: 14, backgroundColor: colors.burgundy, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: colors.white, fontWeight: "700" },
  ghost: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ghostText: { color: colors.ink, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.white, color: colors.ink },
  label: { color: colors.muted, marginBottom: 6, fontSize: 13, fontWeight: "600" },
  error: { color: colors.burgundy, paddingHorizontal: 20, marginBottom: 8 },
  note: { color: colors.ink, backgroundColor: colors.paper, marginHorizontal: 20, marginBottom: 8, padding: 10, borderRadius: 12 },
  link: { color: colors.burgundy, fontWeight: "700", marginTop: 12 },
  cover: { width: "100%", height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: colors.paper },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  tabOn: { color: colors.burgundy },
  center: { padding: 40, alignItems: "center", gap: 12 },
  foot: { color: colors.muted, fontSize: 12, marginTop: 24, textAlign: "center" },
});
