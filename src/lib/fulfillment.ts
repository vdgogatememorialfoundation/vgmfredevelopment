import { books } from "@/data/books";
import { getIntegrations } from "@/lib/integrations";
import type { Book, ProcessingTimeline, ProductOverride, SiteSettings } from "@/types";
import { formatDate } from "@/lib/utils";

const CARRIERS_KEY = "vgmf_carriers";
const PROFILES_KEY = "vgmf_product_fulfillment";
const POLICY_KEY = "vgmf_fulfillment_policy";
const SETTINGS_KEY = "vgmf_settings";
const OVERRIDES_KEY = "vgmf_admin_products";

export type CarrierKind = "aggregator" | "hyperlocal" | "courier";

export interface CarrierAccount {
  id: string;
  name: string;
  kind: CarrierKind;
  enabled: boolean;
  /** Lower numbers are offered first when transit time ties. */
  priority: number;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  /** Empty means every standard postal zone this partner lists in zoneDays. */
  prefixes: string[];
  zoneDays: Record<string, number>;
  /** Transit when the pincode shares the first 3 digits with the stocking location. */
  sameCityDays: number;
  charge: number;
  blurb: string;
}

export interface FulfillmentPolicy {
  storePickupEnabled: boolean;
  orderCutoffHour: number;
  daysToPack: number;
  daysToHandoff: number;
  defaultTransitDays: number;
  pickupHoldingDays: number;
}

export interface ProductFulfillment {
  bookId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  stockingLocation: string;
  reorderLevel: number;
  /** Null uses the site processing timeline. */
  processingDays: number | null;
  serviceablePrefixes: string[];
  blockedPincodes: string[];
  preferredCarrierId: string;
}

export interface CarrierOffer {
  id: string;
  name: string;
  kind: CarrierKind;
  charge: number;
  transitDays: number;
  deliverBy: string;
  deliverFrom: string;
  credentialsSaved: boolean;
}

export interface DeliveryQuote {
  serviceable: boolean;
  pincode: string;
  inStock: boolean;
  stock: number;
  stockingLocation: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  cutoffPassed: boolean;
  orderDate: string;
  processingDays: number;
  handoffDays: number;
  transitDays: number;
  dispatchBy: string;
  deliverFrom: string;
  deliverBy: string;
  pickupReadyBy: string;
  pickupHoldUntil: string;
  courier: string | null;
  courierId: string | null;
  offers: CarrierOffer[];
  note?: string;
}

const DEFAULT_POLICY: FulfillmentPolicy = {
  storePickupEnabled: true,
  orderCutoffHour: 14,
  daysToPack: 1,
  daysToHandoff: 1,
  defaultTransitDays: 4,
  pickupHoldingDays: 3,
};

/** Last-mile names Shiprocket / iThink allocate. They are not APIs on this site. */
const LAST_MILE_IDS = new Set([
  "shadowfax",
  "pidge",
  "delhivery",
  "bluedart",
  "blue-dart",
  "ekart",
  "dtdc",
  "indiapost",
  "india-post",
]);

