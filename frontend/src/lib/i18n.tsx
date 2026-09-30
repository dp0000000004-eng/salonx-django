import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { en, hi, or, type Dict } from "@/lib/i18n-dicts";

export type Lang = "en" | "hi" | "or";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "or", label: "ଓଡ଼ିଆ" },
];
const DICTS: Record<Lang, Dict> = { en, hi, or };
const STORAGE_KEY = "salonx.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const I18nContext = createContext<Ctx | null>(null);

function lookup(dict: Dict, key: string): string | undefined {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict);
  return typeof v === "string" ? v : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Restore after hydration (never during SSR render).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && saved in DICTS) setLangState(saved);
    // After login, adopt the language saved on the profile if none chosen locally.
    const { data } = api.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      void api.from("profiles").select("language").eq("id", session.user.id).maybeSingle().then(({ data: p }) => {
        const local = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
        if (local && local in DICTS) {
          if (p && p.language !== local) void api.from("profiles").update({ language: local }).eq("id", session.user.id);
        } else if (p?.language && p.language in DICTS) {
          setLangState(p.language as Lang);
          window.localStorage.setItem(STORAGE_KEY, p.language);
        }
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    void api.auth.getUser().then(({ data }) => {
      if (data.user) void api.from("profiles").update({ language: l }).eq("id", data.user.id);
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = lookup(DICTS[lang], key) ?? lookup(en, key) ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
export const useT = () => useI18n().t;
