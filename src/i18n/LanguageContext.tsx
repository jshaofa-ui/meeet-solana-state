import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { translations, type Lang, LANG_LABELS, LANG_FLAGS } from "./translations";

const SUPPORTED_LANGS: Lang[] = ["en", "ru", "zh", "es", "ar", "hi", "fr"];

function detectBrowserLang(): Lang | null {
  const browserLangs = navigator.languages || [navigator.language];
  for (const bl of browserLangs) {
    const code = bl.split("-")[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(code as Lang)) return code as Lang;
  }
  return null;
}

type LanguageContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => any;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ru";
    const stored = localStorage.getItem("meeet-lang");
    if (stored && SUPPORTED_LANGS.includes(stored as Lang)) return stored as Lang;
    return detectBrowserLang() ?? "ru";
  });

  useEffect(() => {
    localStorage.setItem("meeet-lang", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    if (!SUPPORTED_LANGS.includes(newLang)) return;
    setLangState(newLang);
  }, []);

  const resolve = useCallback((path: string, dict: any): any => {
    if (!dict) return undefined;
    const keys = path.split(".");
    let value: any = dict;
    for (const key of keys) {
      if (value == null || typeof value !== "object") return undefined;
      value = value[key];
    }
    return value;
  }, []);

  const t = useCallback((path: string): any => {
    // 1) Direct path in current language
    let value = resolve(path, translations[lang]);
    if (value !== undefined) return value;
    // 2) Same path in English
    value = resolve(path, translations.en);
    if (value !== undefined) return value;
    // 3) Strip "pages." prefix (some keys live at root, e.g. models.*, live.*)
    if (path.startsWith("pages.")) {
      const stripped = path.slice(6);
      value = resolve(stripped, translations[lang]);
      if (value !== undefined) return value;
      value = resolve(stripped, translations.en);
      if (value !== undefined) return value;
    }
    return path;
  }, [lang, resolve]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

const defaultContext: LanguageContextType = {
  lang: "ru",
  setLang: () => {},
  t: (path: string) => path,
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return ctx ?? defaultContext;
}

export { LANG_LABELS, LANG_FLAGS };
export type { Lang };
