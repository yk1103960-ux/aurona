import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translateTexts } from "@/lib/translate.functions";

export type Language = "en" | "hi";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (english: string) => string;
};

const translations: Record<string, string> = {
  Home: "होम",
  "All Products": "सभी उत्पाद",
  "Home Appliances": "घरेलू उपकरण",
  "LED Lightings": "एलईडी लाइटिंग",
  "Affiliate With Us": "हमारे साथ एफिलिएट बनें",
  "Career With Us": "हमारे साथ करियर",
  Blogs: "ब्लॉग",
  "About Us": "हमारे बारे में",
  "Contact Us": "संपर्क करें",
  FAQs: "सामान्य प्रश्न",

  Account: "खाता",
  "Login / Register": "लॉगिन / रजिस्टर",
  "Sign In / Register": "साइन इन / रजिस्टर",

  "Browse Categories": "श्रेणियाँ देखें",
  "View all results": "सभी परिणाम देखें",
  "View product": "उत्पाद देखें",
  Product: "उत्पाद",

  Search: "खोजें",
  "Search premium lighting…": "प्रीमियम लाइटिंग खोजें…",
  "No products yet in this category.": "इस श्रेणी में अभी कोई उत्पाद नहीं है।",
  "Hover over a category to see products": "उत्पाद देखने के लिए किसी श्रेणी पर जाएँ",
  "Hover over a product to see details": "विवरण देखने के लिए किसी उत्पाद पर जाएँ",

  "Open positions": "खुली नौकरियाँ",
  "Partner programs": "पार्टनर प्रोग्राम",
  "All careers & referral programs": "सभी करियर और रेफरल प्रोग्राम",
  "Apply / submit your profile": "आवेदन करें / प्रोफ़ाइल जमा करें",

  "Page not found": "पेज नहीं मिला",
  "The page you're looking for doesn't exist or has been moved.":
    "आप जिस पेज को खोज रहे हैं वह उपलब्ध नहीं है या स्थानांतरित कर दिया गया है।",
  "Go home": "होम पर जाएँ",

  "This page didn't load": "यह पेज लोड नहीं हुआ",
  "Something went wrong. Try again or head back home.": "कुछ गलत हो गया। दोबारा प्रयास करें या होम पर जाएँ।",
  "Try again": "फिर प्रयास करें",

  Helpline: "हेल्पलाइन",

  "LED Bulbs": "एलईडी बल्ब",
  Tubelight: "ट्यूबलाइट",
  "Deep Light": "डीप लाइट",
  "Panel Lights": "पैनल लाइट",
  "Interior Lights": "इंटीरियर लाइट",
  "Decorative Lights": "डेकोरेटिव लाइट",
  "Concealed Lights": "कन्सील्ड लाइट",
  "Street Lights": "स्ट्रीट लाइट",
  "Flood Light": "फ्लड लाइट",
  "Outdoor Light": "आउटडोर लाइट",

  "Ceiling Fans": "सीलिंग फैन",
  "Pedestal Fans": "पेडेस्टल फैन",
  "Table Fans": "टेबल फैन",
  "Exhaust Fans": "एग्जॉस्ट फैन",
  "Water Geysers": "वॉटर गीजर",
  "Immersion Heaters": "इमर्शन हीटर",
  "Room Heater": "रूम हीटर",
  Fans: "फैन",
  More: "और",
  Cart: "कार्ट",
  Checkout: "चेकआउट",
  "Add to cart": "कार्ट में जोड़ें",
  "Buy now": "अभी खरीदें",
  "Continue shopping": "खरीदारी जारी रखें",
  "Proceed to checkout": "चेकआउट पर जाएँ",
  Quantity: "मात्रा",
  Price: "मूल्य",
  Subtotal: "उप-योग",
  Discount: "छूट",
  Shipping: "डिलीवरी",
  Tax: "कर",
  Total: "कुल",
  "Apply a coupon": "कूपन लगाएँ",
  "Enter coupon code": "कूपन कोड दर्ज करें",
  Apply: "लागू करें",
  Remove: "हटाएँ",
  Address: "पता",
  Payment: "भुगतान",
  "Place order": "ऑर्डर करें",
  "Order summary": "ऑर्डर सारांश",
  "Out of stock": "स्टॉक में नहीं",
  "In stock": "स्टॉक में उपलब्ध",
  "My Account": "मेरा खाता",
  "My Orders": "मेरे ऑर्डर",
  Logout: "लॉग आउट",
};

