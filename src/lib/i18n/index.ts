/**
 * HandicapLab i18n architecture.
 *
 * English is the primary language. Additional locales are supported via
 * message catalogs. The architecture is dictionary-based and designed to
 * allow adding more languages without changing the consumer API.
 *
 * Supported locales: en, zh (Simplified), hi, es, fr, id
 */

export type Locale = 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'id';

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /** ISO 639-1 language code used for <html lang> */
  htmlLang: string;
}

export const LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', htmlLang: 'en' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr', htmlLang: 'zh-CN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', htmlLang: 'hi' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', htmlLang: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', htmlLang: 'fr' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', htmlLang: 'id' },
];

export type MessageCatalog = Record<string, string>;

/**
 * Core message catalog. English is the source of truth.
 * Other locales are progressively filled; missing keys fall back to English
 * to avoid machine-translated gaps and broken UI.
 */
const MESSAGES: Record<Locale, MessageCatalog> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.opportunities': "Today's Opportunities",
    'nav.markets': 'Markets',
    'nav.models': 'Models',
    'nav.performance': 'Performance',
    'nav.pricing': 'Pricing',
    'nav.blog': 'Blog',
    'nav.resources': 'Resources',
    'nav.signIn': 'Sign In',
    'nav.startTrial': 'Start Free Trial',
    'nav.selectLanguage': 'Select language',

    'hero.badge': 'Live market intelligence',
    'hero.title': 'Football market intelligence, engineered for edge.',
    'hero.subtitle':
      'Identify statistical inefficiencies across global football markets with quantitative modeling, closing line value, and transparent historical validation.',
    'hero.ctaPrimary': 'Start Free 14-Day Trial',
    'hero.ctaSecondary': 'View Live Predictions',
    'hero.noCard': 'No credit card required',

    'trust.guarantee': '30-Day Money-Back Guarantee',
    'trust.noQuestions': 'No questions asked',
    'trust.responsible': 'Responsible gambling',
  },
  zh: {
    'nav.dashboard': '仪表盘',
    'nav.opportunities': '今日机会',
    'nav.markets': '市场',
    'nav.models': '模型',
    'nav.performance': '表现',
    'nav.pricing': '定价',
    'nav.blog': '博客',
    'nav.resources': '资源',
    'nav.signIn': '登录',
    'nav.startTrial': '开始免费试用',
    'nav.selectLanguage': '选择语言',
    'hero.badge': '实时市场情报',
    'hero.title': '足球市场情报，为优势而设计。',
    'hero.subtitle':
      '通过量化建模、收盘线价值和透明的历史验证，识别全球足球市场中的统计低效。',
    'hero.ctaPrimary': '开始 14 天免费试用',
    'hero.ctaSecondary': '查看实时预测',
    'hero.noCard': '无需信用卡',
    'trust.guarantee': '30 天退款保证',
    'trust.noQuestions': '无需提问',
    'trust.responsible': '负责任博彩',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.opportunities': 'आज के अवसर',
    'nav.markets': 'बाज़ार',
    'nav.models': 'मॉडल',
    'nav.performance': 'प्रदर्शन',
    'nav.pricing': 'मूल्य निर्धारण',
    'nav.blog': 'ब्लॉग',
    'nav.resources': 'संसाधन',
    'nav.signIn': 'साइन इन',
    'nav.startTrial': 'मुफ़्त ट्रायल शुरू करें',
    'nav.selectLanguage': 'भाषा चुनें',
    'hero.badge': 'लाइव बाज़ार खुफिया',
    'hero.title': 'फुटबॉल बाज़ार खुफिया, बढ़त के लिए इंजीनियर्ड।',
    'hero.subtitle':
      'मात्रात्मक मॉडलिंग, क्लोज़िंग लाइन वैल्यू और पारदर्शी ऐतिहासिक सत्यापन के साथ वैश्विक फुटबॉल बाज़ारों में सांख्यिकीय अक्षमताओं की पहचान करें।',
    'hero.ctaPrimary': '14-दिन मुफ़्त ट्रायल शुरू करें',
    'hero.ctaSecondary': 'लाइव भविष्यवाणियाँ देखें',
    'hero.noCard': 'क्रेडिट कार्ड की आवश्यकता नहीं',
    'trust.guarantee': '30-दिन मनी-बैक गारंटी',
    'trust.noQuestions': 'कोई सवाल नहीं',
    'trust.responsible': 'जिम्मेदार जुआ',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.opportunities': 'Oportunidades de hoy',
    'nav.markets': 'Mercados',
    'nav.models': 'Modelos',
    'nav.performance': 'Rendimiento',
    'nav.pricing': 'Precios',
    'nav.blog': 'Blog',
    'nav.resources': 'Recursos',
    'nav.signIn': 'Iniciar sesión',
    'nav.startTrial': 'Prueba gratuita',
    'nav.selectLanguage': 'Seleccionar idioma',
    'hero.badge': 'Inteligencia de mercado en vivo',
    'hero.title': 'Inteligencia de mercado de fútbol, diseñada para la ventaja.',
    'hero.subtitle':
      'Identifique ineficiencias estadísticas en los mercados de fútbol globales con modelado cuantitativo, valor de línea de cierre y validación histórica transparente.',
    'hero.ctaPrimary': 'Prueba gratuita de 14 días',
    'hero.ctaSecondary': 'Ver predicciones en vivo',
    'hero.noCard': 'Sin tarjeta de crédito',
    'trust.guarantee': 'Garantía de devolución de 30 días',
    'trust.noQuestions': 'Sin preguntas',
    'trust.responsible': 'Juego responsable',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.opportunities': "Opportunités du jour",
    'nav.markets': 'Marchés',
    'nav.models': 'Modèles',
    'nav.performance': 'Performance',
    'nav.pricing': 'Tarifs',
    'nav.blog': 'Blog',
    'nav.resources': 'Ressources',
    'nav.signIn': 'Connexion',
    'nav.startTrial': 'Essai gratuit',
    'nav.selectLanguage': 'Choisir la langue',
    'hero.badge': 'Intelligence de marché en direct',
    'hero.title': "Intelligence du marché du football, conçue pour l'avantage.",
    'hero.subtitle':
      "Identifiez les inefficacités statistiques sur les marchés mondiaux du football grâce à la modélisation quantitative, à la valeur de ligne de clôture et à une validation historique transparente.",
    'hero.ctaPrimary': 'Essai gratuit de 14 jours',
    'hero.ctaSecondary': 'Voir les prédictions en direct',
    'hero.noCard': 'Aucune carte de crédit requise',
    'trust.guarantee': 'Garantie de remboursement de 30 jours',
    'trust.noQuestions': 'Sans poser de questions',
    'trust.responsible': 'Jeu responsable',
  },
  id: {
    'nav.dashboard': 'Dasbor',
    'nav.opportunities': 'Peluang Hari Ini',
    'nav.markets': 'Pasar',
    'nav.models': 'Model',
    'nav.performance': 'Kinerja',
    'nav.pricing': 'Harga',
    'nav.blog': 'Blog',
    'nav.resources': 'Sumber Daya',
    'nav.signIn': 'Masuk',
    'nav.startTrial': 'Mulai Uji Coba Gratis',
    'nav.selectLanguage': 'Pilih bahasa',
    'hero.badge': 'Intelijen pasar langsung',
    'hero.title': 'Intelijen pasar sepak bola, dirancang untuk keunggulan.',
    'hero.subtitle':
      'Identifikasi inefisiensi statistik di pasar sepak bola global dengan pemodelan kuantitatif, nilai garis penutup, dan validasi historis yang transparan.',
    'hero.ctaPrimary': 'Mulai Uji Coba Gratis 14 Hari',
    'hero.ctaSecondary': 'Lihat Prediksi Langsung',
    'hero.noCard': 'Tidak perlu kartu kredit',
    'trust.guarantee': 'Jaminan Uang Kembali 30 Hari',
    'trust.noQuestions': 'Tanpa pertanyaan',
    'trust.responsible': 'Perjudian yang bertanggung jawab',
  },
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  if (LOCALES.some((l) => l.code === locale)) {
    currentLocale = locale;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getDir(): 'ltr' | 'rtl' {
  return LOCALES.find((l) => l.code === currentLocale)?.dir || 'ltr';
}

export function getHtmlLang(): string {
  return LOCALES.find((l) => l.code === currentLocale)?.htmlLang || 'en';
}

/**
 * Translate a key. Falls back to English, then to the key itself.
 */
export function t(key: string, fallback?: string): string {
  return (
    MESSAGES[currentLocale]?.[key] ||
    MESSAGES['en']?.[key] ||
    fallback ||
    key
  );
}

/**
 * Register additional messages for a locale (e.g. page-level catalogs).
 */
export function addMessages(locale: Locale, messages: MessageCatalog): void {
  MESSAGES[locale] = { ...MESSAGES[locale], ...messages };
}

/**
 * Returns the full catalog for a locale (useful for hydration / SSR).
 */
export function getCatalog(locale: Locale): MessageCatalog {
  return { ...MESSAGES['en'], ...MESSAGES[locale] };
}
