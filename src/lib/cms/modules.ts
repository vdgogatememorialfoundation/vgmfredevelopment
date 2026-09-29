export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "image"
  | "email"
  | "date"
  | "number"
  | "select"
  | "boolean"
  | "tags"
  | "json";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export type GroupKey =
  | "website"
  | "events"
  | "certificates"
  | "commerce"
  | "payments"
  | "support"
  | "delivery"
  | "communication"
  | "settings";

export const GROUP_LABELS: Record<GroupKey, string> = {
  website: "Website & CMS",
  events: "Events",
  certificates: "Certificates",
  commerce: "Commerce",
  payments: "Payments & Donations",
  support: "Support",
  delivery: "Delivery Partners",
  communication: "Communication",
  settings: "Settings",
};

export interface ModuleDef {
  key: string;
  label: string;
  group: GroupKey;
  description: string;
  kind: "collection" | "settings";
  /** Storage collection (collection modules) or settings key (settings modules). */
  store: string;
  fields: FieldDef[];
  columns?: string[];
  titleField?: string;
  statuses?: string[];
  filter?: { status?: string; field?: string; value?: string };
  sitePath?: string;
  itemPath?: (data: Record<string, unknown>) => string | undefined;
  slugFrom?: string;
  startInCreate?: boolean;
  createLabel?: string;
  publicSubmissions?: boolean;
}

const PUBLISH = ["published", "draft"];

const f = (
  name: string,
  label: string,
  type: FieldType = "text",
  extra: Partial<FieldDef> = {}
): FieldDef => ({ name, label, type, ...extra });

const BANNER_FIELDS: FieldDef[] = [
  f("title", "Headline", "text", { required: true }),
  f("eyebrow", "Eyebrow / small label"),
  f("subtitle", "Sub-heading", "textarea"),
  f("image", "Image URL", "image", { help: "Paste an image URL (JPG/PNG/WebP). Leave empty to use the decorative Ayurvedic artwork." }),
  f("placement", "Placement", "select", { options: ["home-slider", "home-display", "shop-top", "promo-strip"], required: true }),
  f("theme", "Colour theme", "select", { options: ["saffron", "turmeric", "leaf", "lotus", "peacock"] }),
  f("ctaLabel", "Button label"),
  f("ctaHref", "Button link", "url"),
  f("secondaryLabel", "Second button label"),
  f("secondaryHref", "Second button link", "url"),
  f("startDate", "Show from", "date"),
  f("endDate", "Show until", "date"),
];

const EVENT_FIELDS: FieldDef[] = [
  f("name", "Event name", "text", { required: true }),
  f("slug", "URL slug", "text", { help: "Auto-generated from the name if empty." }),
  f("shortDescription", "Short description", "textarea", { required: true }),
  f("description", "Full description", "textarea"),
  f("bannerUrl", "Banner image URL", "image"),
  f("startDate", "Start date", "date", { required: true }),
  f("endDate", "End date", "date", { required: true }),
  f("venue", "Venue"),
  f("city", "City"),
  f("mode", "Mode", "select", { options: ["Offline", "Online", "Hybrid"] }),
  f("eventType", "Event type", "select", { options: ["Seminar", "Conference", "Workshop", "Webinar", "Fellowship", "Training", "Other Foundation Events"] }),
  f("registrationStart", "Registration opens", "date"),
  f("registrationEnd", "Registration closes", "date"),
  f("fee", "Fee (₹)", "number"),
  f("currency", "Currency", "text", { placeholder: "INR" }),
  f("capacity", "Capacity", "number"),
  f("registrationStatus", "Registration status", "select", { options: ["Open", "Closing Soon", "Closed", "Waitlist"] }),
  f("registrationUrl", "External registration link", "url", { help: "Optional. If empty, visitors register on this website." }),
  f("highlights", "Highlights", "tags", { help: "Comma separated." }),
  f("terms", "Terms", "tags", { help: "Comma separated." }),
  f("faqs", "Event FAQs", "json", { help: 'JSON list, e.g. [{"question":"...","answer":"..."}]' }),
  f("sponsors", "Sponsors", "json", { help: 'JSON list, e.g. [{"id":"s1","name":"...","level":"Gold"}]' }),
];

const PRODUCT_FIELDS: FieldDef[] = [
  f("title", "Title", "text", { required: true }),
  f("slug", "URL slug"),
  f("author", "Author", "text", { required: true }),
  f("description", "Description", "textarea"),
  f("price", "Price (₹)", "number", { required: true }),
  f("originalPrice", "MRP (₹)", "number"),
  f("currency", "Currency", "text", { placeholder: "INR" }),
  f("coverImage", "Cover image URL", "image"),
  f("category", "Category"),
  f("stock", "Stock quantity", "number"),
  f("availability", "Availability", "select", { options: ["In Stock", "Limited Stock", "Out of Stock", "Pre-order"] }),
  f("sku", "SKU"),
  f("isbn", "ISBN"),
  f("pages", "Pages", "number"),
  f("edition", "Edition"),
  f("publishedYear", "Published year", "number"),
  f("seller", "Seller"),
  f("rating", "Rating (0-5)", "number"),
  f("reviewCount", "Review count", "number"),
];