/* ------------------------------------------------------------------ */
/* Page-wide auto translation                                          */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "aurona-translation-cache-hi";
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "CANVAS"]);
const DEVANAGARI = /[\u0900-\u097F]/;
const HAS_LETTERS = /[A-Za-z]{2,}/;

let cache: Record<string, string> = { ...translations };
let cacheLoaded = false;
let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let observer: MutationObserver | null = null;
const originals = new WeakMap<Text, string>();

function loadCache() {
  if (cacheLoaded || typeof window === "undefined") return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) cache = { ...cache, ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    /* ignore corrupt cache */
  }
}

function persistCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota — ignore */
  }
}

function translatable(node: Text): boolean {
  const value = node.nodeValue ?? "";
  const text = value.trim();
  if (text.length < 2 || text.length > 400) return false;
  if (!HAS_LETTERS.test(text)) return false;
  if (DEVANAGARI.test(text)) return false;

  let el = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.getAttribute("data-no-translate") !== null) return false;
    el = el.parentElement;
  }
  return true;
}

function applyToNode(node: Text) {
  const value = node.nodeValue ?? "";
  const key = value.trim();
  const hit = cache[key];
  if (!hit) {
    pending.add(key);
    return;
  }
  if (!originals.has(node)) originals.set(node, value);
  const next = value.replace(key, hit);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function walk(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);
  for (const node of nodes) if (translatable(node)) applyToNode(node);

  // Text-node translation alone misses form placeholders, tooltips and
  // accessibility labels. Translate those too, while keeping unknown copy in
  // English until a safe translation is available.
  const elements = root.nodeType === Node.ELEMENT_NODE
    ? [root as Element, ...(root as Element).querySelectorAll("[placeholder],[title],[aria-label]")]
    : [];
  for (const element of elements) {
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      const source = element.getAttribute(attribute)?.trim();
      if (!source || !HAS_LETTERS.test(source) || DEVANAGARI.test(source)) continue;
      const translated = cache[source];
      if (translated) element.setAttribute(attribute, translated);
      else pending.add(source);
    }
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 350);
}

async function flush() {
  if (pending.size === 0) return;
  const batch = [...pending].slice(0, 100);
  pending = new Set([...pending].slice(100));

  try {
    const result = await translateTexts({ data: { texts: batch, target: "hi" } });
    let changed = false;
    for (const [source, value] of Object.entries(result)) {
      if (value && value !== cache[source]) {
        cache[source] = value;
        changed = true;
      }
    }
    if (changed) {
      persistCache();
      walk(document.body);
    }
  } catch {
    /* leave English on failure */
  }

  if (pending.size > 0) scheduleFlush();
}

function startAutoTranslate() {
  if (typeof window === "undefined" || observer) return;
  loadCache();
  walk(document.body);
  scheduleFlush();

  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        const node = record.target as Text;
        if (translatable(node)) applyToNode(node);
      } else {
        record.addedNodes.forEach((added) => {
          if (added.nodeType === Node.TEXT_NODE) {
            if (translatable(added as Text)) applyToNode(added as Text);
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            walk(added);
          }
        });
      }
    }
    scheduleFlush();
  });

  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

function stopAutoTranslate() {
  observer?.disconnect();
  observer = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pending = new Set();
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("aurona-language");

    if (saved === "hi" || saved === "en") {
      setLanguageState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  useEffect(() => {
    if (language === "hi") startAutoTranslate();
    else stopAutoTranslate();

    return () => stopAutoTranslate();
  }, [language]);

  const setLanguage = (nextLanguage: Language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aurona-language", nextLanguage);
      document.documentElement.lang = nextLanguage;

      // Switching back to English restores the server-rendered copy cleanly.
      if (nextLanguage === "en" && language === "hi") {
        stopAutoTranslate();
        window.location.reload();
        return;
      }
    }

    setLanguageState(nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (english: string) => (language === "hi" ? (cache[english] ?? translations[english] ?? english) : english),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}

export const I18nProvider = LanguageProvider;
export const useI18n = useLanguage;
