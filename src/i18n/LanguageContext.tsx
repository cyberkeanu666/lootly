import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale, TranslationDict } from './types';
import en from './en';
import sr from './sr';

const STORAGE_KEY = 'lootly_locale';

const catalogs: Record<Locale, TranslationDict> = { en, sr };

function resolve(dict: TranslationDict, key: string): string {
  const parts = key.split('.');
  let node: string | TranslationDict = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) return key;
    node = node[part];
  }
  return typeof node === 'string' ? node : key;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'sr' || saved === 'en' ? saved : 'en';
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'sr' ? 'sr' : 'en';
  };

  useEffect(() => {
    document.documentElement.lang = locale === 'sr' ? 'sr' : 'en';
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string | number>) => {
        let text = resolve(catalogs[locale], key);
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return text;
      },
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `giveaway-${Date.now().toString(36).slice(-6)}`;
}