const PAYMENT_FIELDS: FieldDef[] = [
  f("reference", "Transaction reference", "text", { required: true }),
  f("payer", "Payer name", "text", { required: true }),
  f("email", "Email", "email"),
  f("amount", "Amount (₹)", "number", { required: true }),
  f("method", "Method", "select", { options: ["UPI", "Card", "Net Banking", "Cash", "Bank Transfer", "Cheque"] }),
  f("purpose", "Purpose", "select", { options: ["Order", "Event", "Donation", "Other"] }),
  f("date", "Date", "date"),
  f("notes", "Notes", "textarea"),
];
const PAYMENT_STATUSES = ["Success", "Pending", "Failed", "Refunded"];

const SHIPMENT_FIELDS: FieldDef[] = [
  f("orderNumber", "Order number", "text", { required: true }),
  f("awb", "AWB / tracking no."),
  f("courier", "Courier"),
  f("partner", "Delivery partner"),
  f("destination", "Destination city"),
  f("eta", "Expected delivery", "date"),
  f("lastUpdate", "Latest update", "textarea"),
];
const SHIPMENT_STATUSES = ["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Exception", "RTO"];

const ORDER_FIELDS: FieldDef[] = [
  f("orderNumber", "Order number", "text", { required: true }),
  f("customerName", "Customer", "text", { required: true }),
  f("email", "Email", "email"),
  f("phone", "Phone"),
  f("total", "Total (₹)", "number"),
  f("paymentMethod", "Payment method"),
  f("address", "Delivery address", "textarea"),
  f("items", "Items", "json", { help: "List of items (JSON)." }),
];
const ORDER_STATUSES = ["Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned"];

const SELLER_FIELDS: FieldDef[] = [
  f("name", "Seller name", "text", { required: true }),
  f("business", "Business name"),
  f("email", "Email", "email"),
  f("phone", "Phone"),
  f("gst", "GSTIN"),
  f("city", "City"),
  f("commission", "Commission %", "number"),
];
const SELLER_STATUSES = ["Pending", "Active", "Suspended"];

const CERT_FIELDS: FieldDef[] = [
  f("certificateNumber", "Certificate number", "text", { required: true, placeholder: "VGMF-CERT-2026-0001" }),
  f("name", "Recipient name", "text", { required: true }),
  f("event", "Event / programme", "text", { required: true }),
  f("certificateType", "Certificate type", "select", { options: ["Participation", "Merit", "Completion", "Speaker", "Organiser", "Fellowship"] }),
  f("eventDate", "Event date", "date"),
  f("issueDate", "Issue date", "date"),
  f("signature", "Signed by"),
];

const DELIVERY_PARTNER_FIELDS: FieldDef[] = [
  f("name", "Partner name", "text", { required: true }),
  f("contactPerson", "Contact person"),
  f("email", "Email", "email"),
  f("phone", "Phone"),
  f("coverage", "Coverage (cities / pincodes)", "textarea"),
  f("rate", "Rate per shipment (₹)", "number"),
];

const col = (...names: string[]) => names;

