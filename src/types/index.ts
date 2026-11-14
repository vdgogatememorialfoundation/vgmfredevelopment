export type EventType =
  | "Seminar"
  | "Conference"
  | "Workshop"
  | "Webinar"
  | "Fellowship"
  | "Training"
  | "Other Foundation Events";

export type RegistrationStatus =
  | "Open"
  | "Closing Soon"
  | "Closed"
  | "Waitlist";

export interface RegistrationWindow {
  label: "Pre-registration" | "Main registration";
  start?: string;
  end?: string;
}

export type EventMode = "Online" | "Offline" | "Hybrid";

export type PartnerPortalId = "seminar" | "autism" | "fellowship";

export interface Event {
  termsConditions?: string;
  introVideoUrl?: string;
  groupChatUrl?: string;
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  bannerUrl: string;
  startDate: string;
  endDate: string;
  venue?: string;
  city?: string;
  mode: EventMode;
  eventType: EventType;
  registrationStart: string;
  registrationEnd: string;
  /** Pre-registration window from the seminar or autism portal, when that portal has one. */
  preRegistration?: RegistrationWindow;
  /** Main registration window from the seminar or autism portal, when that portal has one. */
  mainRegistration?: RegistrationWindow;
  fee: number;
  currency: string;
  capacity?: number;
  registrationStatus: RegistrationStatus;
  speakers?: Speaker[];
  schedule?: ScheduleItem[];
  faqs?: Faq[];
  sponsors?: Sponsor[];
  highlights?: string[];
  terms?: string[];
  flyers?: string[];
  /** Fields not finalised yet are shown publicly as "To be announced". */
  tbd?: EventTbd;
  timeText?: string;
  registrationUrl?: string;
  mapsUrl?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  /** ISO datetime — hidden on the public site until this time. */
  publishAt?: string;
  /** ISO datetime — hidden on the public site after this time. */
  unpublishAt?: string;
  /** Sister portal this event was synced from. Omitted for events created on VGMF. */
  source?: PartnerPortalId | "vgmf";
  sourceUrl?: string;
}

export interface PartnerPortal {
  id: PartnerPortalId;
  label: string;
  href: string;
  hasTicket?: boolean;
  ticketCount?: number;
  paymentCount?: number;
  role?: "doctor" | "applicant" | "registrant" | "fellow";
}

/** E-ticket / application summary stored on the Foundation site. The QR itself stays on the sister portal. */
export interface PartnerTicketSummary {
  id: string;
  portal: PartnerPortalId;
  eventName: string;
  status: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
  issuedAt?: string;
  portalUrl: string;
  applicationNo?: string;
  kind?: "ticket" | "registration" | "application";
}

export interface PartnerPaymentSummary {
  id: string;
  portal: PartnerPortalId;
  amount: number;
  currency: string;
  status: string;
  at?: string;
  eventName?: string;
  portalUrl: string;
}

export interface EventTbd {
  dates?: boolean;
  time?: boolean;
  venue?: boolean;
  city?: boolean;
  fee?: boolean;
  speakers?: boolean;
  schedule?: boolean;
  registration?: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  designation: string;
  topic: string;
  bio?: string;
  photo?: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  /** ISO end time when the portal sent one. */
  endTime?: string;
  title: string;
  description?: string;
}

export interface PrizeAward {
  id: string;
  personName: string;
  awardName: string;
  competitionType: string;
  /** Seminar or programme this award belongs to. */
  category: string;
  image: string;
  year: string;
  note: string;
}

export interface ThanksCredit {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Sponsor {
  id: string;
  name: string;
  level: string;
}

export type ArticleStatus = "draft" | "pending" | "published" | "rejected";

export type ArticleLocaleCopy = {
  title?: string;
  excerpt?: string;
  content?: string;
};

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author?: string;
  publishedByEmail?: string;
  category: string;
  date: string;
  coverImage?: string;
  featured?: boolean;
  readingTime?: string;
  tags?: string[];
  images?: CaptionedImage[];
  status?: ArticleStatus;
  assignedTo?: string;
  reviewNote?: string;
  translations?: Record<string, ArticleLocaleCopy>;
  style?: ArticleStyle;
  /** ISO datetime — hidden on the public site until this time. */
  publishAt?: string;
  /** ISO datetime — hidden on the public site after this time. */
  unpublishAt?: string;
}

