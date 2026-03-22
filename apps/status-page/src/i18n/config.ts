export const locales = ["en", "fr", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeTranslations: Record<
  Locale,
  {
    name: string;
    flag: string;
  }
> = {
  en: {
    name: "English",
    flag: "🇺🇸",
  },
  fr: {
    name: "Français",
    flag: "🇫🇷",
  },
  de: {
    name: "Deutsch",
    flag: "🇩🇪",
  },
};
