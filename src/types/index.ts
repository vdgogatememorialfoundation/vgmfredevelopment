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

export type EventMode = "Online" | "Offline" | "Hybrid";

export interface Event {
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
}

export interface Speaker {
  id: string;
  name: string;
  designation: string;
  topic: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  description?: string;
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

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author?: string;
  category: string;
  date: string;
  coverImage?: string;
  featured?: boolean;
  readingTime?: string;
  tags?: string[];
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  text: string;
}

export interface ProductMedia {
  type: "image" | "video";
  src?: string;
  label: string;
}

export interface Book {
  id: string;
  title: string;
  slug: string;
  author: string;
  description: string;
  isbn?: string;
  sku?: string;
  pages?: number;
  price: number;
  originalPrice?: number;
  currency: string;
  coverImage?: string;
  stock: number;
  availability: string;
  category: string;
  edition?: string;
  publishedYear?: number;
  seller?: string;
  openBoxDelivery?: boolean;
  rating?: number;
  reviewCount?: number;
  reviews?: Review[];
  media?: ProductMedia[];
  specifications?: { label: string; value: string }[];
  countryOfOrigin?: string;
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
  consultationFee?: string;
  about?: string;
  coordinates?: { lat: number; lng: number };
  services?: string[];
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  href: string;
  priority: "high" | "normal";
}

export interface Notice {
  id: string;
  title: string;
  date: string;
  category: string;
  description: string;
  attachment?: string;
  href: string;
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

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  accountId?: string;
  role?: UserRole;
  sellerId?: string;
  password?: string;
}

export interface Certificate {
  certificateNumber: string;
  name: string;
  event: string;
  certificateType: string;
  eventDate: string;
  issueDate: string;
  signature: string;
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
}

export interface CartItem {
  bookId: string;
  quantity: number;
}

export interface ShipmentEvent {
  id: string;
  title: string;
  detail?: string;
  at: string;
  location?: string;
  agent?: { name?: string; phone?: string };
  otp?: string;
  reached?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  gst: number;
  shipping: number;
  total: number;
  currency: string;
  paymentStatus: "Pending" | "Paid" | "Failed" | "Refunded";
  status:
    | "Pending"
    | "Paid"
    | "Processing"
    | "Ordered"
    | "Packed"
    | "Shipped"
    | "Out for Delivery"
    | "Delivered"
    | "Cancelled";
  deliveryMode: "delivery" | "store_pickup";
  deliveryAddress?: DeliveryAddress;
  eta?: string;
  trackingId?: string;
  courierName?: string;
  openBoxDelivery?: boolean;
  returnableDays?: number;
  replacementOf?: string;
  returnRequest?: ReturnRequest;
  sellerId?: string;
  plan?: OrderPlan;
  shipmentId?: string;
}

export type ReturnKind = "return" | "replacement";

export interface ReturnRequest {
  id: string;
  orderId: string;
  kind: ReturnKind;
  reason: string;
  requestedAt: string;
  status:
    | "Return Requested"
    | "Return Approved"
    | "Pickup Scheduled"
    | "Picked Up"
    | "Refunded"
    | "Replacement Created";
  returnCharges: number;
  refundAmount?: number;
  replacementOrderId?: string;
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

export type UserRole = "customer" | "admin" | "staff" | "seller";

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
}

export interface PickupTimeslot {
  id: string;
  label: string;
  from: string;
  to: string;
}

export interface ApiKeys {
  googleMaps: string;
  shiprocket: string;
  razorpay: string;
  zeptomail: string;
}

export interface ProcessingTimeline {
  daysToPack: number;
  daysToPickup: number;
  daysInTransit: number;
}

export interface PackagingOption {
  id: string;
  label: string;
  description: string;
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
  apiKeys: ApiKeys;
  processing: ProcessingTimeline;
  packagingOptions: PackagingOption[];
  fulfillmentLocations: FulfillmentLocation[];
  pickupTimeslots: PickupTimeslot[];
  couriers: string[];
  outOfStockThreshold: number;
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
  sellerId?: string;
  courier: string;
  awb: string;
  charges: number;
  toAddress: DeliveryAddress & { orderId?: string };
  items: { sku: string; title: string; quantity: number; barcode?: string }[];
  status: "Booked" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered";
  generatedAt: string;
  pickedUpAt?: string;
}

export interface SellerKyc {
  status: "Pending" | "Submitted" | "Under Review" | "Verified";
  docs: { kind: string; fileName: string; submittedAt: string }[];
  submittedAt?: string;
}

export interface SellerAgreement {
  status: "Pending" | "Sent" | "Signed";
  sentAt?: string;
  signedAt?: string;
}

export interface Seller {
  id: string;
  brandName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  email: string;
  emailOtp?: string;
  emailVerified: boolean;
  category: string;
  description: string;
  kyc: SellerKyc;
  agreement: SellerAgreement;
  status:
    | "Onboarding"
    | "OTP Pending"
    | "KYC Pending"
    | "Under Review"
    | "Active"
    | "Rejected";
  payoutsReceived: number;
  createdAt: string;
  accountId?: string;
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
  subject: string;
  body: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  createdAt: string;
  updatedAt: string;
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
  status: "Sent";
  sentAt: string;
}

export interface OrderPlan {
  packedBy: string;
  pickedUpBy: string;
  shippedBy: string;
  deliveredBy: string;
  packagingId: string;
  packagingLabel: string;
}