export interface ArticleStyle {
  font?: "serif" | "sans" | "book" | "indic";
  size?: "sm" | "md" | "lg";
  spacing?: "tight" | "normal" | "relaxed";
  align?: "left" | "center" | "right" | "justify";
}

export interface ArticleAssignment {
  id: string;
  title: string;
  brief: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: string;
  articleId?: string;
  status: "assigned" | "writing" | "submitted" | "done";
  createdAt: string;
}

export interface CaptionedImage {
  src: string;
  caption?: string;
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  text: string;
  email?: string;
  productId?: string;
  verified?: boolean;
  hidden?: boolean;
  reply?: { text: string; date: string; author?: string };
}

export interface SeminarReview {
  id: string;
  name: string;
  event: string;
  rating: number;
  date: string;
  text: string;
  photo?: string;
  published: boolean;
}

export interface ProductMedia {
  type: "image" | "video";
  src?: string;
  label: string;
}

export interface PublisherInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface Book {
  id: string;
  title: string;
  slug: string;
  /** Old slugs kept after a rename so earlier product links redirect to the new URL. */
  previousSlugs?: string[];
  author: string;
  description: string;
  isbn?: string;
  sku?: string;
  /** Box or packaging printed as "Pack in" on the packaging slip. */
  packIn?: string;
  /** Packing instructions printed on the packaging slip. */
  packingNote?: string;
  /** Production batch number of the current stock. */
  batchNo?: string;
  /** Unique 10-digit product code generated by the admin. */
  productCode?: string;
  barcode?: string;
  /** Next serial for numbered stock labels (one label per unit). */
  stockLabelNext?: number;
  pages?: number;
  language?: string;
  /** Last saved in admin; newer copies win when two browsers publish the catalogue. */
  updatedAt?: string;
  binding?: string;
  price: number;
  originalPrice?: number;
  /** Shown under the price, e.g. "For Vaidyas and students". */
  priceNote?: string;
  currency: string;
  coverImage?: string;
  stock: number;
  availability: string;
  stockStatus?: "in_stock" | "out_of_stock";
  preorder?: { enabled: boolean; releaseDate?: string; limit?: number; note?: string };
  category: string;
  /** "other" = any non-book product: no ISBN, author, pages or publisher needed. */
  productType?: "book" | "other";
  /** Time-limited offer price; the regular price shows struck through while it runs. */
  offer?: { price: number; label?: string; startsAt?: string; endsAt?: string };
  /** Set on the shop copy while an offer runs. */
  offerLabel?: string;
  /** Per-product override of the shop rules shown on the product page. */
  policy?: { returns?: boolean; replacement?: boolean; cancellation?: boolean; note?: string };
  edition?: string;
  publishedYear?: number;
  publisher?: PublisherInfo;
  /** ISBN aside: other licences / registrations such as copyright no., FSSAI, AYUSH licence. */
  licenses?: { label: string; value: string }[];
  weightKg?: number;
  active?: boolean;
  /** ISO datetime — hidden on the public site until this time. */
  publishAt?: string;
  /** ISO datetime — hidden on the public site after this time. */
  unpublishAt?: string;
  createdAt?: string;
  openBoxDelivery?: boolean;
  rating?: number;
  reviewCount?: number;
  reviews?: Review[];
  media?: ProductMedia[];
  specifications?: { label: string; value: string }[];
  countryOfOrigin?: string;
  editor?: string;
  /** YYYY-MM-DD */
  publicationDate?: string;
  dimensions?: string;
  paperQuality?: string;
  printing?: string;
  subject?: string;
  audience?: string[];
  details?: {
    about?: string;
    learn?: string;
    highlights?: string;
    whoShouldRead?: string;
    chapters?: string;
    outcomes?: string;
    authorInfo?: string;
    publisherInfo?: string;
    editionInfo?: string;
  };
  contributors?: { name: string; role: string; bio?: string; photo?: string }[];
  expectedDelivery?: string;
  storePickupAvailable?: boolean;
  deliveryAvailable?: boolean;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  kind: "upload" | "youtube";
  src?: string;
  youtubeUrl?: string;
  poster?: string;
  duration?: string;
  featured?: boolean;
}

