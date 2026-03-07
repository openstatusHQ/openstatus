export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "ja",
  "zh",
  "ko",
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