function defaultCarriers(): CarrierAccount[] {
  const national = (near: number, mid: number, far: number): Record<string, number> => ({
    "1": mid,
    "2": mid,
    "3": near,
    "4": near,
    "5": mid,
    "6": far,
    "7": far + 1,
    "8": far,
  });

  return [
    {
      id: "shiprocket",
      name: "Shiprocket",
      kind: "aggregator",
      enabled: true,
      priority: 1,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: [],
      zoneDays: national(2, 3, 4),
      sameCityDays: 1,
      charge: 49,
      blurb: "Multi-courier checkout for surface and express across India.",
    },
    {
      id: "nimbuspost",
      name: "Nimbuspost",
      kind: "aggregator",
      enabled: true,
      priority: 2,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: [],
      zoneDays: national(2, 3, 5),
      sameCityDays: 1,
      charge: 45,
      blurb: "Shipping aggregator with prepaid and COD serviceability.",
    },
    {
      id: "ithink",
      name: "iThink Logistics",
      kind: "aggregator",
      enabled: true,
      priority: 3,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: [],
      zoneDays: national(2, 4, 5),
      sameCityDays: 1,
      charge: 42,
      blurb: "eCommerce shipping with zone-wise SLAs from the Pune hub.",
    },
    {
      id: "tookan",
      name: "Tookan Hyperlocal",
      kind: "hyperlocal",
      enabled: true,
      priority: 4,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: ["411"],
      zoneDays: { "4": 1 },
      sameCityDays: 0,
      charge: 39,
      blurb: "Tookan hyperlocal: same-city delivery tasks for Pune store pincodes.",
    },
    {
      id: "tookan-parcel",
      name: "Tookan Parcel",
      kind: "aggregator",
      enabled: true,
      priority: 5,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: [],
      zoneDays: national(2, 3, 5),
      sameCityDays: 1,
      charge: 45,
      blurb: "Tookan parcel delivery: pickup and delivery tasks for intercity parcels.",
    },
    {
      id: "shipday",
      name: "Shipday",
      kind: "hyperlocal",
      enabled: true,
      priority: 6,
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      prefixes: ["411"],
      zoneDays: { "4": 1 },
      sameCityDays: 0,
      charge: 45,
      blurb: "Local delivery dispatch with your own or Shipday partner drivers.",
    },
  ];
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function credentialsSaved(carrier: CarrierAccount) {
  const shipping = getIntegrations().shipping;
  if (carrier.id === "shiprocket") return Boolean(shipping.shiprocket.email && shipping.shiprocket.password);
  if (carrier.id === "nimbuspost") return Boolean(shipping.nimbuspost.email && shipping.nimbuspost.password);
  if (carrier.id === "ithink") return Boolean(shipping.ithink.accessToken && shipping.ithink.secretKey);
  if (carrier.id === "tookan") return Boolean(shipping.tookan.apiKey && shipping.tookan.hyperlocal);
  if (carrier.id === "tookan-parcel") return Boolean(shipping.tookan.apiKey && shipping.tookan.parcel);
  if (carrier.id === "shipday") return Boolean(shipping.shipday.apiKey && shipping.shipday.enabled);
  return false;
}

export function getCarriers(): CarrierAccount[] {
  const stored = readJSON<CarrierAccount[] | null>(CARRIERS_KEY, null);
  const allowed = new Set(defaultCarriers().map((carrier) => carrier.id));
  const cleaned = (stored ?? []).filter((carrier) => allowed.has(carrier.id) && !LAST_MILE_IDS.has(carrier.id));
  if (!stored?.length || cleaned.length !== stored.length) {
    const seeded = defaultCarriers();
    const byId = new Map(cleaned.map((carrier) => [carrier.id, carrier]));
    const next = seeded.map((carrier) => {
      const saved = byId.get(carrier.id);
      return saved ? { ...carrier, ...saved, id: carrier.id, name: carrier.name, kind: carrier.kind, blurb: carrier.blurb } : carrier;
    });
    writeJSON(CARRIERS_KEY, next);
    return next;
  }
  const byId = new Map(cleaned.map((carrier) => [carrier.id, carrier]));
  const next = defaultCarriers().map((carrier) => {
    const saved = byId.get(carrier.id);
    return saved ? { ...carrier, ...saved, id: carrier.id, name: carrier.name, kind: carrier.kind, blurb: carrier.blurb } : carrier;
  });
  writeJSON(CARRIERS_KEY, next);
  return next;
}

export function saveCarriers(carriers: CarrierAccount[]) {
  writeJSON(CARRIERS_KEY, carriers);
  const settings = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  if (settings) {
    settings.couriers = carriers.filter((carrier) => carrier.enabled).map((carrier) => carrier.name);
    const shiprocket = carriers.find((carrier) => carrier.id === "shiprocket");
    if (shiprocket) settings.apiKeys = { ...settings.apiKeys, shiprocket: shiprocket.apiKey };
    writeJSON(SETTINGS_KEY, settings);
  }
}

export function saveCarrier(carrier: CarrierAccount) {
  const next = getCarriers().map((item) => (item.id === carrier.id ? carrier : item));
  saveCarriers(next);
}

export function getPolicy(): FulfillmentPolicy {
  const stored = readJSON<Partial<FulfillmentPolicy> | null>(POLICY_KEY, null);
  const settings = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  const processing: ProcessingTimeline | undefined = settings?.processing;
  return {
    ...DEFAULT_POLICY,
    ...(processing
      ? {
          daysToPack: processing.daysToPack,
          daysToHandoff: processing.daysToPickup,
          defaultTransitDays: processing.daysInTransit,
          orderCutoffHour: processing.orderCutoffHour ?? DEFAULT_POLICY.orderCutoffHour,
          storePickupEnabled: processing.storePickupEnabled ?? DEFAULT_POLICY.storePickupEnabled,
          pickupHoldingDays: processing.pickupHoldingDays ?? DEFAULT_POLICY.pickupHoldingDays,
        }
      : {}),
    ...(stored ?? {}),
  };
}

export function savePolicy(policy: FulfillmentPolicy) {
  const next: FulfillmentPolicy = {
    ...policy,
    orderCutoffHour: clamp(policy.orderCutoffHour, 0, 23),
    daysToPack: Math.max(0, policy.daysToPack),
    daysToHandoff: Math.max(0, policy.daysToHandoff),
    defaultTransitDays: Math.max(1, policy.defaultTransitDays),
    pickupHoldingDays: Math.max(1, policy.pickupHoldingDays),
  };
  writeJSON(POLICY_KEY, next);
  const settings = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  if (settings) {
    settings.processing = {
      ...settings.processing,
      daysToPack: next.daysToPack,
      daysToPickup: next.daysToHandoff,
      daysInTransit: next.defaultTransitDays,
      orderCutoffHour: next.orderCutoffHour,
      storePickupEnabled: next.storePickupEnabled,
      pickupHoldingDays: next.pickupHoldingDays,
    };
    writeJSON(SETTINGS_KEY, settings);
  }
}

export function defaultProductFulfillment(book: Book): ProductFulfillment {
  return {
    bookId: book.id,
    deliveryEnabled: book.deliveryAvailable !== false,
    pickupEnabled: book.storePickupAvailable !== false,
    stockingLocation: "Pune Fulfillment Hub",
    reorderLevel: 5,
    processingDays: null,
    serviceablePrefixes: [],
    blockedPincodes: [],
    preferredCarrierId: "",
  };
}

export function getProductFulfillment(bookId: string): ProductFulfillment {
  const book = findBook(bookId);
  const base = book ? defaultProductFulfillment(book) : {
    bookId,
    deliveryEnabled: true,
    pickupEnabled: true,
    stockingLocation: "Pune Fulfillment Hub",
    reorderLevel: 5,
    processingDays: null,
    serviceablePrefixes: [],
    blockedPincodes: [],
    preferredCarrierId: "",
  };
  const stored = readJSON<ProductFulfillment[]>(PROFILES_KEY, []).find((item) => item.bookId === bookId);
  return stored ? { ...base, ...stored, bookId } : base;
}

export function saveProductFulfillment(profile: ProductFulfillment) {
  const list = readJSON<ProductFulfillment[]>(PROFILES_KEY, []).filter((item) => item.bookId !== profile.bookId);
  list.push({
    ...profile,
    serviceablePrefixes: profile.serviceablePrefixes.map(cleanPin).filter(Boolean),
    blockedPincodes: profile.blockedPincodes.map(cleanPin).filter((pin) => pin.length === 6),
    processingDays:
      profile.processingDays == null || Number.isNaN(profile.processingDays)
        ? null
        : Math.max(0, profile.processingDays),
  });
  writeJSON(PROFILES_KEY, list);
}

export function getOriginPincode() {
  if (typeof window !== "undefined" && window.localStorage.getItem("vgmf_integrations")) {
    const pickup = getIntegrations().shipping.pickup.pincode.replace(/\D/g, "");
    if (pickup.length === 6) return pickup;
  }
  const settings = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  const active = settings?.fulfillmentLocations?.find((location) => location.active && location.pincode);
  return (active?.pincode || "411005").replace(/\D/g, "").slice(0, 6);
}

export function getPickupLocation() {
  const settings = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  const active = settings?.fulfillmentLocations?.find((location) => location.active);
  if (!active) {
    return {
      name: "Vaidya Gogate Memorial Foundation",
      address: "FC Road, Shivaji Nagar, Pune, Maharashtra 411005",
      phone: "+91 20 1234 5678",
    };
  }
  return {
    name: active.name,
    address: `${active.address}, ${active.city}, ${active.state} ${active.pincode}`,
    phone: active.phone,
  };
}

export function checkPincode(pincode: string, bookId?: string, quantity = 1): DeliveryQuote {
  const normalized = pincode.replace(/\D/g, "");
  const policy = getPolicy();
  const now = new Date();
  const cutoffPassed = now.getHours() >= policy.orderCutoffHour;
  const anchor = orderAnchor(now, policy.orderCutoffHour);
  const book = bookId ? findBook(bookId) : undefined;
  const profile = bookId ? getProductFulfillment(bookId) : null;
  const stock = book ? stockOf(book) : quantity;
  const processingDays = profile?.processingDays ?? policy.daysToPack;
  const dispatchBy = addBusinessDays(anchor, processingDays);
  const handoffBy = addBusinessDays(dispatchBy, policy.daysToHandoff);
  const pickupReadyBy = formatDate(dispatchBy);
  const pickupHoldUntil = formatDate(addCalendarDays(dispatchBy, policy.pickupHoldingDays));
  const location = profile?.stockingLocation || "Pune Fulfillment Hub";
  const pickupAvailable = Boolean(
    policy.storePickupEnabled && (profile ? profile.pickupEnabled : true) && stock >= quantity
  );

  const emptyOffers: DeliveryQuote = {
    serviceable: false,
    pincode: normalized,
    inStock: stock >= quantity,
    stock,
    stockingLocation: location,
    deliveryAvailable: false,
    pickupAvailable,
    cutoffPassed,
    orderDate: formatDate(now),
    processingDays,
    handoffDays: policy.daysToHandoff,
    transitDays: 0,
    dispatchBy: formatDate(dispatchBy),
    deliverFrom: "",
    deliverBy: "",
    pickupReadyBy,
    pickupHoldUntil,
    courier: null,
    courierId: null,
    offers: [],
  };

  if (!/^\d{6}$/.test(normalized)) {
    return { ...emptyOffers, note: "Enter a valid 6-digit pincode to check delivery." };
  }

  if (book && stock < quantity) {
    return {
      ...emptyOffers,
      pickupAvailable: false,
      note: stock <= 0 ? "This product is out of stock." : `Only ${stock} in stock at ${location}.`,
    };
  }

  if (profile && !profile.deliveryEnabled) {
    return {
      ...emptyOffers,
      note: pickupAvailable
        ? "Home delivery is turned off for this product. Pickup from store is available."
        : "Delivery is turned off for this product.",
    };
  }

  if (profile?.blockedPincodes.includes(normalized)) {
    return {
      ...emptyOffers,
      note: `Pincode ${normalized} is blocked for this product.`,
    };
  }

  if (
    profile &&
    profile.serviceablePrefixes.length > 0 &&
    !profile.serviceablePrefixes.some((prefix) => normalized.startsWith(prefix))
  ) {
    return {
      ...emptyOffers,
      note: `This product is stocked for selected pin codes only. ${normalized} is outside that list.`,
    };
  }

  const origin = getOriginPincode();
  const offers = getCarriers()
    .filter((carrier) => carrier.enabled)
    .map((carrier) => offerFor(carrier, normalized, origin, dispatchBy, handoffBy, policy.defaultTransitDays))
    .filter((offer): offer is CarrierOffer => Boolean(offer))
    .sort((a, b) => {
      if (profile?.preferredCarrierId && a.id === profile.preferredCarrierId) return -1;
      if (profile?.preferredCarrierId && b.id === profile.preferredCarrierId) return 1;
      if (a.transitDays !== b.transitDays) return a.transitDays - b.transitDays;
      return a.charge - b.charge;
    });

  if (!offers.length) {
    return {
      ...emptyOffers,
      note: "No enabled delivery partner services this pincode. You can still choose pickup from store when it is available.",
    };
  }

  const best = offers[0];
  return {
    ...emptyOffers,
    serviceable: true,
    deliveryAvailable: true,
    transitDays: best.transitDays,
    deliverFrom: best.deliverFrom,
    deliverBy: best.deliverBy,
    courier: best.name,
    courierId: best.id,
    offers,
    note: cutoffPassed
      ? `Orders placed after ${formatHour(policy.orderCutoffHour)} are processed on the next business day.`
      : `Order before ${formatHour(policy.orderCutoffHour)} and processing starts today.`,
  };
}

export function checkCart(
  lines: { bookId: string; quantity: number }[],
  pincode: string
): DeliveryQuote {
  if (!lines.length) return checkPincode(pincode);
  const quotes = lines.map((line) => checkPincode(pincode, line.bookId, line.quantity));
  const pickupAvailable = quotes.every((quote) => quote.pickupAvailable);
  const shared = intersectOffers(quotes);
  const base = quotes[0];
  if (!shared.length) {
    const note = quotes.find((quote) => quote.note && !quote.serviceable)?.note
      ?? "One or more products cannot be delivered to this pincode together.";
    return {
      ...base,
      serviceable: false,
      deliveryAvailable: false,
      pickupAvailable,
      offers: [],
      courier: null,
      courierId: null,
      deliverFrom: "",
      deliverBy: "",
      note,
      processingDays: Math.max(...quotes.map((quote) => quote.processingDays)),
      dispatchBy: latestLabel(quotes.map((quote) => quote.dispatchBy)),
      pickupReadyBy: latestLabel(quotes.map((quote) => quote.pickupReadyBy)),
    };
  }
  return {
    ...base,
    serviceable: true,
    deliveryAvailable: true,
    pickupAvailable,
    offers: shared,
    courier: shared[0].name,
    courierId: shared[0].id,
    transitDays: shared[0].transitDays,
    deliverFrom: shared[0].deliverFrom,
    deliverBy: shared[0].deliverBy,
    processingDays: Math.max(...quotes.map((quote) => quote.processingDays)),
    dispatchBy: latestLabel(quotes.map((quote) => quote.dispatchBy)),
    pickupReadyBy: latestLabel(quotes.map((quote) => quote.pickupReadyBy)),
    stockingLocation: quotes.map((quote) => quote.stockingLocation).filter(unique).join(", "),
  };
}

function offerFor(
  carrier: CarrierAccount,
  pincode: string,
  origin: string,
  dispatchBy: Date,
  handoffBy: Date,
  fallbackTransit: number
): CarrierOffer | null {
  if (carrier.prefixes.length && !carrier.prefixes.some((prefix) => pincode.startsWith(prefix))) {
    return null;
  }
  const zone = pincode[0];
  if (!carrier.prefixes.length && (zone === "0" || zone === "9")) return null;
  const sameCity = origin.slice(0, 3) === pincode.slice(0, 3);
  const transit = sameCity
    ? carrier.sameCityDays
    : carrier.zoneDays[zone] ?? (carrier.prefixes.length ? carrier.sameCityDays : null);
  if (transit == null) return null;
  const start = carrier.kind === "hyperlocal" && sameCity ? dispatchBy : handoffBy;
  const transitDays = sameCity ? transit : transit || fallbackTransit;
  const earliest = addBusinessDays(start, transitDays);
  const latest = addBusinessDays(earliest, transitDays === 0 ? 0 : 1);
  return {
    id: carrier.id,
    name: carrier.name,
    kind: carrier.kind,
    charge: carrier.charge,
    transitDays,
    deliverFrom: formatDate(earliest),
    deliverBy: formatDate(latest.getTime() === earliest.getTime() ? earliest : latest),
    credentialsSaved: credentialsSaved(carrier),
  };
}

function intersectOffers(quotes: DeliveryQuote[]): CarrierOffer[] {
  const lists = quotes.map((quote) => quote.offers);
  if (lists.some((list) => list.length === 0)) return [];
  const [first, ...rest] = lists;
  return first
    .filter((offer) => rest.every((list) => list.some((item) => item.id === offer.id)))
    .map((offer) => {
      const peers = [offer, ...rest.map((list) => list.find((item) => item.id === offer.id)!)];
      const slowest = peers.reduce((max, item) => (item.transitDays > max.transitDays ? item : max));
      return slowest;
    })
    .sort((a, b) => a.transitDays - b.transitDays || a.charge - b.charge);
}

function findBook(bookId: string): Book | undefined {
  const custom = readJSON<Book[]>("vgmf_custom_books", []);
  return [...books, ...custom].find((book) => book.id === bookId);
}

function stockOf(book: Book) {
  const override = readJSON<ProductOverride[]>(OVERRIDES_KEY, []).find((item) => item.bookId === book.id);
  return override?.stock ?? book.stock;
}

function cleanPin(value: string) {
  return value.replace(/\D/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique(value: string, index: number, list: string[]) {
  return list.indexOf(value) === index;
}

function orderAnchor(now: Date, cutoffHour: number) {
  const anchor = startOfDay(now);
  if (now.getHours() >= cutoffHour || !isBusinessDay(anchor)) return nextBusinessDay(anchor);
  return anchor;
}

function isBusinessDay(date: Date) {
  return date.getDay() !== 0;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function nextBusinessDay(date: Date) {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (!isBusinessDay(next));
  return next;
}

function addBusinessDays(from: Date, days: number) {
  const next = startOfDay(from);
  let left = Math.max(0, days);
  while (left > 0) {
    next.setDate(next.getDate() + 1);
    if (isBusinessDay(next)) left -= 1;
  }
  return next;
}

function addCalendarDays(from: Date, days: number) {
  const next = startOfDay(from);
  next.setDate(next.getDate() + days);
  return next;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const value = hour % 12 || 12;
  return `${value}:00 ${suffix}`;
}

function latestLabel(labels: string[]) {
  return labels.reduce((latest, label) => {
    const a = Date.parse(latest);
    const b = Date.parse(label);
    if (Number.isNaN(a)) return label;
    if (Number.isNaN(b)) return latest;
    return b > a ? label : latest;
  }, labels[0] ?? "");
}