export interface ClinicHours {
  day: string;
  closed?: boolean;
  from?: string;
  to?: string;
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  doctor: string;
  specialization: string;
  city: string;
  address: string;
  phone: string;
  timings: string;
  weeklyHours?: ClinicHours[];
  appointmentUrl?: string;
  consultationFee?: string;
  about?: string;
  coordinates?: { lat: number; lng: number };
  services?: string[];
  photos?: CaptionedImage[];
  operatedBy?: string;
  mapLink?: string;
  placeId?: string;
  email?: string;
  doctors?: ClinicDoctor[];
}

export interface ClinicDoctor {
  id: string;
  name: string;
  qualification: string;
  specialization: string;
  experience?: string;
  timings?: string;
  photo?: string;
  bio?: string;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  href: string;
  priority: "high" | "normal";
  publishAt?: string;
  unpublishAt?: string;
}

export interface Notice {
  id: string;
  title: string;
  date: string;
  category: string;
  description: string;
  attachment?: string;
  fileName?: string;
  fileType?: string;
  pinned?: boolean;
  href: string;
  publishAt?: string;
  unpublishAt?: string;
}

export interface Flyer {
  id: string;
  title: string;
  event: string;
  date: string;
  image: string;
  href: string;
  cta: string;
  isDesktop?: boolean;
  isMobile?: boolean;
}

export interface SiteBanner {
  id: string;
  title: string;
  image: string;
  href: string;
}

export type AccountStatus = "active" | "disabled" | "banned";

export interface User {
  id: string;
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  /** Second number collected at signup — may match `phone`. */
  alternatePhone?: string;
  /** YYYY-MM-DD, collected at signup for birthday wishes. */
  birthDate?: string;
  /** Answers to admin-configured signup fields, keyed by field id. */
  extraFields?: Record<string, string>;
  accountId?: string;
  role?: UserRole;
  password?: string;
  /** True only after a password is set on this Foundation website (forgot-password, signup, or admin). */
  foundationPasswordSet?: boolean;
  /** @deprecated Sister-site passwords are never used on VGMF. */
  partnerPasswordSet?: boolean;
  staffRoleId?: string;
  status?: AccountStatus;
  statusReason?: string;
  address?: Omit<DeliveryAddress, "fullName" | "phone" | "email">;
  storeCredit?: number;
  createdAt?: string;
  createdBy?: string;
  lastDetailsSentAt?: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  /** Reply-To used when this staff member sends mail. Empty uses care@vaidyagogate.org. */
  replyToEmail?: string;
  partnerPortals?: PartnerPortal[];
}

export interface Certificate {
  certificateNumber: string;
  name: string;
  event: string;
  certificateType: string;
  eventDate: string;
  issueDate: string;
  signature: string;
  year?: number;
  eventSlug?: string;
}

export interface Registration {
  id: string;
  userId: string;
  eventId: string;
  status: "Pending" | "Approved" | "Rejected" | "Confirmed";
  paymentStatus: "Pending" | "Paid" | "Refunded";
  amount: number;
  currency: string;
  registeredAt: string;
}

export interface Ticket {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  qrCode: string;
  issuedAt: string;
  checkedIn: boolean;
}

export interface OrderItem {
  bookId: string;
  title: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  currency: string;
  sku?: string;
  /** Batch number of the product when the order was placed. */
  batchNo?: string;
  preorder?: boolean;
  /** Announced release date of a pre-order product when the order was placed. */
  releaseDate?: string;
}

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  email?: string;
  line1: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  countryCode?: string;
  /** Name shown when the customer taps the delivery pin. */
  place?: "home" | "office";
}

