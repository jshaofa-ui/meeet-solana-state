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
  // Force Russian-only mode — site is Russian-first.
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    localStorage.setItem("meeet-lang", "ru");
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "ru";
  }, [lang]);

  const setLang = useCallback((_newLang: Lang) => {
    // Locked to Russian
    setLangState("ru");
    localStorage.setItem("meeet-lang", "ru");
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "ru";
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
  lang: "en",
  setLang: () => {},
  t: (path: string) => path,
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return ctx ?? defaultContext;
}

export { LANG_LABELS, LANG_FLAGS };
export type { Lang };
