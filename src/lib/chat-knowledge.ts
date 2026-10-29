import { getAbout } from "@/lib/about";
import { getLiveAnnouncements, getLiveClinics, getLiveEvents, getLiveNotices, getLiveVideos, getPublishedArticles, getSiteFlags } from "@/lib/cms";
import { getLiveBooks } from "@/lib/product-data";
import { getPolicies } from "@/lib/policies";
import { isPublishedNow } from "@/lib/schedule";
import { addToCart, buildTrackingStages, formatPrice, getOrders } from "@/lib/store";
import { siteConfig, storeConfig, seminarSiteUrl } from "@/lib/constants";
import { formatDate, formatDateRange } from "@/lib/utils";
import type { Book, Order } from "@/types";

const EVENT_INTENT =
  /\b(seminar|workshops?|fellowships?|programmes?|programs?|events?|upcoming|next seminar|next event)\b|परिसंवाद|कार्यशाळा|सेमिनार|संगोष्ठी|कार्यक्रम|कार्यशाला|संगोष्ठि|நிகழ்வு|ಕಾರ್ಯಕ್ರಮ|പരിപാടി|કાર્યક્રમ|కార్యక్రమ|অনুষ্ঠান/i;
const ARTICLE_INTENT = /\b(articles?|journal|essay|paper|latest article)\b|लेख|कட்டுரை|ಲೇಖನ|ലേഖനം/i;
const CLINIC_INTENT = /\b(clinic|opd|consultation|hospital|treatment|doctor)\b|चिकित्सालय|क्लिनिक|மருத்துவமனை/i;
const POLICY_INTENT = /\b(privacy|terms|refund|return policy|shipping policy|cancellation|legal)\b/i;
const ABOUT_INTENT = /\b(who|founders?|trustees?|about|history|legacy|rb gogate|vaidya|foundation|mission|vision)\b|गोगटे|फाउंडेशन/i;
const CONTACT_INTENT = /\b(contact|email|phone|reach|address|office|pune|where)\b|संपर्क|पत्ता|पूणे/i;
const SHOP_INTENT = /\b(shop|store|publication|books?|buy|purchase|order a book)\b|दुकान|पुस्तक/i;
const VIDEO_INTENT = /\b(videos?|lecture|youtube|film|recording)\b|व्हिडिओ|वीडियो/i;
const GALLERY_INTENT = /\b(gallery|photos?|photographs?|pictures?|images?)\b|गॅलरी|गैलरी/i;
const NOTICE_INTENT = /\b(notice|announcement|news|circular|update)\b|सूचना|सूचनाएँ/i;

const CONTENT_STOP = new Set([
  "the", "and", "for", "are", "was", "were", "this", "that", "with", "from", "your", "you", "our", "what",
  "when", "where", "which", "have", "has", "had", "next", "latest", "please", "tell", "about", "into",
  "can", "how", "who", "why", "any", "all",
]);

function tokensOf(question: string) {
  return question
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u0d7f]+/i)
    .filter((token) => token.length >= 3 && !CONTENT_STOP.has(token));
}

function scoreHay(hay: string, tokens: string[]) {
  const text = hay.toLowerCase();
  return tokens.reduce((sum, token) => (text.includes(token) ? sum + token.length : sum), 0);
}

function summariseEvents() {
  const upcoming = getLiveEvents().filter((event) => isPublishedNow(event) && event.registrationStatus !== "Closed");
  if (upcoming.length === 0) {
    return "There are no upcoming seminars or events published right now. Open the Events page when a new programme is listed — registration, if any, is announced there and on seminar.vaidyagogate.org.";
  }
  const next = upcoming[0];
  const more = upcoming.slice(1, 3).map((event) => `“${event.name}”`).join(", ");
  return `The next event is “${next.name}”${next.startDate ? ` on ${formatDateRange(next.startDate, next.endDate)}` : ""}${[next.venue, next.city].filter(Boolean).length ? ` at ${[next.venue, next.city].filter(Boolean).join(", ")}` : ""}.${next.shortDescription ? ` ${next.shortDescription}` : ""}${more ? ` Also listed: ${more}.` : ""} Open Events for the full schedule. Registration, when open, continues on ${seminarSiteUrl.replace("https://", "")}.`;
}

