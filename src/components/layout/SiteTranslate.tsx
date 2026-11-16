"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/** Indian languages Google Translate supports (Santali, Kashmiri and Bodo are not offered by Google). */
export const SITE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "mr", label: "मराठी · Marathi" },
  { code: "bn", label: "বাংলা · Bengali" },
  { code: "ta", label: "தமிழ் · Tamil" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "kn", label: "ಕನ್ನಡ · Kannada" },
  { code: "ml", label: "മലയാളം · Malayalam" },
  { code: "gu", label: "ગુજરાતી · Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ · Punjabi" },
  { code: "or", label: "ଓଡ଼ିଆ · Odia" },
  { code: "as", label: "অসমীয়া · Assamese" },
  { code: "ur", label: "اردو · Urdu" },
  { code: "sa", label: "संस्कृतम् · Sanskrit" },
  { code: "gom", label: "कोंकणी · Konkani" },
  { code: "mai", label: "मैथिली · Maithili" },
  { code: "sd", label: "سنڌي · Sindhi" },
  { code: "ne", label: "नेपाली · Nepali" },
  { code: "doi", label: "डोगरी · Dogri" },
  { code: "mni-Mtei", label: "ꯃꯩꯇꯩꯂꯣꯟ · Manipuri" },
  { code: "bho", label: "भोजपुरी · Bhojpuri" },
] as const;

// Names, addresses, amounts and payment screens stay in English.
const ENGLISH_ONLY = ["/admin", "/staff", "/support", "/scanner", "/picker", "/packer", "/doctor", "/checkout", "/pay"];

type TranslateWindow = Window & {
  __vgmfTranslate?: boolean;
  vgmfTranslateInit?: () => void;
  google?: { translate?: { TranslateElement: new (options: object, id: string) => unknown } };
};

const noSubscribe = () => () => undefined;

function chosenLanguage() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/;]*\/([^;]+)/);
  const code = match ? decodeURIComponent(match[1]) : "en";
  return SITE_LANGUAGES.some((language) => language.code === code) ? code : "en";
}

function saveLanguage(code: string) {
  const host = window.location.hostname;
  const parent = host.split(".").slice(-2).join(".");
  const value = code === "en" ? "" : `/en/${code}`;
  const life = code === "en" ? "; expires=Thu, 01 Jan 1970 00:00:00 GMT" : "; max-age=31536000";
  for (const domain of ["", `; domain=${host}`, `; domain=.${parent}`]) {
    document.cookie = `googtrans=${value}; path=/${domain}${life}`;
  }
}

// Google Translate wraps text in <font> tags; keep React's DOM updates from crashing on those.
function guardDom() {
  const proto = Node.prototype as Node & Record<string, unknown>;
  if (proto.__vgmfGuard) return;
  proto.__vgmfGuard = true;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    return insert.call(this, node, ref && ref.parentNode !== this ? null : ref) as T;
  };
}

function loadWidget() {
  const win = window as TranslateWindow;
  if (win.__vgmfTranslate) return;
  win.__vgmfTranslate = true;
  guardDom();
  let host = document.getElementById("vgmf-translate");
  if (!host) {
    host = document.createElement("div");
    host.id = "vgmf-translate";
    host.style.display = "none";
    document.body.appendChild(host);
  }
  win.vgmfTranslateInit = () => {
    const Element = win.google?.translate?.TranslateElement;
    if (Element) new Element({ pageLanguage: "en", includedLanguages: SITE_LANGUAGES.map((language) => language.code).join(","), autoDisplay: false }, "vgmf-translate");
  };
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=vgmfTranslateInit";
  script.async = true;
  document.body.appendChild(script);
}

export function SiteTranslate({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const language = useSyncExternalStore(noSubscribe, chosenLanguage, () => "en");

  useEffect(() => {
    if (chosenLanguage() === "en") return;
    const englishOnly = ENGLISH_ONLY.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (!englishOnly) loadWidget();
    else if ((window as TranslateWindow).__vgmfTranslate) window.location.reload();
  }, [pathname]);

  return (
    <select
      aria-label="Language"
      title="Read this site in your language"
      translate="no"
      className={`notranslate h-9 max-w-[8.5rem] rounded-full border border-border bg-white px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-burgundy/30 ${className}`}
      value={language}
      onChange={(event) => {
        saveLanguage(event.target.value);
        window.location.reload();
      }}
    >
      {SITE_LANGUAGES.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
