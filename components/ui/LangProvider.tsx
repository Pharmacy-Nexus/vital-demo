"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "ar";
type LangContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  tr: (en: string, ar: string) => string;
};

const KEY = "vital-id-language";
const C = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  tr: (en) => en,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem(KEY, lang);
  }, [lang]);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang: setLangState,
    tr: (en, ar) => (lang === "ar" ? ar : en),
  }), [lang]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useLang = () => useContext(C);

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className={`text-xs font-bold underline underline-offset-4 ${className}`}
    >
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