function summariseArticles() {
  const articles = getPublishedArticles();
  if (articles.length === 0) {
    return "No articles have been published on the public site yet. Staff drafts wait for administrator approval before they go live. Open Articles once pieces are approved.";
  }
  const top = articles.slice(0, 3);
  return `Latest writing on the site: ${top.map((article) => `“${article.title}”${article.author ? ` (published by ${article.author})` : ""}`).join("; ")}. Open Articles to read them, and use Share on each piece to post a link.`;
}

function summariseClinics() {
  const clinics = getLiveClinics();
  if (!clinics.length) return "No clinics are listed on the site yet. Open Clinics once the Foundation publishes hours.";
  const top = clinics.slice(0, 3);
  return `Foundation clinics: ${top.map((clinic) => `“${clinic.name}”${clinic.timings ? ` (${clinic.timings})` : ""}${clinic.city ? ` — ${clinic.city}` : ""}`).join("; ")}. Open Clinics for maps and appointment links.`;
}

function summariseAbout() {
  const about = getAbout();
  const trustees = about.trustees.trustees.slice(0, 3).map((person) => person.name).filter(Boolean).join(", ");
  const mission = about.foundation.sections.find((section) => /mission/i.test(section.title))?.body;
  return `${about.intro}${mission ? ` Mission: ${mission.slice(0, 220)}` : ""}${trustees ? ` Trustees include ${trustees}.` : ""} Open About Us for the Foundation, history, trustees and the legacy of Vaidya R. B. Gogate.`;
}

function summariseContact() {
  return `The Foundation office is at ${siteConfig.address}. Write to ${siteConfig.email} or call ${siteConfig.phone}. You can also send a message from the Contact page — a team member typically replies within two working days.`;
}

function summariseShop() {
  const live = getLiveBooks().slice(0, 4);
  if (!live.length) {
    return "The Foundation shop lists Ayurveda publications when titles are added from the admin console. Browse Shop, then sign in to place an order. In this chat you can also type a book title to add it to your cart.";
  }
  return `Publications currently listed: ${live.map((book) => `“${book.title}”${book.price ? ` (${formatPrice(book.price)})` : ""}`).join("; ")}. Open Shop to browse, or tell me a title and I can add it to your cart.`;
}

function summariseVideos() {
  const videos = getLiveVideos().slice(0, 3);
  if (!videos.length) return "No videos are published yet. Open Videos once lectures or seminar recordings are added from the admin console.";
  return `Recent videos: ${videos.map((video) => `“${video.title}”`).join("; ")}. Open Videos to watch.`;
}

function summariseGallery() {
  return "The Gallery collects photographs from the Foundation, seminars, clinics and community programmes, organised by category. Open Gallery to browse.";
}

function summariseNotices() {
  const notices = getLiveNotices().filter((notice) => isPublishedNow(notice));
  const announcements = getLiveAnnouncements();
  if (notices.length) {
    const latest = notices[0];
    return `Latest notice: “${latest.title}”. Open the Notice board for deadlines, lists and circulars from the Foundation office.`;
  }
  if (announcements.length === 0) return "There are no notices or announcements right now.";
  const latest = announcements[0];
  return `Latest announcement: “${latest.title}”. See the Announcements page for the full list.`;
}

function summarisePolicies() {
  const policies = getPolicies();
  return `Legal pages on this site: ${Object.values(policies)
    .map((doc) => doc.title)
    .join(", ")}. Open the matching policy from the footer. Payments are processed by our gateway; we do not store card numbers.`;
}

