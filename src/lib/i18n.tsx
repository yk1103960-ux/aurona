import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Translations = Record<string, string | Record<string, unknown>>;

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const defaultTranslations: Record<string, Translations> = {
  en: {},
};

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
  translations?: Record<string, Translations>;
}

export function I18nProvider({
  children,
  initialLocale = "en",
  translations = defaultTranslations,
}: I18nProviderProps) {
  const [locale, setLocale] = useState(initialLocale);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const bundle = translations[locale] || translations["en"] || {};
      const value = key.split(".").reduce<unknown>(
        (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
        bundle
      );
      return typeof value === "string" ? value : (fallback ?? key);
    },
    [locale, translations]
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