export interface CartItem {
  bookId: string;
  quantity: number;
}

export interface ShipmentEvent {
  id: string;
  title: string;
  detail?: string;
  /** Customer notice shown bold under the event (e.g. courier-delivered responsibility). */
  notice?: string;
  at: string;
  location?: string;
  agent?: { name?: string; phone?: string };
  otp?: string;
  reached?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  /** Login email this order belongs to, including when the delivery email is different. */
  accountEmail?: string;
  /** When the delivery-experience / product-rating email went out. */
  feedbackInvitedAt?: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  gst: number;
  shipping: number;
  /** Flat platform fee for this order. Omitted when the fee is switched off. */
  platformFee?: number;
  total: number;
  currency: string;
  paymentStatus: "Pending" | "Paid" | "Partially Paid" | "Failed" | "Refunded" | "Partially Refunded";
  status:
    | "Pending"
    | "Paid"
    | "Processing"
    | "Awaiting Confirmation"
    | "Ordered"
    | "Accepted"
    | "Packed"
    | "Ready to Ship"
    | "To Ship"
    | "Shipped"
    | "Out for Delivery"
    | "Delivered"
    | "Failed"
    | "Cancelled";
  channel?: "online" | "admin" | "pos" | "shipment";
  stockCommitted?: boolean;
  /** Pre-order items take stock only once the order is packed from real stock. */
  preorderStockCommitted?: boolean;
  storeCreditUsed?: number;
  /** Coupon or gift card applied at checkout. */
  promo?: { code: string; kind: "coupon" | "gift"; amount: number; label?: string };
  refunds?: RefundRecord[];
  returnShipment?: ReturnShipment;
  deliveryMode: "delivery" | "store_pickup";
  /** Set at the clinic counter when the customer is at the desk. */
  pickupArrivedAt?: string;
  deliveryAddress?: DeliveryAddress;
  eta?: string;
  /** Last day a store-pickup order is held at the counter. */
  pickupHoldUntil?: string;
  trackingId?: string;
  /** Secret shared with the customer as /track/{trackToken}. */
  trackToken?: string;
  courierName?: string;
  openBoxDelivery?: boolean;
  returnableDays?: number;
  replacementOf?: string;
  returnRequest?: ReturnRequest;
  /** Latest request sent to a senior reviewer, with their decision. */
  approval?: ApprovalRequest;
  plan?: OrderPlan;
  shipmentId?: string;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentLink?: { url: string; id?: string; provider: "razorpay" | "demo"; createdAt: string; amount?: number; expiresAt?: string };
  courierChoice?: CourierRate;
  /** Pre-order: the courier amount charged from the highest valid quote, and the package it was quoted for. */
  courierQuote?: { at: string; charged: number; highest: number; weightKg: number; parcel?: { length: number; breadth: number; height: number }; couriers: number };
  /** Amounts the desk added after ordering, e.g. a charge wrongly shown as free. */
  /** Shipping was left at ₹0; the courier charge is added once the parcel is packed and weighed. */
  shippingDue?: boolean;
  extraCharges?: { amount: number; reason: string; kind: "shipping" | "other"; at: string; by?: string }[];
  /** A store-pickup order switched to courier delivery once the customer pays only the courier charge. */
  courierUpgrade?: {
    amount: number;
    rate: CourierRate;
    link?: { url: string; id?: string; provider: "razorpay" | "demo"; createdAt: string };
    paidAt?: string;
    paymentRef?: string;
  };
  /** Pre-order paid as an advance now and the balance later. */
  preorderPayment?: {
    advance: number;
    balance: number;
    balanceWhen: "on_ready" | "before_dispatch";
    advancePaidAt?: string;
    balancePaidAt?: string;
    balanceRef?: string;
    /** Courier charge still to be worked out and added to the balance (pre-orders sent by courier). */
    shippingDue?: boolean;
    /** Courier charge added to the balance. */
    shipping?: number;
    link?: { url: string; id?: string; provider: "razorpay" | "demo"; createdAt: string };
  };
  /** Warehouse pick & pack: who picks, and what has been scanned. */
  pick?: {
    assignee: string;
    assignedAt: string;
    acceptedAt?: string;
    picked: Record<string, number>;
    pickedAt?: string;
    packScan: Record<string, number>;
    orderScannedAt?: string;
    packedAt?: string;
    /** Packer, when packing is given to someone other than the picker. */
    packer?: string;
    packerAssignedAt?: string;
    /** Picker step 1: the order code was scanned. */
    pickOrderScannedAt?: string;
    /** Which codes (product code, SKU, ISBN) were scanned for each item while picking / packing. */
    pickCodes?: Record<string, string[]>;
    packCodes?: Record<string, string[]>;
    /** Packer step 1: the box code on the slip was scanned. */
    boxScannedAt?: string;
    /** Numbered stock labels (…-U00001) scanned for this order; a label is locked to one order. */
    pickUnits?: string[];
    packUnits?: string[];
    /** Scan steps an admin skipped (pickOrder, pickItems, box, packOrder, packItems, photos). */
    bypassed?: string[];
    /** Packer confirmed the items match the order description. */
    matchedAt?: string;
  };
  weightKg?: number;
  /** Photos the packer took of the packed items, kept as proof. Desk only; never sent to customers. */
  packPhotos?: { url: string; at: string; by: string }[];
  /** Packed parcel for this shipment (single or bulk). Overrides the default box size in Shipping settings. */
  parcel?: { length: number; breadth: number; height: number; boxes: number; kind: "single" | "bulk"; contents?: string };
  createdBy?: string;
  cancelReason?: string;
  refundAmount?: number;
  /** What the customer had already paid when the desk last edited the order; the rest is due by payment link. */
  amountPaid?: number;
  /** `custom` is the tracking step id an admin-added status shows under. */
  history?: { at: string; status: string; note?: string; by?: string; custom?: string }[];
}