export const MODULES: ModuleDef[] = [
  // Website & CMS
  { key: "banners", label: "Banners & Slideshow", group: "website", kind: "collection", store: "banners", description: "Homepage slideshow, display banners and shop banners.", fields: BANNER_FIELDS, columns: col("title", "placement", "theme", "endDate"), titleField: "title", statuses: PUBLISH, sitePath: "/", createLabel: "Add banner" },
  { key: "announcements", label: "Announcements", group: "website", kind: "collection", store: "announcements", description: "Scrolling ticker, homepage announcements and the Announcements page.", fields: [f("title", "Title", "text", { required: true }), f("description", "Description", "textarea"), f("date", "Date", "date"), f("category", "Category"), f("href", "Link", "url"), f("priority", "Priority", "select", { options: ["normal", "high"] })], columns: col("title", "category", "date", "priority"), titleField: "title", statuses: PUBLISH, sitePath: "/announcements" },
  { key: "notices", label: "Notice Board", group: "website", kind: "collection", store: "notices", description: "Official notices shown on the homepage and the Notices page.", fields: [f("title", "Title", "text", { required: true }), f("date", "Date", "date"), f("category", "Category"), f("description", "Description", "textarea"), f("attachment", "Attachment URL", "url"), f("href", "Link", "url")], columns: col("title", "category", "date"), titleField: "title", statuses: PUBLISH, sitePath: "/notices" },
  { key: "flyers", label: "Flyers", group: "website", kind: "collection", store: "flyers", description: "Event flyers on the homepage.", fields: [f("title", "Title", "text", { required: true }), f("event", "Event"), f("date", "Date", "date"), f("image", "Flyer image URL", "image"), f("href", "Link", "url"), f("cta", "Button label"), f("isDesktop", "Show on desktop", "boolean"), f("isMobile", "Show on mobile", "boolean")], columns: col("title", "event", "date"), titleField: "title", statuses: PUBLISH, sitePath: "/" },
  { key: "articles", label: "Articles", group: "website", kind: "collection", store: "articles", description: "Articles and insights on /articles.", fields: [f("title", "Title", "text", { required: true }), f("slug", "URL slug"), f("excerpt", "Excerpt", "textarea", { required: true }), f("content", "Content", "textarea", { help: "Separate paragraphs with a blank line." }), f("author", "Author"), f("category", "Category"), f("date", "Date", "date"), f("coverImage", "Cover image URL", "image"), f("readingTime", "Reading time", "text", { placeholder: "6 min read" }), f("featured", "Featured", "boolean"), f("tags", "Tags", "tags")], columns: col("title", "category", "author", "date"), titleField: "title", statuses: PUBLISH, slugFrom: "title", sitePath: "/articles", itemPath: (d) => (d.slug ? `/articles/${d.slug}` : undefined), createLabel: "New article" },
  { key: "videos", label: "Videos", group: "website", kind: "collection", store: "videos", description: "Video library on /videos.", fields: [f("title", "Title", "text", { required: true }), f("description", "Description", "textarea"), f("date", "Date", "date"), f("category", "Category", "select", { options: ["Foundation", "Seminars", "Lectures", "Workshops", "Clinical", "Interviews"] }), f("kind", "Source", "select", { options: ["youtube", "upload"] }), f("youtubeUrl", "YouTube URL", "url"), f("src", "Video file URL", "url"), f("poster", "Poster image URL", "image"), f("duration", "Duration"), f("featured", "Featured", "boolean")], columns: col("title", "category", "date", "duration"), titleField: "title", statuses: PUBLISH, sitePath: "/videos" },
  { key: "gallery", label: "Photo Gallery", group: "website", kind: "collection", store: "gallery", description: "Photos on the Gallery page.", fields: [f("title", "Caption", "text", { required: true }), f("category", "Category", "select", { options: ["Seminars", "Education", "Outreach", "Research", "Heritage"] }), f("image", "Photo URL", "image"), f("span", "Tile size", "select", { options: ["", "lg:col-span-2", "lg:row-span-2", "lg:col-span-2 lg:row-span-2"] })], columns: col("title", "category"), titleField: "title", statuses: PUBLISH, sitePath: "/gallery" },
  { key: "testimonials", label: "Testimonials", group: "website", kind: "collection", store: "testimonials", description: "Voices from the community on the homepage.", fields: [f("quote", "Quote", "textarea", { required: true }), f("name", "Name", "text", { required: true }), f("role", "Role / city")], columns: col("name", "role"), titleField: "name", statuses: PUBLISH, sitePath: "/" },
  { key: "partners", label: "Partners", group: "website", kind: "collection", store: "partners", description: "Institutional partners strip on the homepage.", fields: [f("name", "Partner name", "text", { required: true }), f("url", "Website", "url")], columns: col("name"), titleField: "name", statuses: PUBLISH, sitePath: "/" },
  { key: "faqs", label: "FAQs", group: "website", kind: "collection", store: "faqs", description: "Questions on the FAQ page and homepage.", fields: [f("question", "Question", "text", { required: true }), f("answer", "Answer", "textarea", { required: true }), f("category", "Category", "select", { options: ["Events & Registrations", "Certificates", "Clinics", "Shop & Orders", "Support & Donations"] }), f("showOnHome", "Show on homepage", "boolean")], columns: col("question", "category"), titleField: "question", statuses: PUBLISH, sitePath: "/faq" },
  { key: "clinics", label: "Clinics", group: "website", kind: "collection", store: "clinics", description: "Clinic directory on /clinics.", fields: [f("name", "Clinic name", "text", { required: true }), f("slug", "URL slug"), f("doctor", "Doctor", "text", { required: true }), f("specialization", "Specialisation"), f("city", "City", "text", { required: true }), f("address", "Address", "textarea"), f("phone", "Phone"), f("timings", "Timings"), f("consultationFee", "Consultation fee"), f("about", "About", "textarea"), f("services", "Services", "tags")], columns: col("name", "doctor", "city"), titleField: "name", statuses: PUBLISH, slugFrom: "name", sitePath: "/clinics", itemPath: (d) => (d.slug ? `/clinics/${d.slug}` : undefined) },
  { key: "media", label: "Media Library", group: "website", kind: "collection", store: "media", description: "Image, video and document links reusable across the site.", fields: [f("title", "Title", "text", { required: true }), f("url", "File URL", "url", { required: true }), f("type", "Type", "select", { options: ["image", "video", "document"] }), f("alt", "Alt text"), f("tags", "Tags", "tags")], columns: col("title", "type", "url"), titleField: "title", statuses: PUBLISH },

  // Events
  { key: "events", label: "All Events", group: "events", kind: "collection", store: "events", description: "Seminars, workshops and programmes on /events.", fields: EVENT_FIELDS, columns: col("name", "startDate", "city", "registrationStatus"), titleField: "name", statuses: PUBLISH, slugFrom: "name", sitePath: "/events", itemPath: (d) => (d.slug ? `/events/${d.slug}` : undefined), createLabel: "Create event" },
  { key: "events-create", label: "Create Event", group: "events", kind: "collection", store: "events", description: "Publish a new event to the website.", fields: EVENT_FIELDS, columns: col("name", "startDate", "city", "registrationStatus"), titleField: "name", statuses: PUBLISH, slugFrom: "name", sitePath: "/events", itemPath: (d) => (d.slug ? `/events/${d.slug}` : undefined), startInCreate: true, createLabel: "Create event" },
  { key: "event-registrations", label: "Registrations", group: "events", kind: "collection", store: "event-registrations", description: "Registrations submitted from event pages.", fields: [f("registrationId", "Registration ID"), f("event", "Event", "text", { required: true }), f("name", "Name", "text", { required: true }), f("email", "Email", "email", { required: true }), f("phone", "Phone"), f("city", "City"), f("amount", "Amount (₹)", "number"), f("paymentStatus", "Payment", "select", { options: ["Pending", "Paid", "Waived", "Refunded"] }), f("notes", "Notes", "textarea")], columns: col("registrationId", "name", "event", "paymentStatus"), titleField: "name", statuses: ["Registered", "Confirmed", "Waitlist", "Cancelled", "Attended"], publicSubmissions: true },
  { key: "applications", label: "Applications", group: "events", kind: "collection", store: "applications", description: "Fellowship and programme applications, trackable on /application-status.", fields: [f("applicationId", "Application ID", "text", { required: true }), f("eventName", "Programme / event", "text", { required: true }), f("name", "Applicant", "text", { required: true }), f("email", "Email", "email"), f("phone", "Phone"), f("appliedAt", "Applied on", "date"), f("notes", "Reviewer notes", "textarea")], columns: col("applicationId", "name", "eventName", "appliedAt"), titleField: "name", statuses: ["Submitted", "Under Review", "Approved", "Confirmed", "Rejected"], publicSubmissions: true, sitePath: "/application-status" },
  { key: "speakers", label: "Speakers", group: "events", kind: "collection", store: "speakers", description: "Speakers shown on event pages (matched by event slug).", fields: [f("eventSlug", "Event slug", "text", { required: true }), f("name", "Name", "text", { required: true }), f("designation", "Designation"), f("topic", "Topic")], columns: col("name", "eventSlug", "topic"), titleField: "name", statuses: PUBLISH, sitePath: "/events" },
  { key: "schedule", label: "Schedule", group: "events", kind: "collection", store: "schedule", description: "Session schedule shown on event pages.", fields: [f("eventSlug", "Event slug", "text", { required: true }), f("time", "Time", "text", { required: true, placeholder: "Day 1 · 10:00" }), f("title", "Session title", "text", { required: true }), f("description", "Description", "textarea")], columns: col("time", "title", "eventSlug"), titleField: "title", statuses: PUBLISH, sitePath: "/events" },
  { key: "event-payments", label: "Event Payments", group: "events", kind: "collection", store: "payments", description: "Payments received against events.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { field: "purpose", value: "Event" } },
  { key: "event-tickets", label: "Tickets", group: "events", kind: "collection", store: "event-tickets", description: "Entry passes issued to participants.", fields: [f("ticketNumber", "Ticket number", "text", { required: true }), f("event", "Event", "text", { required: true }), f("holder", "Holder", "text", { required: true }), f("email", "Email", "email"), f("type", "Type", "select", { options: ["Delegate", "Student", "Speaker", "Guest", "Volunteer"] })], columns: col("ticketNumber", "holder", "event", "type"), titleField: "ticketNumber", statuses: ["Issued", "Checked In", "Cancelled"] },
  { key: "attendance", label: "Attendance", group: "events", kind: "collection", store: "attendance", description: "Session-wise attendance records.", fields: [f("event", "Event", "text", { required: true }), f("name", "Participant", "text", { required: true }), f("registrationId", "Registration ID"), f("session", "Session"), f("date", "Date", "date")], columns: col("name", "event", "session", "date"), titleField: "name", statuses: ["Present", "Absent", "Late"] },
  { key: "event-certificates", label: "Event Certificates", group: "events", kind: "collection", store: "certificates", description: "Certificates issued for events — verifiable on the website.", fields: CERT_FIELDS, columns: col("certificateNumber", "name", "event", "issueDate"), titleField: "certificateNumber", statuses: ["valid", "revoked"], sitePath: "/certificate-verification", itemPath: (d) => (d.certificateNumber ? `/certificate-verification/${d.certificateNumber}` : undefined) },

  // Certificates
  { key: "certificates", label: "Certificates", group: "certificates", kind: "collection", store: "certificates", description: "All certificates. Valid ones are verifiable on /certificate-verification.", fields: CERT_FIELDS, columns: col("certificateNumber", "name", "event", "certificateType", "issueDate"), titleField: "certificateNumber", statuses: ["valid", "revoked"], sitePath: "/certificate-verification", itemPath: (d) => (d.certificateNumber ? `/certificate-verification/${d.certificateNumber}` : undefined), createLabel: "Issue certificate" },
  { key: "certificates-issue", label: "Issue Certificate", group: "certificates", kind: "collection", store: "certificates", description: "Issue a new certificate. It becomes verifiable immediately.", fields: CERT_FIELDS, columns: col("certificateNumber", "name", "event", "issueDate"), titleField: "certificateNumber", statuses: ["valid", "revoked"], sitePath: "/certificate-verification", itemPath: (d) => (d.certificateNumber ? `/certificate-verification/${d.certificateNumber}` : undefined), startInCreate: true, createLabel: "Issue certificate" },
  { key: "certificates-reissue", label: "Reissue Certificate", group: "certificates", kind: "collection", store: "certificates", description: "Find a certificate, correct details or revoke it.", fields: CERT_FIELDS, columns: col("certificateNumber", "name", "event", "issueDate"), titleField: "certificateNumber", statuses: ["valid", "revoked"], itemPath: (d) => (d.certificateNumber ? `/certificate-verification/${d.certificateNumber}` : undefined) },
  { key: "certificates-verification", label: "Verification", group: "certificates", kind: "collection", store: "certificates", description: "Search any certificate number exactly as the public verification page does.", fields: CERT_FIELDS, columns: col("certificateNumber", "name", "event", "issueDate"), titleField: "certificateNumber", statuses: ["valid", "revoked"], sitePath: "/certificate-verification", itemPath: (d) => (d.certificateNumber ? `/certificate-verification/${d.certificateNumber}` : undefined) },

  // Commerce
  { key: "products", label: "Products", group: "commerce", kind: "collection", store: "products", description: "Books and publications in the website shop.", fields: PRODUCT_FIELDS, columns: col("title", "author", "price", "stock", "availability"), titleField: "title", statuses: PUBLISH, slugFrom: "title", sitePath: "/shop", itemPath: (d) => (d.slug ? `/shop/${d.slug}` : undefined), createLabel: "Add product" },
  { key: "inventory", label: "Inventory", group: "commerce", kind: "collection", store: "products", description: "Stock levels and availability for every shop product.", fields: PRODUCT_FIELDS, columns: col("title", "sku", "stock", "availability"), titleField: "title", statuses: PUBLISH, sitePath: "/shop", itemPath: (d) => (d.slug ? `/shop/${d.slug}` : undefined) },
  { key: "orders", label: "Orders", group: "commerce", kind: "collection", store: "orders", description: "Orders placed through the website checkout.", fields: ORDER_FIELDS, columns: col("orderNumber", "customerName", "total", "paymentMethod"), titleField: "orderNumber", statuses: ORDER_STATUSES, publicSubmissions: true },
  { key: "orders-create", label: "Create Order", group: "commerce", kind: "collection", store: "orders", description: "Record an offline / phone order.", fields: ORDER_FIELDS, columns: col("orderNumber", "customerName", "total"), titleField: "orderNumber", statuses: ORDER_STATUSES, startInCreate: true, createLabel: "Create order" },
  { key: "shipments", label: "Shipments", group: "commerce", kind: "collection", store: "shipments", description: "Shipments, AWB numbers and delivery status.", fields: SHIPMENT_FIELDS, columns: col("orderNumber", "awb", "courier", "destination", "eta"), titleField: "orderNumber", statuses: SHIPMENT_STATUSES, createLabel: "Create shipment" },
  { key: "shipments-create", label: "Create Shipment", group: "commerce", kind: "collection", store: "shipments", description: "Create a shipment for an order.", fields: SHIPMENT_FIELDS, columns: col("orderNumber", "awb", "courier", "destination"), titleField: "orderNumber", statuses: SHIPMENT_STATUSES, startInCreate: true, createLabel: "Create shipment" },
  { key: "shipments-tracking", label: "Tracking", group: "commerce", kind: "collection", store: "shipments", description: "Latest tracking updates across shipments.", fields: SHIPMENT_FIELDS, columns: col("awb", "courier", "lastUpdate", "eta"), titleField: "orderNumber", statuses: SHIPMENT_STATUSES },
  { key: "shipments-exceptions", label: "Exceptions", group: "commerce", kind: "collection", store: "shipments", description: "Shipments with delivery exceptions.", fields: SHIPMENT_FIELDS, columns: col("orderNumber", "awb", "courier", "lastUpdate"), titleField: "orderNumber", statuses: SHIPMENT_STATUSES, filter: { status: "Exception" } },
  { key: "manifests", label: "Manifests", group: "commerce", kind: "collection", store: "manifests", description: "Courier pickup manifests.", fields: [f("manifestNo", "Manifest no.", "text", { required: true }), f("courier", "Courier"), f("date", "Pickup date", "date"), f("count", "Shipments", "number"), f("notes", "Notes", "textarea")], columns: col("manifestNo", "courier", "date", "count"), titleField: "manifestNo", statuses: ["Open", "Handed Over", "Closed"] },
  { key: "sellers", label: "Sellers", group: "commerce", kind: "collection", store: "sellers", description: "Marketplace sellers and publishers.", fields: SELLER_FIELDS, columns: col("name", "business", "city", "commission"), titleField: "name", statuses: SELLER_STATUSES },
  { key: "seller-applications", label: "Seller Applications", group: "commerce", kind: "collection", store: "sellers", description: "Sellers awaiting approval.", fields: SELLER_FIELDS, columns: col("name", "business", "email", "city"), titleField: "name", statuses: SELLER_STATUSES, filter: { status: "Pending" } },
  { key: "seller-products", label: "Seller Products", group: "commerce", kind: "collection", store: "products", description: "Products listed with their seller.", fields: PRODUCT_FIELDS, columns: col("title", "seller", "price", "stock"), titleField: "title", statuses: PUBLISH, sitePath: "/shop" },
  { key: "commerce-payments", label: "Order Payments", group: "commerce", kind: "collection", store: "payments", description: "Payments received for shop orders.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "method", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { field: "purpose", value: "Order" } },

  // Payments & donations
  { key: "payments", label: "Transactions", group: "payments", kind: "collection", store: "payments", description: "Every payment across orders, events and donations.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "purpose", "date"), titleField: "reference", statuses: PAYMENT_STATUSES },
  { key: "payments-successful", label: "Successful Payments", group: "payments", kind: "collection", store: "payments", description: "Completed payments.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "purpose", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { status: "Success" } },
  { key: "payments-pending", label: "Pending Payments", group: "payments", kind: "collection", store: "payments", description: "Payments awaiting confirmation.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "purpose", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { status: "Pending" } },
  { key: "payments-failed", label: "Failed Payments", group: "payments", kind: "collection", store: "payments", description: "Failed payment attempts.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "purpose", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { status: "Failed" } },
  { key: "payments-refunds", label: "Refunds", group: "payments", kind: "collection", store: "payments", description: "Refunded payments.", fields: PAYMENT_FIELDS, columns: col("reference", "payer", "amount", "purpose", "date"), titleField: "reference", statuses: PAYMENT_STATUSES, filter: { status: "Refunded" } },
  { key: "reconciliation", label: "Reconciliation", group: "payments", kind: "collection", store: "reconciliation", description: "Match gateway settlements with recorded payments.", fields: [f("period", "Period", "text", { required: true, placeholder: "Sep 2026" }), f("gateway", "Gateway"), f("expected", "Expected (₹)", "number"), f("received", "Received (₹)", "number"), f("notes", "Notes", "textarea")], columns: col("period", "gateway", "expected", "received"), titleField: "period", statuses: ["Open", "Matched", "Mismatch"] },
  { key: "donations", label: "Donations", group: "payments", kind: "collection", store: "donations", description: "Pledges made from the Donate page.", fields: [f("name", "Donor", "text", { required: true }), f("email", "Email", "email", { required: true }), f("phone", "Phone"), f("amount", "Amount (₹)", "number", { required: true }), f("cause", "Cause"), f("frequency", "Frequency", "select", { options: ["once", "monthly"] }), f("pan", "PAN (for 80G)"), f("notes", "Notes", "textarea")], columns: col("name", "amount", "cause", "frequency"), titleField: "name", statuses: ["Pledged", "Received", "Receipted", "Cancelled"], sitePath: "/donate", publicSubmissions: true },

  // Support
  { key: "support-tickets", label: "Support Tickets", group: "support", kind: "collection", store: "support-tickets", description: "Help requests from customers and participants.", fields: [f("ticketNumber", "Ticket no."), f("name", "Name", "text", { required: true }), f("email", "Email", "email", { required: true }), f("subject", "Subject", "text", { required: true }), f("message", "Message", "textarea"), f("priority", "Priority", "select", { options: ["Normal", "High", "Urgent"] }), f("assignedTo", "Assigned to"), f("reply", "Internal notes / reply", "textarea")], columns: col("ticketNumber", "name", "subject", "priority"), titleField: "subject", statuses: ["Open", "In Progress", "Resolved", "Closed"], publicSubmissions: true },
  { key: "contact-enquiries", label: "Contact Enquiries", group: "support", kind: "collection", store: "contact-enquiries", description: "Messages sent from the Contact page.", fields: [f("name", "Name", "text", { required: true }), f("email", "Email", "email", { required: true }), f("phone", "Phone"), f("subject", "Subject"), f("message", "Message", "textarea"), f("reply", "Reply / notes", "textarea")], columns: col("name", "email", "subject"), titleField: "name", statuses: ["New", "Replied", "Closed"], sitePath: "/contact", publicSubmissions: true },
  { key: "subscribers", label: "Newsletter Subscribers", group: "support", kind: "collection", store: "subscribers", description: "Emails collected from the newsletter form.", fields: [f("email", "Email", "email", { required: true }), f("name", "Name"), f("source", "Source")], columns: col("email", "name", "source"), titleField: "email", statuses: ["Subscribed", "Unsubscribed"], publicSubmissions: true },

  // Delivery
  { key: "delivery-partners", label: "Partners", group: "delivery", kind: "collection", store: "delivery-partners", description: "Courier and last-mile delivery partners.", fields: DELIVERY_PARTNER_FIELDS, columns: col("name", "contactPerson", "phone", "rate"), titleField: "name", statuses: ["Onboarding", "Active", "Inactive"] },
  { key: "delivery-onboarding", label: "Onboarding", group: "delivery", kind: "collection", store: "delivery-partners", description: "Partners being onboarded.", fields: DELIVERY_PARTNER_FIELDS, columns: col("name", "contactPerson", "email"), titleField: "name", statuses: ["Onboarding", "Active", "Inactive"], filter: { status: "Onboarding" } },
  { key: "delivery-apis", label: "APIs", group: "delivery", kind: "collection", store: "delivery-apis", description: "Partner API connections.", fields: [f("partner", "Partner", "text", { required: true }), f("baseUrl", "API base URL", "url"), f("webhookUrl", "Webhook URL", "url"), f("apiKeyHint", "Key hint (last 4)")], columns: col("partner", "baseUrl"), titleField: "partner", statuses: ["Connected", "Disconnected"] },
  { key: "delivery-shipments", label: "Partner Shipments", group: "delivery", kind: "collection", store: "shipments", description: "Shipments grouped by delivery partner.", fields: SHIPMENT_FIELDS, columns: col("partner", "orderNumber", "awb", "eta"), titleField: "orderNumber", statuses: SHIPMENT_STATUSES },
  { key: "delivery-assignments", label: "Assignments", group: "delivery", kind: "collection", store: "delivery-assignments", description: "Orders assigned to partners.", fields: [f("orderNumber", "Order number", "text", { required: true }), f("partner", "Partner", "text", { required: true }), f("assignedTo", "Rider / agent"), f("pickupDate", "Pickup date", "date")], columns: col("orderNumber", "partner", "assignedTo", "pickupDate"), titleField: "orderNumber", statuses: ["Assigned", "Picked Up", "Delivered", "Failed"] },
  { key: "delivery-performance", label: "Performance", group: "delivery", kind: "collection", store: "delivery-performance", description: "Monthly partner performance.", fields: [f("partner", "Partner", "text", { required: true }), f("period", "Period", "text", { required: true }), f("delivered", "Delivered", "number"), f("delayed", "Delayed", "number"), f("rto", "RTO", "number"), f("rating", "Rating (0-5)", "number")], columns: col("partner", "period", "delivered", "delayed", "rating"), titleField: "partner", statuses: ["Final", "Draft"] },

  // Communication
  { key: "email-campaigns", label: "Email Campaigns", group: "communication", kind: "collection", store: "email-campaigns", description: "Newsletters and announcements to subscribers, customers and participants.", fields: [f("subject", "Subject", "text", { required: true }), f("audience", "Audience", "select", { options: ["All subscribers", "Customers", "Event registrants", "Donors", "Staff"] }), f("body", "Message", "textarea", { required: true }), f("scheduledAt", "Send on", "date")], columns: col("subject", "audience", "scheduledAt"), titleField: "subject", statuses: ["Draft", "Scheduled", "Sent"] },

  // Settings
  { key: "settings-general", label: "General", group: "settings", kind: "settings", store: "general", description: "Foundation name, contact details and maintenance mode used across the website.", fields: [f("siteName", "Site name"), f("tagline", "Tagline"), f("email", "Public email", "email"), f("phone", "Public phone"), f("whatsapp", "WhatsApp number"), f("address", "Address", "textarea"), f("maintenanceMode", "Maintenance mode", "boolean"), f("maintenanceMessage", "Maintenance message", "textarea")], sitePath: "/" },
  { key: "settings-homepage", label: "Homepage", group: "website", kind: "settings", store: "homepage", description: "Turn homepage sections on or off and control the slideshow.", fields: [f("showSlider", "Show banner slideshow", "boolean"), f("sliderInterval", "Slide interval (seconds)", "number"), f("showDisplayBanner", "Show display banner", "boolean"), f("showFlyers", "Show flyers", "boolean"), f("showAnnouncements", "Show announcements & notices", "boolean"), f("showEvents", "Show upcoming events", "boolean"), f("showDoshas", "Show Tridosha section", "boolean"), f("showHerbs", "Show herbs section", "boolean"), f("showBooks", "Show featured books", "boolean"), f("showArticles", "Show articles", "boolean"), f("showClinics", "Show clinics", "boolean"), f("showTestimonials", "Show testimonials", "boolean"), f("showPartners", "Show partners", "boolean"), f("showFaq", "Show FAQ", "boolean"), f("showShloka", "Show Sanskrit shloka band", "boolean")], sitePath: "/" },
  { key: "settings-registration", label: "Registration", group: "settings", kind: "settings", store: "registration", description: "Account and event registration rules.", fields: [f("allowSelfSignup", "Allow visitors to create accounts", "boolean", { help: "Off = all accounts are created by the admin." }), f("requireLoginForShop", "Require login for shop", "boolean"), f("requireLoginForEvents", "Require login for event details", "boolean"), f("registrationNote", "Note shown on sign-in page", "textarea")] },
  { key: "settings-events", label: "Events", group: "settings", kind: "settings", store: "events", description: "Defaults for new events.", fields: [f("defaultCurrency", "Default currency"), f("defaultCapacity", "Default capacity", "number"), f("waitlistEnabled", "Enable waitlist", "boolean"), f("certificatePrefix", "Certificate prefix", "text", { placeholder: "VGMF-CERT" })] },
  { key: "settings-orders", label: "Orders", group: "settings", kind: "settings", store: "orders", description: "Order rules.", fields: [f("orderPrefix", "Order number prefix"), f("minOrderValue", "Minimum order (₹)", "number"), f("codEnabled", "Cash on delivery", "boolean"), f("returnWindowDays", "Return window (days)", "number")] },
  { key: "settings-shipping", label: "Shipping", group: "settings", kind: "settings", store: "shipping", description: "Shipping charges and pickup.", fields: [f("flatRate", "Flat shipping (₹)", "number"), f("freeAbove", "Free shipping above (₹)", "number"), f("storePickup", "Store pickup available", "boolean"), f("pickupAddress", "Pickup address", "textarea")] },
  { key: "settings-timelines", label: "Processing Timelines", group: "settings", kind: "settings", store: "timelines", description: "Expected processing times shown to customers.", fields: [f("packingDays", "Packing (days)", "number"), f("dispatchDays", "Dispatch (days)", "number"), f("deliveryDays", "Delivery (days)", "number")] },
  { key: "settings-payments", label: "Payments", group: "settings", kind: "settings", store: "payments", description: "Payment options.", fields: [f("upiId", "UPI ID"), f("bankDetails", "Bank transfer details", "textarea"), f("receiptPrefix", "Receipt prefix"), f("section80G", "80G registration no.")] },
  { key: "settings-gateway", label: "Payment Gateway", group: "payments", kind: "settings", store: "gateway", description: "Gateway configuration (keys are stored server-side only).", fields: [f("provider", "Provider", "select", { options: ["Razorpay", "PayU", "Cashfree", "Stripe"] }), f("keyId", "Key ID"), f("mode", "Mode", "select", { options: ["test", "live"] }), f("enabled", "Enabled", "boolean")] },
  { key: "settings-email", label: "Email", group: "settings", kind: "settings", store: "email", description: "Outgoing email identity.", fields: [f("fromName", "From name"), f("fromEmail", "From email", "email"), f("replyTo", "Reply-to", "email"), f("footer", "Email footer", "textarea")] },
  { key: "settings-whatsapp", label: "WhatsApp", group: "settings", kind: "settings", store: "whatsapp", description: "WhatsApp chat button and alerts.", fields: [f("number", "WhatsApp number"), f("greeting", "Greeting message", "textarea"), f("showButton", "Show chat button on website", "boolean")] },
  { key: "settings-api-keys", label: "API Keys", group: "settings", kind: "settings", store: "api-keys", description: "Integration identifiers (never shown on the public site).", fields: [f("googleMaps", "Google Maps key"), f("shiprocket", "Shiprocket email / key"), f("zeptomail", "ZeptoMail token hint")] },
  { key: "settings-notifications", label: "Notifications", group: "settings", kind: "settings", store: "notifications", description: "Who is alerted about new activity.", fields: [f("notifyEmail", "Alert email", "email"), f("onOrder", "New orders", "boolean"), f("onEnquiry", "New enquiries", "boolean"), f("onRegistration", "New registrations", "boolean"), f("onDonation", "New donations", "boolean")] },
  { key: "settings-security", label: "Security", group: "settings", kind: "settings", store: "security", description: "Portal security policy.", fields: [f("sessionHours", "Session length (hours)", "number"), f("minPasswordLength", "Minimum password length", "number"), f("staffCanExport", "Staff can export CSV", "boolean")] },
];

export function getModule(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

/** Permission key used for staff access: collection modules share a store. */
export function permissionOf(m: ModuleDef): string {
  return m.kind === "settings" ? "settings" : m.store;
}

export const PERMISSIONS: { key: string; label: string; group: GroupKey | "accounts" }[] = (() => {
  const seen = new Map<string, { key: string; label: string; group: GroupKey | "accounts" }>();
  for (const m of MODULES) {
    const key = permissionOf(m);
    if (!seen.has(key)) {
      seen.set(key, { key, label: m.kind === "settings" ? "Settings" : m.label.replace(/^All /, ""), group: m.group });
    }
  }
  seen.set("accounts", { key: "accounts", label: "Customer & seller accounts", group: "accounts" });
  return [...seen.values()];
})();

export const ROLE_PRESETS: { name: string; description: string; permissions: string[] }[] = [
  { name: "Content editor", description: "Website content, banners, articles and media.", permissions: ["banners", "announcements", "notices", "flyers", "articles", "videos", "gallery", "testimonials", "partners", "faqs", "clinics", "media"] },
  { name: "Events coordinator", description: "Events, registrations, speakers, schedule and certificates.", permissions: ["events", "event-registrations", "applications", "speakers", "schedule", "event-tickets", "attendance", "certificates"] },
  { name: "Store manager", description: "Shop products, orders, shipments and sellers.", permissions: ["products", "orders", "shipments", "manifests", "sellers", "payments"] },
  { name: "Accounts & donations", description: "Payments, donations and reconciliation.", permissions: ["payments", "donations", "reconciliation"] },
  { name: "Support desk", description: "Tickets, contact enquiries and subscribers.", permissions: ["support-tickets", "contact-enquiries", "subscribers", "email-campaigns"] },
];

export const ACCOUNT_ROLES = ["admin", "staff", "seller", "delivery", "customer"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ROLE_LABELS: Record<AccountRole, string> = {
  admin: "Administrator",
  staff: "Staff",
  seller: "Seller",
  delivery: "Delivery partner",
  customer: "Customer",
};