function searchFedContent(question: string): string | null {
  const tokens = tokensOf(question);
  if (tokens.length === 0) return null;
  const minScore = Math.max(8, tokens[0].length);

  const about = getAbout();
  const aboutHay = [
    about.title,
    about.intro,
    ...about.sections.flatMap((section) => [section.title, section.body]),
    about.foundation.title,
    about.foundation.intro,
    ...about.foundation.sections.flatMap((section) => [section.title, section.body]),
    about.history.title,
    ...about.history.timeline.flatMap((item) => [item.year, item.title, item.description]),
    about.trustees.title,
    ...about.trustees.trustees.map((person) => `${person.name} ${person.role} ${person.bio ?? ""}`),
    about.legacy.title,
    about.legacy.biography,
    about.legacy.philosophy,
  ].join(" ");
  const aboutScore = scoreHay(aboutHay, tokens);

  const articleHits = getPublishedArticles()
    .map((article) => {
      const hay = [article.title, article.excerpt, article.author, article.category, ...(article.tags ?? [])]
        .filter(Boolean)
        .join(" ");
      return { article, score: scoreHay(hay, tokens) };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const eventHits = getLiveEvents()
    .filter((event) => isPublishedNow(event))
    .map((event) => {
      const hay = [event.name, event.shortDescription, event.description, event.city, event.venue, event.eventType]
        .filter(Boolean)
        .join(" ");
      return { event, score: scoreHay(hay, tokens) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const noticeHits = getLiveNotices()
    .filter((notice) => isPublishedNow(notice))
    .map((notice) => {
      const hay = [notice.title, notice.description, notice.category].filter(Boolean).join(" ");
      return { notice, score: scoreHay(hay, tokens) };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const bookHits = getLiveBooks()
    .map((book) => ({ book, score: scoreHay([book.title, book.author, book.description, book.category].filter(Boolean).join(" "), tokens) }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const videoHits = getLiveVideos()
    .map((video) => ({ video, score: scoreHay([video.title, video.description, video.category].filter(Boolean).join(" "), tokens) }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const clinicHits = getLiveClinics()
    .map((clinic) => ({
      clinic,
      score: scoreHay([clinic.name, clinic.city, clinic.about, clinic.specialization, clinic.address].filter(Boolean).join(" "), tokens),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const parts: string[] = [];
  if (eventHits.length) {
    parts.push(eventHits.map(({ event }) => `Event: “${event.name}”${event.shortDescription ? ` — ${event.shortDescription}` : ""}.`).join(" "));
  }
  if (aboutScore >= minScore) {
    parts.push(summariseAbout());
  }
  if (clinicHits.length) {
    parts.push(clinicHits.map(({ clinic }) => `Clinic: “${clinic.name}”${clinic.timings ? ` (${clinic.timings})` : ""}.`).join(" "));
  }
  if (bookHits.length) {
    parts.push(bookHits.map(({ book }) => `Publication: “${book.title}”${book.price ? ` — ${formatPrice(book.price)}` : ""}.`).join(" "));
  }
  if (videoHits.length) {
    parts.push(videoHits.map(({ video }) => `Video: “${video.title}”.`).join(" "));
  }
  if (articleHits.length) {
    parts.push(
      articleHits
        .map(({ article }) => {
          const snippet = (article.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 160);
          return `Article: “${article.title}”${article.author ? `, published by ${article.author}` : ""}.${snippet ? ` ${snippet}` : ""}`;
        })
        .join(" ")
    );
  }
  if (noticeHits.length) {
    parts.push(noticeHits.map(({ notice }) => `Notice: “${notice.title}”.`).join(" "));
  }
  return parts.length ? parts.join(" ") : null;
}

const ORDER_ID_PATTERN = /\b\d{10,14}\b/g;
const TRACKING_INTENT =
  /\btrack\b|status|where is (my )?order|my order|deliver|delivery update|shipped|courier|arrive|otp|dispatched/i;
const ORDERING_INTENT =
  /(^|\b)(order|buy|purchase|subscribe)(\b|$)|add.{0,15}(cart|basket)|want.{0,15}(book|publication|copy)|(grab|get).{0,15}(book|copy)/i;
const STOP_TOKENS = new Set([
  "order", "orders", "book", "books", "buy", "purchase", "want", "need",
  "please", "with", "cart", "basket", "add", "a", "an", "the", "and", "from",
  "for", "delivery", "shipping", "copy", "get", "grab", "i", "me", "to", "of",
  "on", "at", "like", "that", "this",
]);

function findOrderForQuestion(question: string): Order | null {
  const candidates = question.match(ORDER_ID_PATTERN);
  if (!candidates) return null;
  for (const candidate of candidates) {
    const found = getOrders().find((order) => order.id === candidate);
    if (found) return found;
  }
  return null;
}

function formatOrderStatus(order: Order): string {
  const { stages } = buildTrackingStages(order);
  let reachedLabel = "";
  for (const stage of [...stages].reverse()) {
    if (stage.reached) {
      reachedLabel = stage.label;
      break;
    }
  }
  const courier = order.courierName ?? storeConfig.courierName;
  const tracking = order.trackingId;
  const eta = order.eta ?? "within 3–5 business days";
  const courierLine =
    order.status === "Shipped" || order.status === "Out for Delivery" || order.status === "Delivered"
      ? ` Courier: ${courier}${tracking ? ` · Tracking id ${tracking}` : ""}.`
      : "";
  const done =
    order.status === "Delivered"
      ? `Order ${order.id} was delivered (placed ${formatDate(order.date)}).`
      : `Order ${order.id} placed on ${formatDate(order.date)} is at the “${reachedLabel || order.status}” stage (${order.status}).`;
  return `${done}${courierLine} Estimated delivery: ${eta}. You can tap the order card in My Orders for the full journey — delivery agent OTP shows when out for delivery.`;
}

function findBooksForQuestion(question: string): Book[] {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
  if (tokens.length === 0) return [];
  const scored = getLiveBooks()
    .map((book) => {
      const title = book.title.toLowerCase();
      const score = tokens.reduce((sum, token) => (title.includes(token) ? sum + token.length : sum), 0);
      return { book, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.book).slice(0, 3);
}

export function answerQuestion(question: string): string {
  const hasOrderId = /\b\d{10,14}\b/.test(question);

  if (TRACKING_INTENT.test(question) || hasOrderId) {
    const order = findOrderForQuestion(question);
    if (order) return formatOrderStatus(order);
    if (hasOrderId) {
      return "I couldn't find an order with that ID. Double-check it against your confirmation, or open My Orders — every order you place appears there.";
    }
    return "Happy to help! Please share your 12-digit Order ID (found in your confirmation or on My Orders) and I'll fetch its live status right here.";
  }

  if (ORDERING_INTENT.test(question) && !EVENT_INTENT.test(question)) {
    const matches = findBooksForQuestion(question);
    if (matches.length === 1) {
      addToCart(matches[0].id, 1);
      return `I've added “${matches[0].title}” (${formatPrice(matches[0].price)}) to your cart. Open the Cart to review and check out securely — Want anything else?`;
    }
    if (matches.length > 1) {
      return `I found a few titles — which one would you like? ${matches.map((book) => `“${book.title}”`).join(", ")}. Just type the name and I'll add it to your cart.`;
    }
    if (/\b(how|could|can i|way|tell)\b/i.test(question)) {
      return "Just tell me the name of a book and I'll add it to your cart — for example “Add Ayurveda Clinical Practice Guidelines to my cart”. Or browse the full range on the Shop page.";
    }
    return summariseShop();
  }

  if (EVENT_INTENT.test(question)) return summariseEvents();
  if (ARTICLE_INTENT.test(question)) return summariseArticles();
  if (CLINIC_INTENT.test(question)) return summariseClinics();
  if (POLICY_INTENT.test(question)) return summarisePolicies();
  if (CONTACT_INTENT.test(question)) return summariseContact();
  if (VIDEO_INTENT.test(question)) return summariseVideos();
  if (GALLERY_INTENT.test(question)) return summariseGallery();
  if (NOTICE_INTENT.test(question)) return summariseNotices();
  if (SHOP_INTENT.test(question)) return summariseShop();
  if (ABOUT_INTENT.test(question)) return summariseAbout();

  if (/\b(certificate|verify|verification)\b/i.test(question)) {
    return "Certificate numbers issued from Foundation seminar and autism programmes can be checked on this website. Open /certificate-verification and enter the certificate ID.";
  }
  if (/\b(support|donate|contribute|donation)\b/i.test(question)) {
    const flags = getSiteFlags();
    if (!flags.supportUs) {
      return "Support for the Foundation is not open on the website right now. You can still write to us from the Contact page.";
    }
    return `${flags.supportUsTitle}. ${flags.supportUsText}`;
  }
  if (/\b(account|login|register|create account|sign in)\b/i.test(question)) {
    return "Create a foundation account from the Login page — it takes less than a minute. Your 12-digit Account ID ties together your shop orders and account details.";
  }
  if (/\b(language|hindi|marathi|tamil|kannada|gujarati)\b|भाषा|मराठी|हिन्दी/i.test(question)) {
    return "Use the language control in the header or footer to read the site in English, Hindi, Marathi and other Indian languages. Article translations, when the writer has added them, follow the language you choose.";
  }
  if (/\b(share|social|facebook|whatsapp|linkedin|telegram)\b/i.test(question)) {
    return "Every published article has Share on the public page and in the admin Articles desk: Facebook, X, LinkedIn, WhatsApp, Telegram, email, copy link or copy a ready post. Staff drafts go live only after an administrator approves them.";
  }

  return (
    searchFedContent(question) ??
    `I answer from published events, notices, clinics, articles, About Us and shop listings of the ${siteConfig.shortName}. Ask about the next seminar, a clinic, a policy, or an article title — or write via the Contact page.`
  );
}