export interface RefundRecord {
  id: string;
  at: string;
  amount: number;
  destination: "original" | "store_credit";
  method?: string;
  reference?: string;
  note?: string;
  by?: string;
  gateway?: "razorpay";
  gatewayRefundId?: string;
  status?: "pending" | "processed" | "failed";
  /** Bank reference from the gateway's acquirer data (RRN, ARN or UTR). */
  rrn?: string;
  arn?: string;
  utr?: string;
  speed?: string;
  processedAt?: string;
  checkedAt?: string;
}

export interface ReturnShipment {
  provider: CourierRate["provider"];
  live: boolean;
  awb?: string;
  courierName?: string;
  providerOrderId?: string;
  providerShipmentId?: string;
  createdAt: string;
  note?: string;
  /** Label the customer prints and pastes on the parcel going back. */
  labelUrl?: string;
  /** Courier charge for the return, and who bears it. */
  charge?: number;
  chargePaidBy?: "foundation" | "customer";
  chargeLink?: { url: string; id?: string; provider: "razorpay" | "demo"; createdAt: string; amount?: number; expiresAt?: string };
  chargePaidAt?: string;
  chargeRef?: string;
  labelEmailedAt?: string;
}

export interface CourierRate {
  provider: "shiprocket" | "nimbuspost" | "ithink" | "shipyaari" | "goswift" | "tookan" | "tookan-parcel" | "shipday" | "local";
  courierId: string;
  courierName: string;
  rate: number;
  etaDays: number;
  /** The courier's own expected delivery date, when it gives one. */
  deliverBy?: string;
  live: boolean;
  cod?: boolean;
  lastMile?: "porter" | "shadowfax" | "flash";
  /** Courier rating out of 5 as reported by the aggregator. */
  rating?: number;
  /** The courier's own charge when the site shows a buffered rate to customers. */
  providerRate?: number;
  /** Packed weight sent to the aggregator (kg). */
  actualKg?: number;
  /** L×B×H ÷ this aggregator's divisor (kg). */
  volumetricKg?: number;
  volumetricDivisor?: number;
  /** Weight the courier bills, as the aggregator reports it (kg). */
  chargeWeightKg?: number;
  /** Billed slab differs from what the packed weight and size suggest; check before booking. */
  weightFlag?: string;
  /** A placeholder price, not a live quote; never used to charge customers. */
  estimate?: boolean;
  pickupBy?: string;
}

