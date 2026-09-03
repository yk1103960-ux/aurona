import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
};

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

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);

    if (typeof window !== "undefined") {
      localStorage.setItem("aurona-language", nextLanguage);
      document.documentElement.lang = nextLanguage;
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (english: string) => (language === "hi" ? (translations[english] ?? english) : english),
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

