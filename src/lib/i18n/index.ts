export type Locale = 'en' | 'es' | 'pt-BR' | 'id' | 'ar' | 'fr';

export interface LocaleConfig {
  code: Locale;
  name: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'pt-BR', name: 'Português (Brasil)', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
];

export type MessageCatalog = Record<string, string>;

const MESSAGES: Record<Locale, MessageCatalog> = {
  en: {},
  es: {},
  'pt-BR': {},
  id: {},
  ar: {},
  fr: {},
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getDir(): 'ltr' | 'rtl' {
  return LOCALES.find((l) => l.code === currentLocale)?.dir || 'ltr';
}

export function t(key: string, fallback?: string): string {
  return MESSAGES[currentLocale]?.[key] || MESSAGES['en']?.[key] || fallback || key;
}

export function addMessages(locale: Locale, messages: MessageCatalog): void {
  MESSAGES[locale] = { ...MESSAGES[locale], ...messages };
}