export type ReturnKind = "return" | "replacement";
export type ReturnEvidenceKind = "product" | "packaging" | "label" | "video";
/** refund: refund without sending the item back; return_refund: item comes back, then refund; replacement: free new copy. */
export type ReturnResolution = "refund" | "return_refund" | "replacement";

/** A cancellation, refund, return or replacement the desk sent to a senior reviewer. */
export interface ApprovalRequest {
  id: string;
  kind: "cancellation" | "refund" | "return" | "replacement";
  status: "Pending" | "Approved" | "Rejected";
  requestedAt: string;
  requestedBy: string;
  note?: string;
  amount?: number;
  destination?: "original" | "store_credit";
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  kind: ReturnKind;
  reason: string;
  requestedAt: string;
  source?: "customer" | "admin";
  status:
    | "Pending Review"
    | "Accepted"
    | "Rejected"
    | "Return Requested"
    | "Return Approved"
    | "Pickup Scheduled"
    | "Picked Up"
    | "Refunded"
    | "Replacement Created";
  returnCharges: number;
  refundAmount?: number;
  replacementOrderId?: string;
  images?: string[];
  note?: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  /** Set once the returned units are put back into stock. */
  restockedAt?: string;
  /** Products and quantities the customer chose; absent on older requests (whole order). */
  items?: { bookId: string; title: string; quantity: number; price: number }[];
  resolution?: ReturnResolution;
  evidence?: Partial<Record<ReturnEvidenceKind, string[]>>;
  /** Address for the replacement copy when it differs from the order address. */
  replacementAddress?: DeliveryAddress;
  /** How the item comes back: the Foundation books a pickup, or the customer ships it within the window. */
  returnMethod?: "pickup" | "self";
  /** What the desk found when the item came back; refunds, replacements and restock wait for this. */
  inspection?: { at: string; condition: "Good" | "Damaged" | "Wrong item" | "Missing"; note?: string; restock: boolean; by?: string };
  /** Claim the desk raised with the courier/aggregator, e.g. a wrong item came back. */
  claim?: { at: string; note: string; status: "Open" | "Settled" | "Rejected"; amount?: number; by?: string };
  stages: ShipmentEvent[];
}

export interface Application {
  applicationId: string;
  eventId: string;
  eventName: string;
  name: string;
  email: string;
  phone?: string;
  status: "Submitted" | "Under Review" | "Approved" | "Confirmed" | "Rejected";
  appliedAt: string;
}

export type UserRole = "customer" | "admin" | "coadmin" | "staff" | "doctor";

export interface FulfillmentLocation {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  active: boolean;
  /** Store pickup: who the customer meets, where to go and when. */
  contactName?: string;
  contactPhone?: string;
  mapUrl?: string;
  pickupHours?: string;
}

export interface PickupTimeslot {
  id: string;
  label: string;
  from: string;
  to: string;
}

export interface ApiKeys {
  googleMaps: string;
  googleAnalytics: string;
  shiprocket: string;
  razorpay: string;
  zeptomail: string;
}

export interface ProcessingTimeline {
  daysToPack: number;
  daysToPickup: number;
  daysInTransit: number;
  /** Hour (0–23) after which a new order starts processing the next business day. */
  orderCutoffHour?: number;
  storePickupEnabled?: boolean;
  pickupHoldingDays?: number;
}

export interface PackagingOption {
  id: string;
  label: string;
  description: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  twitter?: string;
  whatsapp?: string;
}

export interface ProductTextSizes {
  cardTitle?: number;
  cardMeta?: number;
  cardLanguage?: number;
  cardPrice?: number;
  pageLanguage?: number;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoText: string;
  logoUrl?: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  /** ISO time when maintenance ends automatically; empty keeps it on until switched off. */
  maintenanceUntil?: string;
  faviconUrl?: string;
  social: SocialLinks;
  apiKeys: ApiKeys;
  processing: ProcessingTimeline;
  packagingOptions: PackagingOption[];
  fulfillmentLocations: FulfillmentLocation[];
  pickupTimeslots: PickupTimeslot[];
  couriers: string[];
  outOfStockThreshold: number;
  liveChatEnabled?: boolean;
  liveChatOnline?: boolean;
  /** Seconds for one pass of the announcement ticker. */
  tickerSeconds?: number;
  /** Font sizes (px) for product cards and the product page. */
  productText?: ProductTextSizes;
  /** Slim strip above the header for shlokas, quotes or a line of welcome. */
  shlokaBar?: boolean;
  shlokas?: string[];
  /** Floating WhatsApp button for visitor questions. */
  queryButton?: boolean;
  queryNumber?: string;
  queryMessage?: string;
  /** Header and footer text, shape and extra navigation links. */
  chrome?: SiteChrome;
}

export interface SiteChromeLink {
  label: string;
  href: string;
  newTab?: boolean;
}

export interface SiteChrome {
  headerText?: string;
  headerTextHref?: string;
  headerStyle?: string;
  headerSticky?: boolean;
  footerText?: string;
  footerNote?: string;
  footerStyle?: string;
  navLinks?: SiteChromeLink[];
  footerLinks?: SiteChromeLink[];
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  active: boolean;
}

export interface ProductOverride {
  bookId: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  barcode?: string;
  manufacturer?: string;
  manufactureInfo?: string;
  description?: string;
  specifications?: { label: string; value: string }[];
  category?: string;
  dimensions?: { weight: number; width: number; height: number; depth: number };
  active: boolean;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  courier: string;
  awb: string;
  charges: number;
  toAddress: DeliveryAddress & { orderId?: string };
  items: { sku: string; title: string; quantity: number; barcode?: string }[];
  status: "Booked" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered" | "Failed";
  generatedAt: string;
  pickedUpAt?: string;
  provider?: CourierRate["provider"];
  live?: boolean;
  /** Set when the parcel went with a courier outside the connected APIs (see src/lib/couriers.ts). */
  directCourier?: string;
  /** Set when an order goes as several shipments: 1, 2, … */
  part?: number;
  providerOrderId?: string;
  providerShipmentId?: string;
  labelUrl?: string;
  /** Sort code returned by Shiprocket, Nimbuspost, or Shipyaari. */
  routingCode?: string;
  destinationHub?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  pickupScheduledFor?: string;
  pickupSlot?: string;
  pickupReference?: string;
  courierCost?: number;
  customerPaid?: number;
  tracking?: { at: string; status: string; location?: string }[];
  trackingUrl?: string;
  /** Promised arrival from the courier that booked this shipment. */
  expectedBy?: string;
  note?: string;
  agentName?: string;
  agentPhone?: string;
  agentLat?: number;
  agentLng?: number;
  /** pickup = rider is going to the store. delivery = rider is going to the customer. */
  agentLeg?: "pickup" | "delivery";
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  deliveryOtp?: string;
}

export interface SupportMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  receivedAt: string;
  status: "New" | "Replied";
  reply?: string;
  repliedAt?: string;
}

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  body: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  createdAt: string;
  updatedAt: string;
  portal?: "public" | "staff" | "customer" | "admin";
  assignedTo?: string;
  userId?: string;
  chatThreadId?: string;
  responses: { at: string; from: string; text: string }[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  active: boolean;
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  template: string;
  status: "Queued" | "Sent" | "Delivered" | "Failed";
  sentAt: string;
  channel?: "email" | "whatsapp" | "sms";
  provider?: string;
  live?: boolean;
  error?: string;
  providerMessageId?: string;
  updatedAt?: string;
  replyTo?: string;
  images?: string[];
  html?: boolean;
  fromName?: string;
}

export interface OrderPlan {
  packedBy: string;
  pickedUpBy: string;
  shippedBy: string;
  deliveredBy: string;
  packagingId: string;
  packagingLabel: string;
}